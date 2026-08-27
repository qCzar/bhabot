import { DateTime } from "luxon";
import { shouldSendReminder, shouldSendWarning, shouldAutoCancel } from "./OrganizerReminder";
import type * as db from "../db/meetups";

describe ("OrganizerReminder calculations", () => {
   const baseMeetup: db.Meetup = {
      id: "meetup-1",
      organizerID: "user-organizer",
      title: "Board Game Night",
      sourceChannelID: "chan-1",
      threadID: "thread-1",
      announcementID: "msg-1",
      createdAt: "2026-08-01T12:00:00.000Z",
      category: "games",
      timestamp: "2026-08-10T18:00:00.000Z",
      description: "Playing games",
      links: [],
      rsvps: ["user-attendee-1"],
      maybes: [],
      state: { type: "Live" }
   };

   describe ("shouldSendReminder", () => {
      it ("returns false if organizer is in rsvps", () => {
         const meetup: db.Meetup = {
            ...baseMeetup,
            rsvps: ["user-organizer", "user-attendee-1"],
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldSendReminder (meetup)).toBe (false);
      });

      it ("returns false if reminder was already sent", () => {
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z",
            organizerReminderSent: true
         };
         expect (shouldSendReminder (meetup)).toBe (false);
      });

      it ("returns false if less than 10 minutes have elapsed", () => {
         const now = DateTime.fromISO ("2026-08-01T12:05:00.000Z");
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldSendReminder (meetup, now)).toBe (false);
      });

      it ("returns true if 10 or more minutes have elapsed and reminder not sent", () => {
         const now = DateTime.fromISO ("2026-08-01T12:10:00.000Z");
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldSendReminder (meetup, now)).toBe (true);
      });
   });

   describe ("shouldSendWarning", () => {
      it ("returns false if warning was already sent", () => {
         const now = DateTime.fromISO ("2026-08-02T11:30:00.000Z");
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z",
            organizerWarningSent: true
         };
         expect (shouldSendWarning (meetup, 24, 2, now)).toBe (false);
      });

      it ("returns true if 23 hours of missing organizer duration have elapsed", () => {
         const now = DateTime.fromISO ("2026-08-02T11:00:00.000Z"); // 23h after 12:00
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldSendWarning (meetup, 24, 2, now)).toBe (true);
      });

      it ("returns true if event start is within 3 hours (1h before 2h proximity deadline)", () => {
         const now = DateTime.fromISO ("2026-08-10T15:00:00.000Z"); // 3h before 18:00
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-10T14:30:00.000Z"
         };
         expect (shouldSendWarning (meetup, 24, 2, now)).toBe (true);
      });
   });

   describe ("shouldAutoCancel", () => {
      it ("returns false if organizer is in rsvps", () => {
         const now = DateTime.fromISO ("2026-08-02T13:00:00.000Z");
         const meetup: db.Meetup = {
            ...baseMeetup,
            rsvps: ["user-organizer"],
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldAutoCancel (meetup, 24, 2, now)).toBe (false);
      });

      it ("returns true if missing duration >= 24 hours", () => {
         const now = DateTime.fromISO ("2026-08-02T12:00:00.000Z"); // Exactly 24h
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldAutoCancel (meetup, 24, 2, now)).toBe (true);
      });

      it ("returns true if event start is within 2 hours", () => {
         const now = DateTime.fromISO ("2026-08-10T16:00:00.000Z"); // 2h before 18:00
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-10T15:30:00.000Z"
         };
         expect (shouldAutoCancel (meetup, 24, 2, now)).toBe (true);
      });

      it ("returns false if not yet 24 hours and more than 2 hours before start", () => {
         const now = DateTime.fromISO ("2026-08-01T18:00:00.000Z"); // 6h elapsed, 9 days before start
         const meetup: db.Meetup = {
            ...baseMeetup,
            organizerMissingSince: "2026-08-01T12:00:00.000Z"
         };
         expect (shouldAutoCancel (meetup, 24, 2, now)).toBe (false);
      });
   });
});
