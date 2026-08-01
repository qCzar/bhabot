import { DateTime } from "luxon";
import { object, string, array, pattern, optional, assert, Infer, StructError, type, boolean, number } from "superstruct";
import { option } from "ts-option";
import * as db from "../db/meetups";

const MAX_DESCRIPTION_SIZE = 1000;

// eslint-disable-next-line max-len
const url = pattern (string (), /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/);
const ISOstring = pattern (string (), /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+/);
const ISOdate = pattern (string (), /^\d{4}-[01]\d-[0-3]\d$/);

export type MeetupOptions = Infer<typeof MeetupOptions>;
const MeetupOptions = type ({
   title:       string (),
   description: optional (string ()),
   date:        ISOstring,

   location:          optional (string ()),
   location_comments: optional (string ()),
   location_linked:   optional (boolean ()),

   category: optional (string ()),
   links:    optional (array (
      object ({
         label: optional (string ()),
         url:   url
      })
   )),

   maxRsvp:      optional (number ()),
   rsvpDeadline: optional (ISOstring),
   duration:     optional (number ()),
   subscription: optional (string ()),

   recurrence: optional (type ({
      frequency: string (),
      interval:  number (),
      weekdays:  array (number ()),
      endDate:   ISOdate,
      timezone:  optional (string ())
   }))
});

type ParseResult =
  | { failed: false } & MeetupOptions
  | { failed: true, message: string }

const Failed = (message: string) : ParseResult =>
   ({ failed: true, message });

export function parse (opt: unknown) : ParseResult {
   if (!opt) {
      // todo fix error response
      return Failed ("Go to the meetup creator to enter some options");
   }

   try { assert (opt, MeetupOptions); }
   catch (e) {
      return (e instanceof StructError) 
         ? Failed (e.message)
         : Failed ("Could not parse your errors");
   }

   const date = DateTime.fromISO (opt.date);

   if (date.toMillis () <= DateTime.utc ().toMillis ())
      return Failed ("Cant create a meetup that is set to the past");
    
   if (opt.description && opt.description.length > MAX_DESCRIPTION_SIZE)
      return Failed ("Description is too long");

   if (opt.location_comments && opt.location_comments.length > 300)
      return Failed ("Location comments can only be 300 characters long");

   if (opt.recurrence) {
      const recurrence = opt.recurrence;
      if (recurrence.frequency !== "weekly") return Failed ("Only weekly recurrence is currently supported");
      if (!Number.isInteger (recurrence.interval) || recurrence.interval < 1 || recurrence.interval > 52)
         return Failed ("Recurrence interval must be a whole number from 1 to 52");
      if (!recurrence.weekdays.length || recurrence.weekdays.some (day => !Number.isInteger (day) || day < 1 || day > 7))
         return Failed ("Recurrence weekdays must contain values from 1 (Monday) through 7 (Sunday)");

      const zonedStart = recurrence.timezone
         ? DateTime.fromISO (opt.date, { setZone: true }).setZone (recurrence.timezone)
         : DateTime.fromISO (opt.date, { setZone: true });
      const end = DateTime.fromISO (recurrence.endDate, recurrence.timezone ? { zone: recurrence.timezone } : {}).endOf ("day");
      if (!zonedStart.isValid || !end.isValid) return Failed ("Recurrence timezone or end date is invalid");
      if (end < zonedStart) return Failed ("Recurrence end date must be on or after the first meetup");
      if (recurrence.timezone && !recurrence.weekdays.includes (zonedStart.weekday))
         return Failed ("The selected weekdays must include the first meetup date");
   }

   return { failed: false, ...opt };
}

/**
 * Used in create & edit, this just formats
 */
export const toLocation = (options: MeetupOptions) : db.Meetup["location"] => {
   if (options.location) {
      return {
         value:    options.location,
         comments: options.location_comments || "",
         autoLink: option (options.location_linked)
            .getOrElseValue (true) 
      };
   }
   else {
      return undefined;
   }
};
