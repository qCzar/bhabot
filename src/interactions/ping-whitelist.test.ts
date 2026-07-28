import { isPingWhitelistedChannel } from "./ping-whitelist";

describe ("isPingWhitelistedChannel", () => {
   const whitelist = "text-channel,forum-channel,explicit-thread";

   it ("allows a directly whitelisted channel", () => {
      expect (isPingWhitelistedChannel (whitelist, "text-channel")).toBe (true);
   });

   it ("allows any thread under a whitelisted forum channel", () => {
      expect (isPingWhitelistedChannel (whitelist, "forum-post-1", "forum-channel")).toBe (true);
      expect (isPingWhitelistedChannel (whitelist, "forum-post-2", "forum-channel")).toBe (true);
   });

   it ("continues to allow an explicitly whitelisted thread", () => {
      expect (isPingWhitelistedChannel (whitelist, "explicit-thread", "other-forum")).toBe (true);
   });

   it ("rejects a thread whose parent and own ID are not whitelisted", () => {
      expect (isPingWhitelistedChannel (whitelist, "unapproved-thread", "other-forum")).toBe (false);
   });
});
