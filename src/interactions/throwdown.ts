import { ChatInputCommandInteraction } from "discord.js";
import { DateTime } from "luxon";

import * as Interaction from "../interaction";
import * as Streak from "../commands/throw/Streak";
import * as Format from "../deprecating/Format";
import { MemberList } from "../deprecating/MemberList";
import { interactionFailed } from "../errors";
import { getSetting } from "../environment";

const COOLDOWN_MINUTES = 60;

type hand =
  | "rock"
  | "paper"
  | "scissors"

const hands : hand[] = ["rock", "paper", "scissors"];

const checkResult = (a: hand, b: hand) : Streak.result => {
   const wins = (a2: hand, b2: hand) =>
      (a2 === "rock" && b2 === "scissors")
      || (a2 === "paper" && b2 === "rock")
      || (a2 === "scissors" && b2 === "paper");

   return (wins (a, b)) ? "win"
      : (wins (b, a)) ? "loss"
         : "tie";
};

const randomFrom = <T>(arr: T[]) : T =>
   arr[Math.floor (Math.random ()*arr.length)];

const handEmoji = (hand: hand) : string => ({
   "rock":     "✊",
   "scissors": "✌️",
   "paper":    "✋"
})[hand];

// ── Subcommand handlers ─────────────────────────────────────────────

const play = async (interaction: ChatInputCommandInteraction) : Promise<void> => {
   const hand = interaction.options.getString ("hand", true) as hand;
   const streak = await Streak.findOrMake (interaction.user.id);

   if (streak.cooldown) {
      const cooldown = DateTime.fromISO (streak.cooldown);
      const diff = DateTime.local ().diff (cooldown, ["minutes"]);

      if (diff.minutes < COOLDOWN_MINUTES) {
         const cooldownEnds = cooldown.plus ({ minutes: COOLDOWN_MINUTES });

         await interaction.reply (`Cooldown: ${Format.time (cooldownEnds, Format.TimeFormat.Relative)}`);
         return;
      }
   }

   const bot = randomFrom (hands);

   switch (checkResult (hand, bot)) {
      case "win": {
         const currentStreak = streak.currentStreak + 1;
         const currentRecord = (await Streak.fetchAll ())
            .reduce ((a, b) => a > b.bestStreak ? a : b.bestStreak, 0);

         const update = await Streak.update ({
            ...streak,
            bestStreak:    Math.max (streak.bestStreak, currentStreak),
            currentStreak: currentStreak,
            history:       [...streak.history, "win"]
         });

         const prString = update.currentStreak > streak.bestStreak ? "\n🎉 Personal Best" : "";

         await interaction.reply (`${handEmoji (hand)} ✅ ${handEmoji (bot)}\nStreak: **${update.currentStreak}** • Best: **${update.bestStreak}** ${prString}`);

         if (currentStreak > currentRecord) {
            const announcement = await interaction.followUp (`🎖️ <@${interaction.user.id}> just set a new high score of **${currentStreak}**!`);

            if (announcement.pinnable) {
               await announcement.pin ();
            }
         }

         return;
      }

      case "loss": {
         const cooldown = DateTime.local ();
         const history = [...streak.history, "loss"] as Streak.result[];

         await Streak.update ({
            ...streak,
            currentStreak: 0,
            cooldown:      cooldown.toISO (),
            history:       []
         });

         const cooldownTarget = cooldown.plus ({ minutes: COOLDOWN_MINUTES });
         const emojiHistory = history.map (h => ({
            "win":  "🏆",
            "tie":  "🏳️",
            "loss": "🟥"
         })[h]).join ("");

         const victoryScreen = `Final Streak: **${streak.currentStreak}**\n${emojiHistory}`;

         await interaction.reply (`${handEmoji (hand)} 🟥 ${handEmoji (bot)}\n\nYou Lost in ${history.length} turns\n${victoryScreen}\n\nCooldown: ${Format.time (cooldownTarget, Format.TimeFormat.Relative)}`);
         return;
      }

      case "tie": {
         await Streak.update ({
            ...streak,
            history: [...streak.history, "tie"]
         });

         await interaction.reply (`${handEmoji (hand)} 🏳️ ${handEmoji (bot)}\nStreak: **${streak.currentStreak}** • Best: **${streak.bestStreak}** `);
         return;
      }
   }
};

const profile = async (interaction: ChatInputCommandInteraction) : Promise<void> => {
   const streak = await Streak.findOrMake (interaction.user.id);

   if (streak.bestStreak === 0) {
      await interaction.reply ("Welcome to Rock Paper Scissors! Use `/throwdown play` and pick rock, paper, or scissors — the bot picks one randomly. Each win adds to a winstreak, losing resets. Use `/throwdown profile` to see your progress. Good luck!");
   }
   else {
      await interaction.reply (`Best Streak: **${streak.bestStreak}**, Current streak: **${streak.currentStreak}**`);
   }
};

const leaderboard = async (interaction: ChatInputCommandInteraction) : Promise<void> => {
   const streaks = (await Streak.fetchAll ())
      .sort ((a, b) => a.bestStreak > b.bestStreak ? -1 : 1);

   const members = await MemberList.fetch (interaction.client, streaks.map (s => s.userId));

   let table = "```";

   for (const { userId, bestStreak } of streaks) {
      table += bestStreak.toString ().padEnd (3, " ");
      table += members.get (userId)
         .map (m => m.displayName)
         .getOrElseValue ("Someone");
      table += "\n";
   }

   table += "```";
   await interaction.reply (table);
};

// ── Slash command definition ────────────────────────────────────────

const { commandType, optionType } = Interaction;

export const throwdown = Interaction.make ({
   config: [{
      name: "throwdown",
      description: "Rock Paper Scissors — build your winstreak!",
      type: commandType.slash,
      options: [
         {
            type: optionType.sub_command,
            name: "play",
            description: "Play a round of rock paper scissors",
            options: [{
               type: optionType.string,
               name: "hand",
               description: "Your choice",
               required: true,
               choices: [
                  { name: "Rock",     value: "rock" },
                  { name: "Paper",    value: "paper" },
                  { name: "Scissors", value: "scissors" }
               ]
            }]
         },

         {
            type: optionType.sub_command,
            name: "profile",
            description: "View your streak profile"
         },

         {
            type: optionType.sub_command,
            name: "leaderboard",
            description: "View the throwdown leaderboard"
         }
      ]
   }],

   handle: (interaction) => {
      if (interaction.channelId !== getSetting(interaction.guildId, "CHANNEL_THROWDOWN")) {
         interaction
            .reply ({ content: "This command can only be used in the throwdown channel.", ephemeral: true })
            .catch (interactionFailed);
         return;
      }

      switch (interaction.options.getSubcommand ()) {
         case "play":
            play (interaction).catch (interactionFailed);
            break;

         case "profile":
            profile (interaction).catch (interactionFailed);
            break;

         case "leaderboard":
            leaderboard (interaction).catch (interactionFailed);
            break;

         default:
            throw new Error (`Unrecognized subcommand '${interaction.options.getSubcommand ()}'`);
      }
   }
});
