import { formatDistance } from "date-fns";
import { ChatInputCommandInteraction, InteractionReplyOptions, MessageReplyOptions } from "discord.js";
import * as Interaction from "../interaction";
import { interactionFailed } from "../errors";
import { assertDefined } from "../prelude";
import { broadcast, World } from "../world";
import { getSetting } from "../environment";
import { addExemptRole, removeExemptRole, getExemptRoles } from "../features/multipost";

interface note {
   moderator: string;
   userId: string;
   note: string;
   timestamp: Date;
}

const collection_name = "mod-notes";

interface noteReplyProps {
   userId: string;
   note: string;
   ephemeral: boolean;
}

const makeSavedNoteReply = ({ userId, note, ephemeral }: noteReplyProps): InteractionReplyOptions => ({
   embeds: [{
      title:  "📝 New Mod note",
      fields: [
         { name: "User", value: `<@${userId}>` },
         { name: "Note", value: note }
      ]
   }],
   ephemeral
});

interface noteAnnouncementProps {
   userId: string;
   modname: string;
   note: string;
}

const makeNoteSavedAnnouncement = ({ userId, note, modname }: noteAnnouncementProps): MessageReplyOptions => ({
   embeds: [{
      title: `📝 ${modname} logged a note`,
      fields: [
         { name: "User", value: `<@${userId}>` },
         { name: "Note", value: note }
      ]
   }]
});

const echo = (interaction: ChatInputCommandInteraction) => {
   const text = interaction.options.getString ("text");
   assertDefined (text, "'text' is a required option");
   
   interaction.reply ({ content: "sending echo 🤫", ephemeral: true })
      .then (async _ => {
         await interaction.channel?.send ({ content: text });
      })
      .catch (interactionFailed);
};

const logNote = (interaction: ChatInputCommandInteraction, world: World) => {
   const user = interaction.options.getUser ("user");
   const content = interaction.options.getString ("note");

   assertDefined (user, "'user' is a required option");
   assertDefined (content, "'content' is a required option");

   const note: note = {
      moderator: interaction.user.id,
      userId: user.id,
      note: content,
      timestamp: new Date ()
   };

   const document = world.mongodb
      .collection<note> (collection_name)
      .insertOne (note);

   const response = document
      .then (_ => makeSavedNoteReply ({
         note: note.note,
         userId: user.id, 
         ephemeral: interaction.channelId !== getSetting(interaction.guildId, "CHANNEL_ADMIN")
      }));

   const announcement = response.then (_ => makeNoteSavedAnnouncement ({
      userId: user.id,
      modname: interaction.user.username,
      note: note.note
   }));
   
   Promise
      .all ([response, announcement])
      .then (([r, a]) => interaction.reply (r).then (_ => broadcast (world, getSetting(interaction.guildId, "CHANNEL_BOT_LOG"), a)))
      .catch (interactionFailed);
};

interface userNotesProps {
   username: string;
   notes: note[];
   now: Date;
   ephemeral: boolean;
}

const makeUserNotesReply = ({ username, now, notes, ephemeral }: userNotesProps): InteractionReplyOptions => {
   const rows = notes.map (note => `➡️ **${formatDistance (now, note.timestamp)}**: ${note.note}`);

   return {
      embeds: [{
         title: `🔑 Notes for @${username}`,
         color: 0xedd711,
         description: (rows.length > 0)
            ? rows.join ("\n")
            : "No notes found for this user"
      }],
      ephemeral
   };
};

const lookup = (interaction: ChatInputCommandInteraction, world: World) => {
   const user = interaction.options.getUser ("user");
   assertDefined (user, "'user' is a required field");

   const notes = world.mongodb
      .collection<note> (collection_name)
      .find ({ userId: user.id })
      .toArray ();

   notes
      .then (notes => makeUserNotesReply ({
         username: user.username,
         notes,
         now: new Date (),
         ephemeral: interaction.channelId !== getSetting(interaction.guildId, "CHANNEL_ADMIN")
      }))
      .then (_ => interaction.reply (_), interactionFailed);
};

const multipostExemptAdd = (interaction: ChatInputCommandInteraction, world: World) => {
   const role = interaction.options.getRole ("role");
   assertDefined (role, "'role' is a required option");
   
   addExemptRole (role.id, world, interaction.user.username)
      .then (() => interaction.reply ({ content: `✅ <@&${role.id}> is now exempt from multipost detection.`, ephemeral: true }))
      .catch (interactionFailed);
};

const multipostExemptRemove = (interaction: ChatInputCommandInteraction, world: World) => {
   const role = interaction.options.getRole ("role");
   assertDefined (role, "'role' is a required option");
   
   removeExemptRole (role.id, world)
      .then (() => interaction.reply ({ content: `✅ <@&${role.id}> is no longer exempt from multipost detection.`, ephemeral: true }))
      .catch (interactionFailed);
};

const multipostExemptList = (interaction: ChatInputCommandInteraction) => {
   const roles = getExemptRoles ();
   if (roles.length === 0) {
      interaction.reply ({ content: "No roles are currently exempt from multipost detection.", ephemeral: true }).catch(interactionFailed);
      return;
   }
   
   const roleMentions = roles.map (id => `<@&${id}>`).join ("\n");
   interaction.reply ({
      embeds: [{
         title: "🛡️ Multipost Exempt Roles",
         description: roleMentions,
         color: 0xedd711
      }],
      ephemeral: true
   }).catch(interactionFailed);
};

const { permissions, optionType } = Interaction;

export const modSubcommandGroupConfig: Interaction.option = {
   type: optionType.sub_command_group,
   name: "mod",
   description: "Commands meant to help make modding easier",
   options: [
      {
         type: optionType.sub_command,
         name: "log",
         description: "Log a note about a specific user",
         options: [{
            type: optionType.user,
            name: "user",
            description: "The user this note is about",
            required: true
         }, {
            type: optionType.string,
            name: "note",
            description: "The note you want to save for this user",
            required: true
         }]
      },

      {
         type: optionType.sub_command,
         name: "echo",
         description: "Play simon says with bored bot (hey, dont abuse this!)",
         options: [{
            type: optionType.string,
            name: "text",
            description: "The text that bored bot will repeat",
            required: true
         }]
      },

      {
         type: optionType.sub_command,
         name: "lookup",
         description: "Look up notes that have been saved for a user",
         options: [{
            type: optionType.user,
            name: "user",
            description: "The user to lookup",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "multipost-exempt-add",
         description: "Add a role that will be exempt from multipost detection",
         options: [{
            type: optionType.role,
            name: "role",
            description: "The role to exempt",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "multipost-exempt-remove",
         description: "Remove a role from multipost detection exemptions",
         options: [{
            type: optionType.role,
            name: "role",
            description: "The role to remove",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "multipost-exempt-list",
         description: "List all roles currently exempt from multipost detection"
      }
   ]
};

export const handleModSubcommand = (interaction: ChatInputCommandInteraction, world: World) => {
   switch (interaction.options.getSubcommand ()) {
      case "log": 
         logNote (interaction, world);
         break;

      case "echo":
         echo (interaction);
         break;   

      case "lookup":
         lookup (interaction, world);
         break;

      case "multipost-exempt-add":
         multipostExemptAdd (interaction, world);
         break;

      case "multipost-exempt-remove":
         multipostExemptRemove (interaction, world);
         break;

      case "multipost-exempt-list":
         multipostExemptList (interaction);
         break;

      default:
         throw new Error (`Unrecognized subcommand '${interaction.options.getSubcommand ()}`);
   }
};