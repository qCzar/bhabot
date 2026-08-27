import type * as db from "../commands/meetup/db/meetups";

export type ClaimValidation =
   | { valid: true }
   | { valid: false; message: string };

export function validateClaim(
   meetup: Pick<db.Meetup, "organizerID" | "rsvps" | "state">,
   userId: string
): ClaimValidation {
   if (meetup.state.type !== "Live") {
      return {
         valid: false,
         message: "⚠️ You cannot claim a cancelled or ended meetup."
      };
   }

   if (userId === meetup.organizerID) {
      return {
         valid: false,
         message: "⚠️ You are already the organizer of this meetup."
      };
   }

   if (meetup.rsvps.includes (meetup.organizerID)) {
      return {
         valid: false,
         message: "⚠️ The organizer is currently attending this meetup. You can only claim a meetup if the organizer is not attending."
      };
   }

   if (!meetup.rsvps.includes (userId)) {
      return {
         valid: false,
         message: "⚠️ You can only claim a meetup if you have already RSVP'd as attending."
      };
   }

   return { valid: true };
}
