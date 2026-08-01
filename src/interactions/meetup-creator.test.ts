import {
   meetupCalendarUrl,
   meetupCreatorMessage,
   meetupCreatorUrl,
   meetupEditUrl
} from "./meetup-creator";

describe ("meetup creator link", () => {
   it ("uses the configured form root", () => {
      expect (meetupCreatorUrl ("https://qczar.github.io/rbhabot_expanded/"))
         .toBe ("https://qczar.github.io/rbhabot_expanded/");
   });

   it ("adds a trailing slash when the form URL does not have one", () => {
      expect (meetupCreatorUrl ("https://example.com/form")).toBe ("https://example.com/form/");
   });

   it ("tells the user how to submit the generated options", () => {
      const message = meetupCreatorMessage ("https://qczar.github.io/rbhabot_expanded/");

      expect (message).toContain ("[Open the meetup creator](https://qczar.github.io/rbhabot_expanded/)");
      expect (message).toContain ("/bored meetup create options:");
   });

   it ("builds edit links on the form and calendar links on the API", () => {
      expect (meetupEditUrl ("https://qczar.github.io/rbhabot_expanded/", "meetup id"))
         .toBe ("https://qczar.github.io/rbhabot_expanded/#meetup%20id");
      expect (meetupCalendarUrl ("http://meetup.rochesterbored.com", "meetup id"))
         .toBe ("http://meetup.rochesterbored.com/meetup/meetup%20id/gcal");
   });
});
