import { meetupStarterPost } from "./MeetupStarter";

describe ("meetupStarterPost", () => {
   it ("posts the date and title and permits only the selected role mention", () => {
      expect (meetupStarterPost (
         "Board Game Night",
         "2026-08-15T19:00:00.000Z",
         { type: "role", id: "123456789" }
      )).toEqual ({
         content: "🗓️ Aug 15 - Board Game Night - <@&123456789>",
         allowedMentions: { parse: [], roles: ["123456789"] }
      });
   });

   it ("does not permit mentions when no activity role was selected", () => {
      expect (meetupStarterPost (
         "Board Game Night",
         "2026-08-15T19:00:00.000Z"
      )).toEqual ({
         content: "🗓️ Aug 15 - Board Game Night",
         allowedMentions: { parse: [] }
      });
   });
});
