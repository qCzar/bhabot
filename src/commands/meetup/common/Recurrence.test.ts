import { DateTime } from "luxon";
import { weeklyOccurrences } from "./Recurrence";

describe ("weeklyOccurrences", () => {
   it ("generates selected weekdays through an inclusive end date", () => {
      const dates = weeklyOccurrences (
         "2026-08-03T19:00:00.000-05:00",
         { frequency: "weekly", interval: 1, weekdays: [1, 3], endDate: "2026-08-12", timezone: "America/Chicago" },
         DateTime.fromISO ("2026-09-01T00:00:00", { zone: "America/Chicago" }),
         DateTime.fromISO ("2026-08-01T00:00:00", { zone: "America/Chicago" })
      );
      expect (dates.map (date => date.toFormat ("yyyy-MM-dd HH:mm"))).toEqual ([
         "2026-08-03 19:00", "2026-08-05 19:00", "2026-08-10 19:00", "2026-08-12 19:00"
      ]);
   });

   it ("keeps the local time across daylight saving changes", () => {
      const dates = weeklyOccurrences (
         "2026-10-26T19:00:00.000-05:00",
         { frequency: "weekly", interval: 1, weekdays: [1], endDate: "2026-11-09", timezone: "America/Chicago" },
         DateTime.fromISO ("2026-11-10T00:00:00", { zone: "America/Chicago" }),
         DateTime.fromISO ("2026-10-25T00:00:00", { zone: "America/Chicago" })
      );
      expect (dates.map (date => date.toFormat ("HH:mm ZZZ"))).toEqual (["19:00 -0500", "19:00 -0600", "19:00 -0600"]);
   });
});
