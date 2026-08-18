import type * as db from "../commands/meetup/db/meetups";

export type TransferValidation =
   | { valid: true }
   | { valid: false; message: string };

export interface TargetUser {
   id: string;
   bot?: boolean;
}

export function canTransferMeetup(
   meetup: Pick<db.Meetup, "organizerID">,
   userId: string,
   isMod: boolean
): boolean {
   return isMod || meetup.organizerID === userId;
}

export function validateTransferTarget(
   meetup: Pick<db.Meetup, "organizerID" | "rsvps" | "state">,
   targetUser: TargetUser
): TransferValidation {
   if (meetup.state.type !== "Live") {
      return {
         valid: false,
         message: "⚠️ You cannot transfer a cancelled or ended meetup."
      };
   }

   if (targetUser.bot) {
      return {
         valid: false,
         message: "⚠️ You cannot transfer a meetup to a bot."
      };
   }

   if (targetUser.id === meetup.organizerID) {
      return {
         valid: false,
         message: `⚠️ <@${targetUser.id}> is already the organizer of this meetup.`
      };
   }

   if (!meetup.rsvps.includes(targetUser.id)) {
      return {
         valid: false,
         message: "⚠️ You can only transfer a meetup to an attendee who has RSVP'd."
      };
   }

   return { valid: true };
}
