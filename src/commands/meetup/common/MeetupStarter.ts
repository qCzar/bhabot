import type { MessageCreateOptions } from "discord.js";
import type { MeetupMention } from "./ValidateRole";
import { threadTitle } from "./Meetup";

export const meetupStarterPost = (
   title: string,
   timestamp: string,
   mention?: MeetupMention
): MessageCreateOptions => {
   const mentionText = mention?.type === "role"
      ? `<@&${mention.id}>`
      : mention?.type === "mass"
         ? `@${mention.name}`
         : undefined;

   return {
      content: [
         `🗓️ ${threadTitle (title, timestamp)}`,
         mentionText
      ].filter (Boolean).join (" - "),
      allowedMentions: mention?.type === "role"
         ? { parse: [], roles: [mention.id] }
         : mention?.type === "mass"
            ? { parse: ["everyone"] }
            : { parse: [] }
   };
};
