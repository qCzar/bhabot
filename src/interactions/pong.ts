import { interactionFailed } from "../errors";
import * as Interaction from "../interaction";
import * as Discord from "discord.js";

export const pongSubcommandConfig: Interaction.option = {
   type: Interaction.optionType.sub_command,
   name: "pong",
   description: "Check if the v2 bot is alive"
};

export const handlePongSubcommand = (interaction: Discord.ChatInputCommandInteraction) => {
   interaction
      .reply ("Ping?")
      .catch (interactionFailed);
};