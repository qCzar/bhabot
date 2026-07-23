import { DateTime } from "luxon";
import schedule from "node-schedule";
import * as Discord from "discord.js";
import { logger, runWithLoggingContext } from "../../../logger";

import * as db from "../db/meetups";
import * as M from "../common/Meetup";

const log = logger ("fit:end-meetup");

// Start the scheduler
export async function init(client: Discord.Client) : Promise<void> {
   await endMeetups (client);

   // Every day at midnight
   schedule.scheduleJob (
      "5 0 * * *", 
      () => {
         runWithLoggingContext (() => {
            log.info ("Ending any finished meetups");
            endMeetups (client);
         });
      }
   );
}
  
// Check the timestamp for meetups
// and mark any old ones as "done"
export const endMeetups = async (client: Discord.Client) : Promise<void> => {
   const now = DateTime.local ();

   const meetups = await db.find ({
      "state.type": "Live"
   });

   const expired = meetups.filter (meetup => {
      const endTime = DateTime.fromISO (meetup.timestamp).plus ({ hours: meetup.duration ?? 2 });
      return endTime < now;
   });

   for (const meetup of expired) {
      log.debug ("Meetup ended", { id: meetup.id, title: meetup.title });

      await db.update ({
         ...meetup,
         state: { type: "Ended" }
      });

      const channel = await client.channels.fetch (meetup.threadID);

      if (channel?.isThread ()) {
         channel.setName (`(Ended) ${M.threadTitle (meetup.title, meetup.timestamp)}`);
      }
   }
};