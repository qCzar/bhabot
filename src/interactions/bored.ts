import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { interaction } from "../interaction";
import { defineSubcommandConfig, handleDefineSubcommand } from "./define";
import { 
   activitySubcommandGroupConfig, 
   mentionSubcommandConfig, 
   handleActivitySubcommand, 
   handleMentionSubcommand, 
   handleActivityAutocomplete 
} from "./activity";
import { handlePlayAutocomplete, handlePlaySubcommand, playSubcommandConfig } from "./play";
import { christmasSubcommandConfig, handleChristmasSubcommand } from "./christmas";
import { pongSubcommandConfig, handlePongSubcommand } from "./pong";
import { tldrSubcommandGroupConfig, handleTldrSubcommand } from "./tldr";
import { versionSubcommandConfig, handleVersionSubcommand } from "./version";
import { throwdownSubcommandGroupConfig, handleThrowdownSubcommand } from "./throwdown";
import { meetupSubcommandGroupConfig, handleMeetupSubcommand } from "./meetup";
import { changelogSubcommandConfig, handleChangelogSubcommand } from "./changelog";
import { banSubcommandConfig, handleBanSubcommand } from "./ban";


const buildCommand = () => {
   const builder = new SlashCommandBuilder()
      .setName("bored")
      .setDescription("BoredBot public utility commands");

   // Add flat subcommands
   const subcommands = [
      defineSubcommandConfig,
      mentionSubcommandConfig,
      playSubcommandConfig,
      christmasSubcommandConfig,
      pongSubcommandConfig,
      versionSubcommandConfig,
      changelogSubcommandConfig,
      banSubcommandConfig
   ];

   for (const sub of subcommands) {
      builder.addSubcommand(subCmd => {
         subCmd.setName(sub.name).setDescription(sub.description);
         if (sub.options) {
            for (const opt of sub.options) {
               addOptionToCommand(subCmd, opt);
            }
         }
         return subCmd;
      });
   }

   // Add subcommand groups
   const groups = [
      activitySubcommandGroupConfig,
      tldrSubcommandGroupConfig,
      throwdownSubcommandGroupConfig,
      meetupSubcommandGroupConfig
   ];

   for (const group of groups) {
      builder.addSubcommandGroup(groupCmd => {
         groupCmd.setName(group.name).setDescription(group.description);
         if (group.options) {
            for (const sub of group.options) {
               groupCmd.addSubcommand(subCmd => {
                  subCmd.setName(sub.name).setDescription(sub.description);
                  if (sub.options) {
                     for (const opt of sub.options) {
                        addOptionToCommand(subCmd, opt);
                     }
                  }
                  return subCmd;
               });
            }
         }
         return groupCmd;
      });
   }

   return builder;
};

const addOptionToCommand = (builder: any, opt: any) => {
   const addCommonProps = (o: any) => {
      o.setName(opt.name)
       .setDescription(opt.description)
       .setRequired(opt.required ?? false);
      if (opt.autocomplete !== undefined) {
         o.setAutocomplete(opt.autocomplete);
      }
      if (opt.choices) {
         o.addChoices(...opt.choices);
      }
      return o;
   };

   // Option Types:
   // 3: string, 4: integer, 5: boolean, 6: user, 7: channel, 8: role, 9: mentionable, 10: number, 11: attachment
   switch (opt.type) {
      case 3:
         builder.addStringOption((o: any) => addCommonProps(o));
         break;
      case 4:
         builder.addIntegerOption((o: any) => addCommonProps(o));
         break;
      case 5:
         builder.addBooleanOption((o: any) => addCommonProps(o));
         break;
      case 6:
         builder.addUserOption((o: any) => addCommonProps(o));
         break;
      case 7:
         builder.addChannelOption((o: any) => addCommonProps(o));
         break;
      case 8:
         builder.addRoleOption((o: any) => addCommonProps(o));
         break;
      case 9:
         builder.addMentionableOption((o: any) => addCommonProps(o));
         break;
      case 10:
         builder.addNumberOption((o: any) => addCommonProps(o));
         break;
      case 11:
         builder.addAttachmentOption((o: any) => addCommonProps(o));
         break;
      default:
         break;
   }
};

const command = buildCommand();

export const bored: interaction = {
   config: [command as any],

   handle: async (interaction, world) => {
      if (interaction.commandName !== "bored") return;

      const group = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      if (group) {
         switch (group) {
            case "activity":
               return handleActivitySubcommand(interaction);
            case "tldr":
               return handleTldrSubcommand(interaction, world);
            case "throwdown":
               return handleThrowdownSubcommand(interaction);
            case "meetup":
               return handleMeetupSubcommand(interaction);
            default:
               throw new Error(`Unrecognized subcommand group '${group}'`);
         }
      }

      switch (subcommand) {
         case "define":
            return handleDefineSubcommand(interaction);
         case "mention":
            return handleMentionSubcommand(interaction);
         case "play":
            return handlePlaySubcommand(interaction);
         case "christmas":
            return handleChristmasSubcommand(interaction);
         case "pong":
            return handlePongSubcommand(interaction);
         case "version":
            return handleVersionSubcommand(interaction);
         case "changelog":
            return handleChangelogSubcommand(interaction);
         case "ban":
            return handleBanSubcommand(interaction);
         default:
            throw new Error(`Unrecognized subcommand '${subcommand}'`);
      }
   },

   autocomplete: async (interaction, world) => {
      if (interaction.commandName !== "bored") return;

      const group = interaction.options.getSubcommandGroup(false);
      const subcommand = interaction.options.getSubcommand();

      // Handlers for autocompletes: activity has autocomplete for join/leave/ping (mention)
      if (group === "activity") {
         return handleActivityAutocomplete(interaction);
      }

      if (subcommand === "mention") {
         return handleActivityAutocomplete(interaction);
      }

      if (subcommand === "play") {
         return handlePlayAutocomplete(interaction);
      }
   }
};
