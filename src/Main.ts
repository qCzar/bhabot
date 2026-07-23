import * as dotenv from "dotenv";
dotenv.config ();

import { Settings } from "luxon";
import * as Discord from "discord.js";
import Hapi from "@hapi/hapi";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";

import { env, initSettings } from "./environment";
import { type World } from "./world";
import { logger } from "./logger";
import { just, tap } from "./prelude";
import { handleMessageCreate, initializeMultipost } from "./features/multipost";
import { handleOnboardingMemberAdd, handleOnboardingMessageCreate, handleOnboardingMessageUpdate } from "./features/onboarding";

import * as Legacy from "./deprecating/legacy_instance";
import * as Meetup from "./commands/meetup/RegisterMeetup";

// slash commands
import { aqi } from "./interactions/aqi";
import { changelog, getLogEmbed } from "./interactions/changelog";
import { christmas } from "./interactions/christmas";
import { define } from "./interactions/define";
import { pong } from "./interactions/pong";
import * as sanjose from "./interactions/reddit-sanjose";
import { tldr } from "./interactions/tldr";
import { version } from "./interactions/version";
import { mod } from "./interactions/mod";
import { activity } from "./interactions/activity";
import { throwdown } from "./interactions/throwdown";
import { meetup } from "./interactions/meetup";
import { boredbot } from "./interactions/boredbot";
import { interaction } from "./interaction";

const log = logger ("main");

const interactions: interaction[] = [
   aqi,
   changelog,
   christmas,
   define,
   pong,
   tldr,
   version,
   mod,
   activity,
   throwdown,
   meetup,
   boredbot
];



const registerSlashCommands = async() => {
   const { DISCORD_TOKEN, DISCORD_CLIENT_ID, SERVER_ID } = env;

   const rest = new REST ({ version: "9" }).setToken (DISCORD_TOKEN);
   
   return rest.put (
      Routes.applicationCommands (DISCORD_CLIENT_ID),
      { body: interactions.flatMap (it => it.config) }
   ).then (_ => { log.debug ("Slash Commands Registered"); });
};

const makeDiscordClient = () => new Discord.Client ({
   intents: [
      Discord.GatewayIntentBits.Guilds,
      Discord.GatewayIntentBits.GuildMessages,
      Discord.GatewayIntentBits.GuildMessageReactions,
      Discord.GatewayIntentBits.GuildMembers,
      Discord.GatewayIntentBits.DirectMessages,
      Discord.GatewayIntentBits.MessageContent
   ],
   partials: [
      Discord.Partials.Message,
      Discord.Partials.Channel,
      Discord.Partials.Reaction
   ]
});

const createWorld = async(): Promise<World> => {
   const mongodbClient = await MongoClient
      .connect (env.MONGO_URL, { useUnifiedTopology: true })
      .then (tap (_ => { log.info ("MongoDB is connected"); }));
   
   const mongodb = mongodbClient.db();
   await initSettings(mongodb);
   log.info("Settings initialized from MongoDB");

   const token = env.DISCORD_TOKEN;
   const client = makeDiscordClient ();
   const discord = new Promise<Discord.Client> ((resolve, reject) => {
      client.on ("ready", () => resolve (client));
      client.login (token)
         .then (tap (_ => { log.info ("Logged in", { tag: client.user?.tag, version: process.env.npm_package_version ?? "" }); }))
         .catch (reject);
   });

   const hapiServer = Hapi.server ({
      port:   env.HTTP_PORT,
      host:   "0.0.0.0",
      routes: { cors: true }
   });

   const hapi = hapiServer
      .start ()
      .then (just (hapiServer))
      .then (tap (_ => { log.info ("Hapi has started", { port: env.HTTP_PORT }); })); 

   return Promise
      .all ([discord, hapi])
      .then (([discord, hapi]): World => ({ 
         discord, 
         mongodb,
         hapi 
      }));
};

const handleCommandInteraction = (interaction: Discord.ChatInputCommandInteraction, world: World) => {
   const handlers = interactions
      .filter (it => it.config.some (c => c.name === interaction.commandName))
      .map (it => it.handle);

   handlers.forEach (f => f (interaction, world));
};

const handleAutocompleteInteraction = (interaction: Discord.AutocompleteInteraction, world: World) => {
   const handlers = interactions
      .filter (it => it.config.some (c => c.name === interaction.commandName) && it.autocomplete)
      .map (it => it.autocomplete!);

   handlers.forEach (f => f (interaction, world));
};

// error handling

const error_log_file = path.join (__dirname, "..", "error.log");

process
   .on ("unhandledRejection", (reason, p) => {
      // eslint-disable-next-line no-console
      console.log (reason, "Unhandled rejection at promise", p);
   })
   .on ("uncaughtException", (err) => {
      // eslint-disable-next-line no-console
      console.error (err, "uncaught exception thrown");
      const message = (err instanceof Error && err.stack) ? err.stack : "Unknown";
      fs.writeFileSync (error_log_file, message, "utf8");
      process.exit (1);
   });

void async function main() {
   Settings.defaultZoneName = "America/Los_Angeles"; 

   const world = await createWorld ();
   await registerSlashCommands ();
   
   await initializeMultipost (world);

   world.hapi.route ([
      ...Meetup.routes,
      sanjose.webhook (world.discord)
   ]);
   
   // legacy initialization
   Legacy.initialize (world);
   Meetup.startup (world.discord);

   world.discord.on (Discord.Events.InteractionCreate, interaction => {
      if (interaction.isChatInputCommand ()) handleCommandInteraction (interaction, world);
      else if (interaction.isAutocomplete ()) handleAutocompleteInteraction (interaction, world);
   });

   world.discord.on (Discord.Events.MessageCreate, message => {
      if (!message.author.bot) Meetup.command (message);
      handleMessageCreate (message, world.discord);
      handleOnboardingMessageCreate (message);
   });

   world.discord.on (Discord.Events.MessageUpdate, (oldMessage, newMessage) => {
      handleOnboardingMessageUpdate (oldMessage, newMessage);
   });

   world.discord.on (Discord.Events.GuildMemberAdd, member => {
      handleOnboardingMemberAdd (member as Discord.GuildMember);
   });

   if (env.NODE_ENV === "production") {
      const admin = await world.discord.channels.fetch (env.CHANNEL_BOT_ADMIN);

      if (admin?.isTextBased ()) {
         const changelog = await getLogEmbed ();

         admin.send ({
            content: "<:bankbot:613855784996044826> Boredbot Online",
            embeds: [changelog]
         });
      }
   }

} ();

