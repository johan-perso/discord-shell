#!/usr/bin/env node

// Lazy Load Modules
var _require = require;
var require = function (moduleName) {
    var module;
    return new Proxy(function () {
        if (!module) {
            module = _require(moduleName)
        }
        return module.apply(this, arguments)
    }, {
        get: function (target, name) {
            if (!module) {
                module = _require(moduleName)
            }
            return module[name];
        }
    })
};

// Importer quelques librairies
const chalk = require('chalk');
const inquirer = require('inquirer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const getDirName = path.dirname;
const readline = require('readline'); readline.emitKeypressEvents(process.stdin);
const ora = require('ora'); var spinner = ora({ spinner: 'line' });
const Discord = require('discord.js'); var cached_client; var accountType_bot = false; var active_selection = { id: undefined, type: undefined, data: undefined };

// Détecter des raccourcis clavier
if(process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.on('keypress', (chunk, key) => {
	if(key.ctrl && key.name === 'l') console.clear()
	if(key.ctrl && key.name === 'c') process.exit()
	if(key.ctrl && key.name === 'z') process.exit()
});

// Fonction pour définir le nom du terminal
function setTerminalTitle(title){
	process.stdout.write(
		String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
	);
}

// Fonction pour écrire un fichier
function writeFile(path, contents, cb) {
	fs.mkdir(getDirName(path), { recursive: true }, function (err) {
		if (err) return cb(err);
		fs.writeFile(path, contents, cb);
	});
}
function appendFile(path, contents, cb) {
	fs.mkdir(getDirName(path), { recursive: true }, function (err) {
		if (err) return cb(err);
		fs.appendFile(path, contents, cb);
	});
}

// Fonction pour se connecter avec Discord.js
function connect(token){
	var promise = new Promise(async (resolve, reject) => {
		// Obtenir le token
		var token = token || fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) reject({ error: true, code: "NOT_CONNECTED" })

		// Si un client est déjà là
		if(cached_client && cached_client.user) return resolve(cached_client)

		// Préparer discord.js
		if(accountType_bot === false && !cached_client) var tempClient = new Discord.Client({ ws: { properties: { $browser: "Discord iOS" }}, _tokenType: '' });
		if(accountType_bot === true && !cached_client) var tempClient = new Discord.Client({ ws: { properties: { $browser: "Discord iOS" }}, intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES", "GUILD_PRESENCES", "GUILD_MEMBERS"], partials: ["CHANNEL"] });

		// Se connecter
		tempClient.login(token).catch(err => {
			if(accountType_bot === true) reject({ error: true, message: err.message, code: "INVALID_TOKEN" })
			if(accountType_bot === false) reject({ error: true, message: err.message, code: "TRY_AGAIN" })
		})

		// Une fois le client connecté
		tempClient.on('ready', () => {
			resolve(tempClient)
			cached_client = tempClient
		})
	})

	return promise
}

// Fonction pour obtenir le chemin de la configuration
function getConfigPath(){
	if(require('os').platform() === "win32") var configPath = path.join(process.env.APPDATA, "johanstickman-cli", "discordshell")
	if(require('os').platform() === "darwin") var configPath = path.join(require('os').homedir(), "library", "Preferences", "johanstickman-cli", "discordshell")
	if(require('os').platform() === "linux") var configPath = path.join(require('os').homedir(), ".config", "johanstickman-cli", "discordshell")

	return configPath;
}

// Fonction principale
async function main(){
	// Modifier le titre du terminal
	setTerminalTitle("DiscordShell")

	// Clear le contenu du terminal
	if(!process.argv.slice(2).includes("--noClear")) console.clear();

	// Afficher quelques informations
	console.log(`Discord Shell : version ${chalk.cyan(require('./package.json').version)}`)
	console.log(`Besoin d'aide ? ${chalk.cyan('github.com/johan-perso/discord-shell')}`)

	// Patch discord.js
		// Vérifier si Discord.js est patché
		var isPatched = await require(path.join(__dirname, 'src', 'patchDiscord.js')).checkFile()

		// Si c'est pas le cas
		if(isPatched.message === 'GO_PATCH_DISCORDJS_MESSAGE_CREATE') await require(path.join(__dirname, 'src', 'patchDiscord.js')).patchDiscord()

		// Si il y a eu une erreur
		if(isPatched.error){
			console.log(chalk.red(isPatched.message || isPatched))
			process.exit()
		}

	// Vérifier si une commande a été donné via les arguments
		// Enlever l'argument "--noClear" si il est présent
		if(process.argv.slice(2).includes("--noClear")) process.argv.splice(process.argv.indexOf("--noClear"), 1)

		// Si il y a une commande, l'exécuter
		if(process.argv.slice(2).length > 0) return console.log('') & runCommand(process.argv.slice(2).join(' '), false)

	// Afficher une autre info
	console.log(`Entrer ${chalk.yellow('help')} pour obtenir la liste des commandes.\n`)

	// Appeler la fonction pour qu'on puisse entrer une commande
	enterCommand();
}; main()

// Fonction pour finaliser une commande
function finishCommand(reAsk=true){
	// Si on doit re-demander une commande
	if(reAsk) return enterCommand();

	// Sinon, on quitte
	process.exit()
}

// Fonction pour entrer une commande
function enterCommand(){
	inquirer.prompt([
		{
			type: 'input',
			name: 'command',
			message: chalk.yellow('>'),
			prefix: ''
		}
	]).then(answers => {
		runCommand(answers.command, true)
	})
}

// Fonction pour obtenir des informations sur un token Discord
async function getDiscordAccountInfo_fromAPI(token){
	// Obtenir les informations sur le token
	var response = await fetch(`https://discord.com/api/v6/users/@me`, { headers: { "Authorization": token } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v6/users/@me`, { headers: { "Authorization": `Bot ${token}` } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v6/users/@me`, { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.text())

	// Retourner les informations
	return JSON.parse(response) || response
}

// Fonction pour obtenir les informations à partir d'un identifiant
async function getFromId(id=0, type='user'){
	// Si le client n'est pas initialisé
	if(!cached_client) return { error: true, code: "NOT_CONNECTED" }

	// Si l'identifiant est un utilisateur
	if(type == 'user'){
		// Obtenir des infos
		var info;
		try {
			info = await cached_client.users.fetch(id)
		} catch(err) {
			info = undefined
		}

		// Obtenir des infos sur le salon en DM
		var dmChannel;
		try {
			if(cached_client.user.bot === true) var authorization = `Bot ${fs.readFileSync(path.join(getConfigPath(), 'token.txt'))}`; else var authorization = fs.readFileSync(path.join(getConfigPath(), 'token.txt'));
			dmChannel = await fetch(`https://discord.com/api/v9/users/@me/channels`, { method: 'POST', headers: { 'Authorization': authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ "recipient_id": id }) }).then(res => res.json())
		} catch(err) {
			dmChannel = undefined
		}

		// Ajouter l'identifiant du dmchannel
		if(dmChannel && dmChannel.id) info.dmChannelId = dmChannel.id

		// Retourner les informations
		return info
	}

	// Si l'identifiant est un serveur
	if(type == 'guild'){
		// Obtenir des infos
		var info = await cached_client.guilds.cache.get(id)

		// Retourner les informations
		return info
	}

	// Si l'identifiant est un channel
	if(type == 'channel'){
		// Obtenir des infos
		var info = await cached_client.channels.cache.get(id)

		// Retourner les informations
		return info
	}

	// Si l'identifiant est un groupe
	if(type == 'group'){
		// Obtenir des infos
		var info = await cached_client.channels.fetch(id).catch(err => { return undefined })

		// Retourner les informations
		return info
	}
}

// Fonction pour obtenir sa liste d'amis
async function getFriends(token){
	// Obtenir la liste
	var response = await fetch(`https://discord.com/api/v6/users/@me/relationships`, { headers: { "Authorization": token } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v6/users/@me/relationships`, { headers: { "Authorization": `Bot ${token}` } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v6/users/@me/relationships`, { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.text())

	// Parse en JSON
	var response = JSON.parse(response)

	// Retourner tout ceux qui n'ont pas le type 1
	if(!response.message) return response.filter(friend => friend.type === 1) || response.message || response;
	else return response.message || response
}

// Fonction pour obtenir sa liste de DM
async function getDms(token){
	// Obtenir la liste
	var response = await fetch(`https://discord.com/api/v9/users/@me/channels`, { headers: { "Authorization": token } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v9/users/@me/channels`, { headers: { "Authorization": `Bot ${token}` } }).then(res => res.text())

	// Si on est "pas autorisé"
	if(response.includes("401: Unauthorized")) var response = await fetch(`https://discord.com/api/v9/users/@me/channels`, { headers: { "Authorization": `Bearer ${token}` } }).then(res => res.text())

	// Parse en JSON
	var response = JSON.parse(response)

	// Préparer une variable
	var groups = []
	var dms = []

	// Parcourir les groupes
	for(var i = 0; i < response.length; i++){
		// Si c'est un groupe
		if(response[i].type == 3){
			// Ajouter le groupe à la liste
			groups.push(response[i])
		}

		// Si c'est un DM
		if(response[i].type == 1){
			// Ajouter le DM à la liste, si il n'est pas déjà dedans
			dms.push(response[i].recipients[0])
		}
	}

	// Retourner les groupes et les DM
	return { groups: groups, dms: dms }
}

// Fonction pour demander une confirmation
async function confirm(message='Êtes-vous sûr ?', defaultValue=false){
	// Demander une confirmation
	var confirm = await inquirer.prompt([
		{
			type: 'confirm',
			name: 'confirm',
			message: message,
			default: defaultValue
		}
	])
	
	// Retourner la confirmation
	return confirm.confirm
}

// Fonction pour lancer une commande
async function runCommand(command, reAsk){
	// Enregister la commande dans l'historique
	appendFile(path.join(getConfigPath(), "history.txt"), `${command}\n`, () => {})

	// Séparer la commande, des arguments
	command = command.trim()
	var args = command.split(' ')
	var command = args[0].toLowerCase()
	args = args.slice(1)

	// Obtenir des informations sur la commande entré
		// Obtenir toutes les commandes
		var allCommands = require(path.join(__dirname, 'src','allCommands.json'))
		allCommands = allCommands.commands
		allCommands = JSON.stringify(allCommands)
		allCommands = JSON.parse(allCommands)

		// Obtenir un objet à partir du nom de la commande
		var commandObject = allCommands.find(commandObject => commandObject.name == command)

		// Si on a pas trouvé d'objet, vérifier à partir d'un aliases
		if(!commandObject){
			commandObject = allCommands.find(commandObject => commandObject.aliases.includes(command))
		}

		// Si on a pas trouvé de commande
		if(!commandObject){
			console.log(chalk.red(`Commande ${(command) ? `${chalk.yellow(command)} ` : ''}inconnue.`))
			return finishCommand(reAsk)
		}

	// Si la commande est "help"
	if(commandObject.name == "help"){
		// Obtenir toutes les commandes
		allHelpCommand = allCommands

		// Enlever tout les aliases qui commence par "get-", "set-", "create-" ou "delete-"
		for(var i = 0; i < allHelpCommand.length; i++){
			if(allHelpCommand[i].aliases.length > 0){
				for(var j = 0; j < allHelpCommand[i].aliases.length; j++){
					if(allHelpCommand[i].aliases[j].startsWith("get-") || allHelpCommand[i].aliases[j].startsWith("set-") || allHelpCommand[i].aliases[j].startsWith("create-") || allHelpCommand[i].aliases[j].startsWith("delete-")){
						allHelpCommand[i].aliases.splice(j, 1)
					}
				}
			}
		}

		// Afficher l'aide
		console.log(allHelpCommand.map(command => {
			return `   ${chalk.yellow(command.name)} ${(command.aliases.length > 0) ? `(${command.aliases.join(', ')}) ` : ''}: ${command.description}`
		}).join('\n'))

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk);
	}

	// Si la commande est "exit"
	if(commandObject.name == "exit"){
		process.exit()
	}

	// Si la commande est "exec"
	if(commandObject.name == "exec"){
		// Si l'argument est un lien
		if(args[0]?.startsWith("http")){
			// Demander une confirmation
			if(!await confirm(`Voulez-vous exécuter le lien ${chalk.yellow(args[0])} ?`, false)) return finishCommand(reAsk)

			// Obtenir le contenu du lien
			var response = await fetch(args.join(' ')).then(res => res.text()).catch(err => { return `console.log(chalk.red("Erreur : ${err.message || err}"))` })

			// Si on a pas de contenu
			if(!response) return console.log(chalk.red("Erreur : Impossible de récupérer le contenu du lien."))

			// Obtenir un array avec chaque commande, espacé par un saut de ligne
			var commands = response.split('\n')

			// Enlever certaines commande de l'array
			for(var i = 0; i < commands.length; i++){
				// Si la ligne commence par un #
				if(commands[i]?.replace(/\s/g, '')?.startsWith('#')){
					commands.splice(i, 1)
				}
				// Si la ligne commence par un //
				if(commands[i]?.replace(/\s/g, '')?.startsWith('//')){
					commands.splice(i, 1)
				}
				// Si la ligne est vide
				if(commands[i]?.replace(/\s/g, '')?.trim() == ''){
					commands.splice(i, 1)
				}
			}

			// Obtenir un string avec toutes les commandes
			var codeToExec = commands.join('\n')

			// Vérifier si le code ne contient pas certains élements sensibles
				// Préparer une variable
				var sensitiveElements = []

				// Modifier le code pour le mettre en toLowerCase
				lower_codeToExec = codeToExec.toLowerCase()

				// Vérifier le code
				if(lower_codeToExec.includes('child_process')) sensitiveElements.push('Exécution de commande à l\'échelle du système')
				if(lower_codeToExec.includes('require(') || lower_codeToExec.includes('require (')) sensitiveElements.push('Importation de modules')
				if(lower_codeToExec.includes('fs.')) sensitiveElements.push('Lecture/écriture de fichiers')
				if(lower_codeToExec.includes('fetch(') || lower_codeToExec.includes('fetch (')) sensitiveElements.push('Requête HTTP')
				if(lower_codeToExec.includes('eval(') || lower_codeToExec.includes('eval (')) sensitiveElements.push('Surévaluation de code')
				if(lower_codeToExec.includes('cached_client') || lower_codeToExec.includes('discord.')) sensitiveElements.push('Utilisation de Discord')
				if(codeToExec.includes('runCommand(') || codeToExec.includes('runCommand (')) sensitiveElements.push('Exécution de commande à l\'échelle du shell')

				// Si on a des éléments sensibles
				if(sensitiveElements.length > 0){
					// Afficher les éléments sensibles
					console.log(chalk.red(`\nVous avez tenté d'exécuter le code suivant :`))
					console.log("─".repeat(parseInt(process.stdout.columns)))
					console.log(chalk.dim(codeToExec))
					console.log("─".repeat(parseInt(process.stdout.columns)))
					console.log(chalk.red(`Ce code contient des éléments potentiellements dangereux :`))
					console.log(sensitiveElements.map(element => `  • ${element}`).join('\n') + '\n')

					// Redemander une confirmation
					if(!await confirm(`Êtes-vous sûr de vouloir exécuter le code ?`, false)) return finishCommand(reAsk)
				}

			// Evaluer le texte
				// Préparer le résultat dans une variable
				var evaluation = null;

				// Essayer d'évaluer le texte
				try {
					evaluation = eval(codeToExec)
				} catch(err) {
					evaluation = chalk.red(err)
				}
		}

		// Sinon
		else {
			// Si on a rien entrer
			if(args.length == 0){
				async function askCode(){
					// Fonction "exit" pour sortir depuis l'exec
					function exit(){
						console.log(chalk.red("Vous avez quitté l'environnement d'exécution."))
						return "stop_exec_environnement"
					}

					// Demander un texte avec Inquirer
					var codeToExec = await inquirer.prompt([
						{
							type: 'input',
							name: 'code',
							message: chalk.yellow('$'),
							prefix: '',
							validate: function(value){
								if(value.length < 1) return 'Vous devez entrer un code à exécuter.'
								return true
							}
						}
					])

					// Evaluer le code
						// Préparer le résultat dans une variable
						var evaluation = null;

						// Essayer d'évaluer le code
						try {
							evaluation = eval(codeToExec.code)
						} catch(err) {
							evaluation = chalk.red(err)
						}

						// Afficher le résultat
						console.log(evaluation)
						if(evaluation !== "stop_exec_environnement") askCode()
						if(evaluation === "stop_exec_environnement") return finishCommand(reAsk)
					}; askCode();

			// Sinon, on suppose que c'est une commande
			} else {
				// Evaluer le code
					// Préparer le résultat dans une variable
					var evaluation = null;

					// Essayer d'évaluer le code
					try {
						evaluation = eval(args.join(' '))
					} catch(err) {
						evaluation = chalk.red(err)
					}

					// Afficher le résultat
					console.log(evaluation)

				// Appeler la fonction pour qu'on puisse entrer une commande
				return finishCommand(reAsk)
			}
		}
	}

	// Si la commande est "clear"
	if(commandObject.name == "clear"){
		console.clear()
		finishCommand(reAsk)
	}

	// Si la commande est "version"
	if(commandObject.name == "version"){
		console.log(require('./package.json').version)
		finishCommand(reAsk)
	}

	// Si la commande est "echo"
	if(commandObject.name == "echo"){
		// Réunir tout les arguments
		var message = args.join(' ')

		// Obtenir les arguments entre accolades
		var message = message.replace(/{([^}]+)}/g, (match, p1) => {
			// Fichier du dossier src
			if(p1.startsWith('src')){
				var fileContent = 'Fichier inconnu'
				try { fileContent = fs.readFileSync(path.join(__dirname, p1), 'utf8') } catch(e) { return 'Fichier inconnu' }
				return fileContent
			}

			// Fichier de la configuration
			if(p1.startsWith('config')){
				var fileContent = 'Fichier inconnu'
				try { fileContent = fs.readFileSync(path.join(getConfigPath(), p1.replace('config/', '')), 'utf8') } catch(e) { return 'Fichier inconnu' }
				return fileContent
			}

			// Sinon on retourne l'argument sans accolades
			else return p1
		})

		// Afficher le message
		console.log(message)

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "ls"
	if(commandObject.name == "ls"){
		// Préparer la liste des dossiers à vérifier
		var folders = [
			path.join(__dirname, 'src'),
			getConfigPath()
		]

		// Obtenir la liste des fichiers/dossiers dans chacun des dossiers, et l'afficher
		folders.forEach(folder => {
			var files = fs.readdirSync(folder)
			console.log(chalk.yellow(path.basename(folder).replace('discordshell','config') + '/') + '\n' + files.map(file => `   ${file}`).join('\n'))
		})

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "connect"
	if(commandObject.name == "connect"){
		// Si on a pas d'argument
		if(args.length == 0) return console.log(chalk.red(`Argument invalide. Exemple : `) + chalk.yellow('login <token>')) & finishCommand(reAsk)

		// Afficher un avertissement
		console.log(`\nL'utilisation d'un compte Discord autre qu'un robot est interdite selon les TOS.`)
		console.log(`Votre compte peut être suspendu définitivement par l'équipe de Discord.`)
		console.log(`Dans ce cas, le créateur de Discord Shell n'est aucunement responsable.\n`)

		// Demander une confirmation
		if(!await confirm(`Se connecter avec ${chalk.yellow(args[0])} ?`, true)) return finishCommand(reAsk)

		// Obtenir des informations sur le compte Discord
		var discordInfo = await getDiscordAccountInfo_fromAPI(args[0])

		// Si le compte a eu une erreur
		if(discordInfo.message) return console.log(chalk.red(discordInfo.message)) & finishCommand(reAsk)

		// Enregistrer le compte
		writeFile(path.join(getConfigPath(), 'token.txt'), args[0], () => {
			console.log(`${chalk.green(`${discordInfo.username}#${discordInfo.discriminator}`)} enregistré.`)
			finishCommand(reAsk)
		})
	}

	// Si la commande est "disconnect"
	if(commandObject.name == "disconnect"){
		// Afficher un avertissement
		console.log(`\nVotre compte Discord sera supprimé de la configuration de Discord Shell.`)
		console.log(`Vous pourrez vous reconnecter plus tard en utilisant votre token.\n`)

		// Demander une confirmation
		if(!await confirm(`Se déconnecter ?`, true)) return finishCommand(reAsk)

		// Donner l'ancien token
		console.log(`Votre token était : ${chalk.cyan(fs.readFileSync(path.join(getConfigPath(), 'token.txt')))}`)

		// Enregistrer le compte
		writeFile(path.join(getConfigPath(), 'token.txt'), '', () => {
			console.log(`Déconnecté avec succès.`)
			finishCommand(reAsk)
		})
	}

	// Si la commande est "account"
	if(commandObject.name == "account"){
		// Préparer une variable
		var stopThisCommand = false

		// Se connecter
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Une fois connecté
			spinner.stop()

		// Obtenir les informations du compte
		var discordInfo = cached_client.user

		// Si on a le flag "hideSensitive"
		if(args.includes('--hideSensitive')){
			discordInfo.discriminator = undefined
			discordInfo.id = undefined
			discordInfo.email = undefined
			discordInfo.phone = undefined
		}

		// Afficher les informations
		console.log(chalk.green(`${discordInfo.username}${(discordInfo.discriminator) ? '#' + discordInfo.discriminator : ''}`))
		if(discordInfo.id) console.log(`   ID : ${chalk.cyan(discordInfo.id || "Inconnu")}`)
		if(discordInfo.bio) console.log(`   Bio : ${chalk.cyan(discordInfo.bio)}`)
		if(discordInfo.bot === false) console.log(`   Mail : ${chalk.cyan(discordInfo.email || "Aucun")}`)
		if(discordInfo.phone) console.log(`   Téléphone : ${chalk.cyan(discordInfo.phone)}`)
		if(discordInfo.premium_type) console.log(`   Abonnement : ${chalk.cyan(discordInfo?.premium_type?.toString()?.replace("0","Aucun")?.replace("1","Nitro Classic")?.replace("2","Nitro"))}`)
		if(discordInfo.bot === true) console.log(chalk.dim(`Vous êtes un bot`))

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "select"
	if(commandObject.name == "select"){
		// Obtenir des informations à partir de l'argument
		var info = args.join(' ').toLowerCase().split(':')

		// Si le type choisi est "parent"
		if(info[0] == "parent"){
			// Si il n'y a pas de sélection
			if(!active_selection?.data) return console.log(chalk.red(`Vous devez déjà avoir fait une sélection pour utiliser le type "parent".`)) & finishCommand(reAsk)

			// Si le type de la sélection actuelle est "channel"
			if(active_selection.type === 'channel') return runCommand(`select guild:${active_selection?.data?.guild?.id}`, reAsk)

			// Si le type de la sélection actuelle est "guild"
			if(active_selection.type === 'guild') return runCommand(`select user:${active_selection?.data?.ownerID}`, reAsk)

			// Ah on a pas trouvé de parent...
			return console.log(chalk.red(`Aucun parent n'a été trouvé pour la sélection actuelle.`)) & finishCommand(reAsk)
		}

		// Si l'argument n'est pas valide
		if(info.length != 2) return console.log(chalk.red(`L'argument n'est pas valide. Exemple : `) + chalk.yellow('select user:277825082334773251')) & finishCommand(reAsk)

		// Si le type n'est pas valide
		if(!['user','guild','channel','group'].includes(info[0])) return console.log(chalk.red(`Le type n'est pas valide. Exemple : `) + chalk.yellow('select user:277825082334773251')) & finishCommand(reAsk)

		// Se connecter
			// Préparer une variable
			var stopThisCommand = false

			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Une fois connecté
			spinner.stop()

		// Obtenir des informations sur l'identifiant et les ajouter à la sélection
		active_selection.data = await getFromId(info[1], info[0])

		// Obtenir le type de sélection en user-friendly
		var userFriendlyType = info[0].replace('guild', 'serveur').replace('channel', 'salon').replace('user', 'utilisateur').replace('group', 'groupe')

		// Si il n'y a pas d'informations
		if(!active_selection.data){
			// Afficher un message d'erreur
			if(info[0] == 'user') console.log(chalk.red(`Identifiant ${chalk.green(`${info[1]}`)} invalide en tant qu'${chalk.green(userFriendlyType)}.`));
			else console.log(chalk.red(`Identifiant ${chalk.green(`${info[1]}`)} invalide en tant que ${chalk.green(userFriendlyType)}.`));

			// Vider la sélection
			active_selection.data = undefined
			active_selection.id = undefined
			active_selection.type = undefined

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Si le type choisi n'est pas le même que le résultat
		if(info[0] == 'text' && active_selection.data.type == 'group') return runCommand('select group:' + active_selection.data.id, reAsk)
		if(info[0] == 'group' && active_selection.data.type == 'text') return runCommand('select channel:' + active_selection.data.id, reAsk)

		// Modifier la sélection
		active_selection.type = info[0]
		active_selection.id = info[1]

		// Afficher comme quoi c'est bon
		if(info[0] == 'user') console.log(`Identifiant ${chalk.green(`${active_selection?.id}`)} sélectionné en tant qu'${chalk.green(userFriendlyType)}.`);
		else console.log(`Identifiant ${chalk.green(`${active_selection?.id}`)} sélectionné en tant que ${chalk.green(userFriendlyType)}.`)

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "active"
	if(commandObject.name == "active"){
		// Si il n'y a aucune sélection active
		if(!active_selection.data){
			// Afficher un message d'erreur
			console.log(chalk.red(`Aucune sélection n'est active. Utiliser la commande `) + chalk.yellow('select') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Faire une copie de la sélection active
		var active_selection_copy = active_selection

		// Afficher la sélection
		if(active_selection_copy.type == 'user'){
			// Enlever certaines informations si il y a eu le flag --hideSensitive
			if(args.includes('--hideSensitive')){
				active_selection_copy.data.discriminator = undefined
				active_selection_copy.data.id = undefined
			}

			// Afficher les infos
			console.log(chalk.green(`${active_selection_copy?.data?.username}${(active_selection_copy?.data?.discriminator) ? '#' + active_selection_copy?.data?.discriminator : ''}`))
			if(active_selection_copy?.data?.id) console.log(`   ID : ${chalk.cyan(active_selection_copy?.data?.id || "Inconnu")}`)
			if(active_selection_copy?.data?.bot === true) console.log(`   Type : ${chalk.cyan('Bot')}`)
		}
		if(active_selection_copy.type == 'guild'){
			// Enlever certaines informations si il y a eu le flag --hideSensitive
			if(args.includes('--hideSensitive')){
				active_selection_copy.data.id = undefined
				active_selection_copy.data.ownerID = undefined
			}

			// Afficher les infos
			console.log(chalk.green(`${active_selection_copy?.data?.name}`))
			if(active_selection_copy?.data?.id) console.log(`   ID : ${chalk.cyan(active_selection_copy?.data?.id || "Inconnu")}`)
			if(active_selection_copy?.data?.ownerID) console.log(`   Propriétaire : ${chalk.cyan(active_selection_copy?.data?.ownerID || "Inconnu")}`)
			if(active_selection_copy?.data?.memberCount) console.log(`   Nombre de membres : ${chalk.cyan(active_selection_copy?.data?.memberCount || "Inconnu")}`)
			if(active_selection_copy?.data?.joinedTimestamp) console.log(`   Rejoint le : ${chalk.cyan(moment(active_selection_copy?.data?.joinedTimestamp).format("DD/MM/YYYY") || "Inconnu")}`)

			// Afficher les salons
			if(active_selection_copy?.data?.channels?.cache && active_selection_copy?.data?.channels?.cache?.array().length){
				// Séparateur
				console.log(chalk.dim("─").repeat(parseInt(process.stdout.columns)))

				// Mettre dans une variable tout les salons
				var channels = active_selection_copy?.data?.channels?.cache?.array()

				// Trier pour mettre les salons vocaux à la fin
				channels.sort((a, b) => {
					if(a.type == 'text' && b.type == 'voice') return -1
					if(a.type == 'voice' && b.type == 'text') return 1
					return 0
				})

				// Afficher les salons
				console.log(chalk.green(`Salons :`))
				channels?.forEach(channel => {
					// Si c'est une catégorie, annuler
					if(channel?.type == 'category') return;

					// Obtenir le signe devant le nom du salon
					var channelType = channel?.type
					var channelTypeSign = { 'text': '#', 'voice': '🔊 ', 'news': '📰 ', 'store': '🛒 ' }[channelType]

					// Enlever certaines informations si il y a eu le flag --hideSensitive
					if(args.includes('--hideSensitive')){
						channel.id = undefined
					}

					// Afficher le salon
					console.log(`   • ${chalk.cyan(channelTypeSign + '' + channel?.name)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${channel?.id})`)}`)
				})
			}
		}
		if(active_selection_copy.type == 'channel'){
			// Enlever certaines informations si il y a eu le flag --hideSensitive
			if(args.includes('--hideSensitive')){
				active_selection_copy.data.id = undefined
				active_selection_copy.data.guild.id = undefined
				active_selection_copy.data.topic = undefined
			}

			// Obtenir le signe devant le nom du salon
			var channelType = active_selection_copy?.data?.type
			var channelTypeSign = { 'text': '#', 'voice': '🔊 ', 'category': '📁 ', 'news': '📰 ', 'store': '🛒 ' }[channelType]

			// Afficher les infos
			console.log(chalk.green(`${(channelTypeSign)}${active_selection_copy?.data?.name}`))
			if(active_selection_copy?.data?.id) console.log(`   ID du salon : ${chalk.cyan(active_selection_copy?.data?.id || "Inconnu")}`)
			if(active_selection_copy?.data?.guild?.id) console.log(`   ID du serveur : ${chalk.cyan(active_selection_copy?.data?.guild?.id || "Inconnu")}`)
			if(active_selection_copy?.data?.topic) console.log(`   Sujet : ${chalk.cyan(active_selection_copy?.data?.topic || "Inconnu")}`)
			if(active_selection_copy?.data?.nsfw == true) console.log(`   NSFW : ${chalk.cyan('Oui')}`)
		}
		if(active_selection_copy.type == 'group'){
			// Fetch l'API de Discord pour obtenir des informations sur le groupe
				// Obtenir le token
				var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt'))

				// Obtenir l'autorisation
				if(cached_client.user.bot === true) var authorization = `Bot ${token}`; else var authorization = token;

				// Obtenir des informations sur le groupe
				var response = await fetch(`https://discord.com/api/v9/channels/${active_selection_copy?.data?.id}`, { method: 'GET', headers: { "Authorization": authorization } }).then(res => res.text())

				// Tenter de parse en JSON
				try {
					response = JSON.parse(response)
				} catch(err){
					response = response
				}

				// Si il y a eu une erreur
				if(response?.code){
					console.log(chalk.red(response?.message || response?.code || response))
					return finishCommand(reAsk)
				}

			// Enlever certaines informations si il y a eu le flag --hideSensitive
			if(args.includes('--hideSensitive')){
				response.id = undefined
			}

			// Afficher les infos
				// Nom et identifiant du groupe
				console.log(chalk.green(`${response.name || "Inconnu"}`))
				if(response?.id) console.log(`   ID du groupe : ${chalk.cyan(response?.id || "Inconnu")}`)

				// Séparateur
				console.log(chalk.dim("─").repeat(parseInt(process.stdout.columns)))

				// Afficher les membres
				console.log(chalk.green(`${response?.recipients?.length} membres :`))
				response.recipients?.forEach(member => {
					// Enlever certaines informations si il y a eu le flag --hideSensitive
					if(args.includes('--hideSensitive')){
						member.id = undefined
						member.discriminator = undefined
					}

					// Afficher le membre
					console.log(`   • ${chalk.cyan.bold(member.username)}${(args.includes('--hideSensitive')) ? '' : chalk.cyan('#' + member.discriminator)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${member.id})`)}`)
				})
		}

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "friendlist"
	if(commandObject.name == "friendlist"){
		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Obtenir la liste d'amis
		var friends = await getFriends(token)

		// Si ce n'est pas un array
		if(!Array.isArray(friends)) return console.log(chalk.red(friends)) & finishCommand(reAsk)

		// Afficher les amis
		console.log(`${chalk.green(`${friends?.length} amis`)} :`)
		console.log(friends.map(friend => `   • ${chalk.bold.cyan(friend?.user?.username)}${(args.includes('--hideSensitive')) ? '' : chalk.cyan('#' + friend?.user?.discriminator)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${friend?.user?.id})`)}`).join('\n'))

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "serverlist"
	if(commandObject.name == "serverlist"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Obtenir la liste des serveurs
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Modifier le spinner
			spinner.text = 'Récupération des serveurs...'

			// Obtenir la liste des serveurs
			var servers = cached_client.guilds.cache.array()

			// Si le serveur n'est pas avaible, le fetch
			servers.forEach(server => {
				if(!server.available) server.fetch()
			})

			// Arrêter le spinner
			spinner.stop()

			// Afficher les serveurs
			console.log(`${chalk.green(`${servers.length} serveurs`)} :`)
			console.log(servers.map(server => `   • ${chalk.cyan(server.name)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${server.id})`)}`).join('\n'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			finishCommand(reAsk)
	}

	// Si la commande est "memberlist"
	if(commandObject.name == "memberlist"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Si il n'y a aucune sélection active
		if(!active_selection.data){
			// Afficher un message d'erreur
			console.log(chalk.red(`Aucune sélection n'est active. Utiliser la commande `) + chalk.yellow('select') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Faire une copie de la sélection active
		var active_selection_copy = active_selection

		// Se connecter
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Arrêter le spinner
			spinner.text = 'Récupération des membres...'

			// Obtenir la liste des membres
			var members = cached_client?.guilds?.cache?.get(active_selection_copy.data.id)?.members?.cache?.array()

			// Si il n'y a pas de membre
			if(!members){
				// Modifier le spinner
				spinner.stop()

				// Afficher une erreur
				console.log(chalk.red(`Aucun membre n'est présent dans la sélection.`))

				// Appeler la fonction pour qu'on puisse entrer une commande
				return finishCommand(reAsk)
			}

			// Si la liste de membre dans la variable members, n'est pas du même nombre que dans la sélection active
			if(members.length != active_selection_copy.data.memberCount){
				// Empêcher de continuer la commande
				stopThisCommand = true

				// Refetch pour ajouter toutes les personnes non présentes dans le cache
				await cached_client.guilds.cache.get(active_selection_copy.data.id).members.fetch()
				return runCommand(`${command} ${args.join(' ')}`, reAsk)
			}

			// Si on dois s'arrêter
			if(stopThisCommand === true) return;

			// Arrêter le spinner
			spinner.stop()

			// Afficher les membres
			console.log(`${chalk.green(`${members.length} membres`)} :`)
			console.log(members.map(member => `   • ${chalk.bold.cyan(member?.user?.username)}${(args.includes('--hideSensitive')) ? '' : chalk.cyan('#' + member?.user?.discriminator)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${member?.id})`)}`).join('\n'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			finishCommand(reAsk)

			// En arrière plan, si le flag "--notWhois" n'est pas activé
			if(!args.includes('--notWhois')){
				// Obtenir le user agent à utiliser pour les requêtes
				var userAgent = `DiscordShell/${require('./package.json').version} (${require('os').type() || require('os').platform() || 'UnknownPlatform'})`

				// Pour chaque membre du serveur
				members.forEach(async (member,i) => {
					// Faire une requête vers WhoIs pour enregistrer leur pseudo dans l'historique de pseudo
					setTimeout(async () => {
						await fetch(`https://discord-whois.johanstickman.com/api/getDiscord?discordId=${member.id}`, { headers: { 'User-Agent': userAgent } })
					}, i * 800);
				})
			}
	}

	// Si la commande est "messagelist"
	if(commandObject.name == "messagelist"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Si il n'y a aucune sélection active
		if(!active_selection.data){
			// Afficher un message d'erreur
			console.log(chalk.red(`Aucune sélection n'est active. Utiliser la commande `) + chalk.yellow('select') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Faire une copie de la sélection active
		var active_selection_copy = active_selection

		// Se connecter
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Arrêter le spinner
			spinner.text = 'Récupération des messages...'

			// Obtenir la liste des derniers messages sur le salon
				// Préparer une variable
				var messages;

				// Obtenir les messages
				if(active_selection_copy.type == 'group' || active_selection_copy?.data?.dmChannelId){
					// Obtenir l'autorisation
					if(cached_client.user.bot === true) var authorization = `Bot ${token}`; else var authorization = token;

					// Faire une requête vers l'API de Discord
					var response = await fetch(`https://discord.com/api/v9/channels/${active_selection_copy?.data?.dmChannelId || active_selection_copy?.data?.id}/messages`, { headers: { "Authorization": authorization } }).then(res => res.text())

					// Tenter de parse en JSON
					try {
						messages = JSON.parse(response)
					} catch(err){
						messages = response
					}

					// Arrêter le spinner
					spinner.stop()

					// En cas d'erreur
					if(messages.message || messages.code) return console.log(messages.message || messages.code || messages)

					// Trier les messages par ordre chronologique
					messages.sort((a,b) => {
						return new Date(a.timestamp) - new Date(b.timestamp)
					})
				} else {
					try {
						messages = await cached_client?.channels?.cache?.get(active_selection_copy.data.id)?.messages?.fetch({ limit: (process.stdout.rows * 2) || 25 })
						messages = messages?.array()

						messages = messages.sort((a, b) => parseInt(a.createdTimestamp) - parseInt(b.createdTimestamp))
					} catch(err){ messages = [] }
				}

			// Si il n'y a pas de messages
			if(!messages || !messages.length){
				// Modifier le spinner
				spinner.stop()

				// Afficher une erreur
				console.log(chalk.red(`Aucun messages n'est présent dans la sélection.`))

				// Appeler la fonction pour qu'on puisse entrer une commande
				return finishCommand(reAsk)
			}

			// Arrêter le spinner
			spinner.stop()

			// Afficher les messages
			console.log(`${chalk.green(`${messages.length} messages`)} :`)
			console.log(messages.map(message => `   • ${chalk.bold.cyan(message?.author?.username)}${(args.includes('--hideSensitive')) ? '' : chalk.cyan('#' + message?.author?.discriminator)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (${message?.author?.id})`)} : ${message.content.replace(/\n/g,'    ')}`).join('\n'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			finishCommand(reAsk)
	}

	// Si la commande est "dmlist"
	if(commandObject.name == "dmlist"){
		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Obtenir la liste des dms et groupe
		var list = await getDms(token)

		// Si ce n'est pas un array
		if(!Array.isArray(list?.dms)) return console.log(chalk.red(list?.dms || list)) & finishCommand(reAsk)
		if(!Array.isArray(list?.groups)) return console.log(chalk.red(list?.groups || list)) & finishCommand(reAsk)

		// Afficher les résultats
			// Afficher les groupes
			if(list?.groups) console.log(`${chalk.green(`${list?.groups.length} groupes`)} :`)
			if(list?.groups) console.log(list?.groups?.map(group => `   • ${chalk.bold.cyan(group?.name || 'Inconnu')}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${group?.id})`)}\n      • ${group?.recipients.map(r => `${chalk.bold(r.username)}${(args.includes('--hideSensitive')) ? '' : '#' + r?.discriminator}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${r?.id})`)}`).join('\n      • ')}`).join('\n'))

			// Séparateur
			if(list?.dms && list?.groups) console.log(chalk.dim("─").repeat(parseInt(process.stdout.columns)))

			// Afficher les dms
			if(list?.dms) console.log(`${chalk.green(`${list?.dms.length} DMs`)} :`)
			if(list?.dms) console.log(list?.dms?.map(dm => `   • ${chalk.bold.cyan(dm?.username)}${(args.includes('--hideSensitive')) ? '' : chalk.cyan('#' + dm?.discriminator)}${(args.includes('--hideSensitive')) ? '' : chalk.dim(`  (ID : ${dm?.id})`)}`).join('\n'))

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "message"
	if(commandObject.name == "message"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Vérifier si un argument est donné
		var messageContent = args.join(' ')

		// Si il n'y a pas de message
		if(!messageContent){
			// Afficher un message d'erreur
			console.log(chalk.red(`Argument invalide. Exemple : `) + chalk.yellow('message <contenu de votre message>') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Si il n'y a aucune sélection active
		if(!active_selection.data){
			// Afficher un message d'erreur
			console.log(chalk.red(`Aucune sélection n'est active. Utiliser la commande `) + chalk.yellow('select') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Se connecter
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

		// Modifier le spinner
		spinner.text = 'Envoi du message...'

		// Préparer les options du message
		var messageOptions = {}

		// Si il y a l'argument --tts
		if(args.includes('--tts')) messageOptions.tts = true

		// Ajouter le contenu du message dans les options
		messageOptions.content = messageContent.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace('--tts', '')

		// Si la sélection est un groupe
		if(active_selection.type == 'group'){
			// Obtenir l'autorisation
			if(cached_client.user.bot === true) var authorization = `Bot ${token}`; else var authorization = token;

			// Envoyer le message
			var response = await fetch(`https://discord.com/api/v9/channels/${active_selection?.data?.dmChannelId || active_selection?.data?.id}/messages`, { method: 'POST', body: JSON.stringify(messageOptions), headers: { "Content-Type": "application/json", "Authorization": authorization } }).then(res => res.text())

			// Tenter de parse en JSON
			try {
				response = JSON.parse(response)
			} catch(err){
				response = response
			}

			// Arrêter le spinner
			spinner.stop()

			// Afficher le message
			if(!response.message && !response.code) console.log(chalk.green(`Message envoyé !`)); else console.log(response.message || response.code || response)
		} else {
			// Envoyer le message
			await active_selection?.data?.send(messageOptions)?.catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code
				spinner.fail()

				// Appeler la fonction pour qu'on puisse entrer une commande
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

			// Arrêter le spinner
			spinner.stop()

			// Afficher un message de succès
			console.log(chalk.green(`Message envoyé avec succès.`))
		}

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "leave"
	if(commandObject.name == "leave"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir le token
		var token = fs.readFileSync(path.join(getConfigPath(), 'token.txt')).toString()

		// Si il n'y a pas de token
		if(!token) return console.log(chalk.red(`Vous n'êtes pas connecté. Utiliser la commande `) + chalk.yellow('login') + chalk.red(' puis réessayer.')) & finishCommand(reAsk)

		// Si il n'y a aucune sélection active
		if(!active_selection.data){
			// Afficher un message d'erreur
			console.log(chalk.red(`Aucune sélection n'est active. Utiliser la commande `) + chalk.yellow('select') + chalk.red(' puis réessayer.'))

			// Appeler la fonction pour qu'on puisse entrer une commande
			return finishCommand(reAsk)
		}

		// Se connecter
			// Afficher un spinner
			spinner.text = 'Connexion au compte...'
			spinner.start()

			// Se connecter
			await connect().catch(err => {
				// Modifier le spinner en cas d'erreur
				spinner.text = err.message || err.code

				// Si l'erreur nous dis de réessayer, et bah go
				if(err.code == 'TRY_AGAIN'){
					// Modifier le spinner
					spinner.text = 'Nouvelle tentative : mode BOT'

					// Modifier le type de compte, et réessayer
					accountType_bot = true
					stopThisCommand = true
					return runCommand(`${command} ${args.join(' ')}`, reAsk)
				}

				// Appeler la fonction pour qu'on puisse entrer une commande
				spinner.fail()
				stopThisCommand = true
				return finishCommand(reAsk)
			})
			if(stopThisCommand === true) return;

		// Modifier le spinner
		spinner.text = 'Sortie...'

		// Quitter la sélection
		try {
			// Quitter la sélection
			await active_selection?.data?.leave()

			// Arrêter le spinner
			spinner.stop()

			// Afficher un message de succès
			console.log(chalk.green(`Sortie avec succès.`))
		} catch(err){
			// Arrêter le spinner
			spinner.stop()

			// Afficher un message d'erreur
			console.log(chalk.red(`Erreur lors de la sortie : `) + chalk.yellow(err.message || err.code || err || 'Erreur inconnu'))
		}

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}

	// Si la commande est "cli-install"
	if(commandObject.name == "cli-install"){
		// Préparer une variable
		var stopThisCommand = false

		// Obtenir la commande associé au nom du CLI sur NPM
		var commands = {
			'twitterminal': 'twitterminal',
			'ecochat-term': 'ecochat',
			'@johanstickman/ip-info': 'ip-info',
			'sendovernetwork': 'sendovernetwork',
			'betterpip': 'betterpip'
		}

		// Préparer la variable du CLI à installer
		var whatToInstall;

		// Si un argument a été donné, le vérifier
		if(args.length > 0){
			// Vérifier que le nom existe
			if(!commands[args[0]]) console.log(`Cette commande n'existe pas, affichage d'une liste...`)

			// Sinon, définir le nom de la commande comme CLI à installer
			else whatToInstall = args[0]
		}

		// Demander quel CLI installer
		if(!whatToInstall) whatToInstall = await inquirer.prompt([
			{
				type: 'list',
				name: 'name',
				message: 'Quel CLI installer ?',
				choices: [
					{
						name: 'Twitterminal',
						value: 'twitterminal'
					},
					{
						name: 'Ecochat',
						value: 'ecochat-term'
					},
					{
						name: 'IP Info',
						value: '@johanstickman/ip-info'
					},
					{
						name: 'Send Over Network',
						value: 'sendovernetwork'
					},
					{
						name: 'BetterPip',
						value: 'betterpip'
					}
				]
			}
		])
		if(whatToInstall && whatToInstall.name) whatToInstall = whatToInstall.name

		// Si il n'y a pas de réponse
		if(!whatToInstall?.length) return finishCommand(reAsk)

		// Utiliser NPM pour installer le CLI avec child_process
		require('child_process').execSync(`npm install ${whatToInstall} --global`, { stdio: 'inherit' })

		// Dire que l'installation est terminé
		console.log(`${chalk.green(`Installation terminé !`)} Utiliser la commande "${chalk.cyan(commands[whatToInstall])}" dans votre vrai shell (pas dans Discord Shell du coup) pour l'utiliser.`)
		console.log(chalk.dim(`Utiliser la commande "npm uninstall --global ${commands[whatToInstall]}" pour désinstaller le CLI.`))

		// Appeler la fonction pour qu'on puisse entrer une commande
		finishCommand(reAsk)
	}
}
