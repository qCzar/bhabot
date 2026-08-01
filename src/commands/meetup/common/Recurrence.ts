import { DateTime } from "luxon";
import type { WeeklyRecurrence } from "../db/meetup-series";

export const occurrenceKey = (timestamp: DateTime): string => timestamp.toUTC ().toISO ();

export function weeklyOccurrences(
   firstOccurrenceAt: string,
   recurrence: WeeklyRecurrence,
   through: DateTime,
   from = DateTime.local ()
): DateTime[] {
   const first = DateTime.fromISO (firstOccurrenceAt, { setZone: true }).setZone (recurrence.timezone);
   const end = DateTime.fromISO (recurrence.endDate, { zone: recurrence.timezone }).endOf ("day");
   const last = through.setZone (recurrence.timezone) < end ? through.setZone (recurrence.timezone) : end;
   const earliest = from.setZone (recurrence.timezone);
   const firstWeek = first.startOf ("week");
   const results: DateTime[] = [];

   if (!first.isValid || !end.isValid || !last.isValid) return results;

   for (let day = first.startOf ("day"); day <= last.startOf ("day"); day = day.plus ({ days: 1 })) {
      const weekOffset = Math.floor (day.startOf ("week").diff (firstWeek, "weeks").weeks);
      if (weekOffset % recurrence.interval !== 0 || !recurrence.weekdays.includes (day.weekday)) continue;

      const occurrence = day.set ({
         hour: first.hour,
         minute: first.minute,
         second: first.second,
         millisecond: first.millisecond
      });
      if (occurrence >= first && occurrence >= earliest && occurrence <= last) results.push (occurrence);
   }

   return results;
}
