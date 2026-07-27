import * as Discord from "discord.js";
import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import * as Interaction from "../interaction";
import { interactionFailed } from "../errors";
import reasons from "../commands/Ban/reasons";
import selfReasons from "../commands/Ban/self-reasons";

export const banSubcommandConfig: Interaction.option = {
   type: Interaction.optionType.sub_command,
   name: "ban",
   description: "Playfully ban a user from the server",
   options: [{
      type: Interaction.optionType.string,
      name: "target",
      description: "The target to ban",
      required: true
   }]
};

export const handleBanSubcommand = async (interaction: ChatInputCommandInteraction) => {
   const targetUser = interaction.options.getString("target", true);
   const rng = Math.floor(Math.random() * 6);

   if (rng === 3) {
      const reason = selfReasons.getReason();
      const message = `<@!${interaction.user.id}> has been banned from the server; Reason: 🖕 ${reason}`;

      if (interaction.guild && interaction.member) {
         try {
            const member = interaction.member as GuildMember;
            if (member && typeof member.timeout === "function") {
               await member.timeout(60 * 1000, "Playful self-ban");
            } else {
               const guildMember = await interaction.guild.members.fetch(interaction.user.id);
               if (guildMember && typeof guildMember.timeout === "function") {
                  await guildMember.timeout(60 * 1000, "Playful self-ban");
               }
            }
         } catch {
            // Ignore permission / role hierarchy errors when timing out
         }
      }

      await interaction.reply(message).catch(interactionFailed);
   } else {
      const reason = reasons.getReason();
      const message = `${targetUser} has been banned from the server; Reason: *${reason}*`;

      await interaction.reply(message).catch(interactionFailed);
   }
};
