import { DateTime } from "luxon";
import { parse } from "./MeetupOptions";

describe ("recurring meetup options", () => {
   const start = DateTime.utc ().plus ({ days: 7 }).set ({ hour: 19, minute: 0, second: 0, millisecond: 0 });

   it ("accepts a weekly series whose first date is selected", () => {
      const result = parse ({
         title: "Game night",
         date: start.toISO (),
         recurrence: {
            frequency: "weekly",
            interval: 1,
            weekdays: [start.setZone ("America/Chicago").weekday],
            endDate: start.plus ({ weeks: 6 }).toFormat ("yyyy-MM-dd")
         }
      });
      expect (result.failed).toBe (false);
   });

   it ("rejects a schedule that excludes its first occurrence", () => {
      const firstWeekday = start.setZone ("America/Chicago").weekday;
      const result = parse ({
         title: "Game night",
         date: start.toISO (),
         recurrence: {
            frequency: "weekly",
            interval: 1,
            weekdays: [firstWeekday === 7 ? 1 : firstWeekday + 1],
            endDate: start.plus ({ weeks: 6 }).toFormat ("yyyy-MM-dd"),
            timezone: "America/Chicago"
         }
      });
      expect (result).toEqual ({ failed: true, message: "The selected weekdays must include the first meetup date" });
   });
});
