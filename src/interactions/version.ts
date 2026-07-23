import { interactionFailed } from "../errors";
import * as Interaction from "../interaction";

import * as Discord from "discord.js";

export const versionSubcommandConfig: Interaction.option = {
   type: Interaction.optionType.sub_command,
   name: "version",
   description: "Get the current running version for BoredBot"
};

export const handleVersionSubcommand = (interaction: Discord.ChatInputCommandInteraction) => {
   interaction
      .reply (process.env.npm_package_version ?? "Unable to fetch package version")
      .catch (interactionFailed);
};