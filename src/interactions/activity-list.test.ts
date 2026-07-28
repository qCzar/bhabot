import { formatActivityListMessages } from "./activity-list";

describe("formatActivityListMessages", () => {
   test("groups and alphabetizes joined and available activities", () => {
      const [message] = formatActivityListMessages(
         ["Tennis", "Board Games"],
         ["Movies", "Dungeons & Dragons"]
      );

      expect(message).toContain("✅ **YOUR ACTIVITIES (2)**");
      expect(message).toContain("➕ **AVAILABLE TO JOIN (2)**");
      expect(message).toContain("Activity\n--------\nBoard Games");
      expect(message).not.toContain("No.");
      expect(message.indexOf("Board Games")).toBeLessThan(message.indexOf("Tennis"));
      expect(message.indexOf("Dungeons & Dragons")).toBeLessThan(message.indexOf("Movies"));
   });

   test("describes empty subscription groups", () => {
      const [notJoined] = formatActivityListMessages([], ["Movies"]);
      const [joinedAll] = formatActivityListMessages(["Movies"], []);

      expect(notJoined).toContain("You haven't joined any activities yet.");
      expect(joinedAll).toContain("You've joined every available activity.");
   });

   test("returns a friendly message when no activities exist", () => {
      expect(formatActivityListMessages([], [])).toEqual([
         "There are no activities available."
      ]);
   });

   test("sanitizes names that could break the code block", () => {
      const [message] = formatActivityListMessages(["one\nline", "triple```tick"], []);

      expect(message).toContain("one line");
      expect(message).toContain("triple'''tick");
      expect((message.match(/```/g) || [])).toHaveLength(2);
   });

   test("splits long lists without exceeding the message limit", () => {
      const names = Array.from(
         { length: 20 },
         (_, index) => `Activity ${index} ${"x".repeat(30)}`
      );
      const messages = formatActivityListMessages([], names, 300);

      expect(messages.length).toBeGreaterThan(1);
      expect(messages.every(message => message.length <= 300)).toBe(true);
      expect(messages.every(message => (message.match(/```/g) || []).length % 2 === 0)).toBe(true);
      expect(messages.join("\n")).toContain("Activity 19");
   });
});
