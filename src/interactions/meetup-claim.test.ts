import { validateClaim } from "./meetup-claim";

describe ("validateClaim", () => {
   const baseMeetup = {
      organizerID: "user-organizer",
      rsvps: ["user-attendee-1", "user-attendee-2"],
      state: { type: "Live" as const }
   };

   it ("passes validation when organizer is not in rsvps and caller is an attending user", () => {
      const result = validateClaim (baseMeetup, "user-attendee-1");
      expect (result).toEqual ({ valid: true });
   });

   it ("fails if the meetup is cancelled", () => {
      const result = validateClaim (
         { ...baseMeetup, state: { type: "Cancelled" as const, reason: "Rain", timestamp: "2026-08-01" } },
         "user-attendee-1"
      );
      expect (result).toEqual ({
         valid: false,
         message: "⚠️ You cannot claim a cancelled or ended meetup."
      });
   });

   it ("fails if the meetup is ended", () => {
      const result = validateClaim (
         { ...baseMeetup, state: { type: "Ended" as const } },
         "user-attendee-1"
      );
      expect (result).toEqual ({
         valid: false,
         message: "⚠️ You cannot claim a cancelled or ended meetup."
      });
   });

   it ("fails if the caller is already the organizer", () => {
      const result = validateClaim (baseMeetup, "user-organizer");
      expect (result).toEqual ({
         valid: false,
         message: "⚠️ You are already the organizer of this meetup."
      });
   });

   it ("fails if the organizer is still in the RSVP list", () => {
      const result = validateClaim (
         { ...baseMeetup, rsvps: ["user-organizer", "user-attendee-1"] },
         "user-attendee-1"
      );
      expect (result).toEqual ({
         valid: false,
         message: "⚠️ The organizer is currently attending this meetup. You can only claim a meetup if the organizer is not attending."
      });
   });

   it ("fails if the caller has not RSVP'd as attending", () => {
      const result = validateClaim (baseMeetup, "user-random");
      expect (result).toEqual ({
         valid: false,
         message: "⚠️ You can only claim a meetup if you have already RSVP'd as attending."
      });
   });
});
