import * as Discord from "discord.js";

import * as UpdateRsvps from "./features/UpdateRsvps";
import * as Directory from "./features/Directory";
import * as EndMeetups from "./features/EndMeetup";
import * as Render from "./features/RenderAnnouncement";
import * as KeepThreadsOpen from "./features/KeepThreadsOpen";
import * as GenerateRecurringMeetups from "./features/GenerateRecurringMeetups";

import { getMeetup } from "./routes/get-meetup";
import { redirectGoogleCalendar } from "./routes/gcal";

export const startup = (client: Discord.Client): void => {
   // Keeps the announcement Embed up to date
   Render.init (client);

   // Listen to RSVP buttons and update meetup
   UpdateRsvps.startWatching (client);

   // Keeps a compact view in #meetups-directory up to date
   Directory.startListening (client);

   // Auto end meetups after a certain period
   EndMeetups.init (client);

   // Keeps threads open while a meetup is live
   KeepThreadsOpen.startSchedule (client);

   // Materialize recurring occurrences inside each server's rolling window
   GenerateRecurringMeetups.init (client);
};

export const routes = [
   {
      method:  "GET",
      path:    "/meetup/{id}/gcal",
      handler: redirectGoogleCalendar
   },
   {
      method:  "GET",
      path:    "/meetup/{id}",
      handler: getMeetup
   }
];
