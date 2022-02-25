// Importer quelques librairies
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Préparer le contenu du fichier MessageCreate.js
const MessageCreate_file = `"use strict";const Action=require("./Action"),{Events:Events}=require("../../util/Constants");class MessageCreateAction extends Action{handle(e){this.client;return{}}}module.exports=MessageCreateAction;`

// Fonction pour vérifier un fichier
module.exports.checkFile = function(file){
	// Obtenir le chemin de discord.js
	const discordPath = path.join(__dirname, '..', 'node_modules', 'discord.js', 'src', 'client', 'actions', 'MessageCreate.js');

	// Obtenir le contenu du fichier
	const discordContent = fs.readFileSync(discordPath, 'utf8');

	// Si le fichier n'existe pas
	if(!discordContent) return { error: true, message: `Le fichier "${discordPath}" n'existe pas : DISCORDJS_MESSAGE_CREATE_PATCH_ERROR` };

	// Si le fichier n'est pas le même que celui attendu
	if(discordContent !== MessageCreate_file) return { error: true, message: "GO_PATCH_DISCORDJS_MESSAGE_CREATE" };

	// Sinon
	return true;
}

// Fonction pour patcher Discord.js
module.exports.patchDiscord = function(discord){
	// Afficher l'état du patch
	console.log(chalk.yellow("\nDiscord.js a besoin d'être patch avant d'utiliser Discord Shell..."));

	// Obtenir le chemin de discord.js
	const discordPath = path.join(__dirname, '..', 'node_modules', 'discord.js', 'src', 'client', 'actions', 'MessageCreate.js');

	// Obtenir le contenu du fichier
	const discordContent = fs.readFileSync(discordPath, 'utf8');

	// Si le fichier n'existe pas
	if(!discordContent) throw new Error(`Le fichier "${discordPath}" n'existe pas : DISCORDJS_MESSAGE_CREATE_PATCH_ERROR`);

	// Définir le contenu du fichier par celui qu'on souhaite
	fs.writeFileSync(discordPath, MessageCreate_file, 'utf8');

	// Afficher l'état du patch
	console.log(chalk.green("Discord.js a été patché avec succès ! Un redémarrage de Discord Shell est nécessaire pour que les modifications prennent effet."));

	// Arrêter le processus
	process.exit();
}