import { canTransferMeetup, validateTransferTarget } from "./meetup-transfer";

describe("canTransferMeetup", () => {
   const meetup = { organizerID: "user-organizer" };

   it("allows the meetup organizer to transfer", () => {
      expect(canTransferMeetup(meetup, "user-organizer", false)).toBe(true);
   });

   it("allows a moderator to transfer even if not the organizer", () => {
      expect(canTransferMeetup(meetup, "user-mod", true)).toBe(true);
   });

   it("disallows a regular user who is not the organizer", () => {
      expect(canTransferMeetup(meetup, "user-regular", false)).toBe(false);
   });
});

describe("validateTransferTarget", () => {
   const baseMeetup = {
      organizerID: "user-organizer",
      rsvps: ["user-organizer", "user-attendee-1", "user-attendee-2"],
      state: { type: "Live" as const }
   };

   it("passes validation for an active RSVP attendee", () => {
      const result = validateTransferTarget(baseMeetup, { id: "user-attendee-1" });
      expect(result).toEqual({ valid: true });
   });

   it("fails if the meetup is cancelled", () => {
      const result = validateTransferTarget(
         { ...baseMeetup, state: { type: "Cancelled" as const, reason: "Rain", timestamp: "2026-08-01" } },
         { id: "user-attendee-1" }
      );
      expect(result).toEqual({
         valid: false,
         message: "⚠️ You cannot transfer a cancelled or ended meetup."
      });
   });

   it("fails if the meetup is ended", () => {
      const result = validateTransferTarget(
         { ...baseMeetup, state: { type: "Ended" as const } },
         { id: "user-attendee-1" }
      );
      expect(result).toEqual({
         valid: false,
         message: "⚠️ You cannot transfer a cancelled or ended meetup."
      });
   });

   it("fails if the target user is a bot", () => {
      const result = validateTransferTarget(baseMeetup, { id: "bot-id", bot: true });
      expect(result).toEqual({
         valid: false,
         message: "⚠️ You cannot transfer a meetup to a bot."
      });
   });

   it("fails if the target user is already the organizer", () => {
      const result = validateTransferTarget(baseMeetup, { id: "user-organizer" });
      expect(result).toEqual({
         valid: false,
         message: "⚠️ <@user-organizer> is already the organizer of this meetup."
      });
   });

   it("fails if the target user has not RSVP'd as attending", () => {
      const result = validateTransferTarget(baseMeetup, { id: "user-random" });
      expect(result).toEqual({
         valid: false,
         message: "⚠️ You can only transfer a meetup to an attendee who has RSVP'd."
      });
   });
});
