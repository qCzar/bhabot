import { Db } from "mongodb";
import { env, guildSettings, dynamicKeys } from "../environment";
import {
   serializeSettings,
   deserializeSettings,
   adminDashboardUrl,
   applyImportedSettings
} from "./settings-serializer";

describe ("settings-serializer", () => {
   const mockDb = {
      collection: jest.fn ().mockReturnValue ({
         updateOne: jest.fn ().mockResolvedValue ({})
      })
   } as unknown as Db;

   describe ("adminDashboardUrl", () => {
      it ("builds URL with hash and without guildId", () => {
         const url = adminDashboardUrl ("https://qczar.github.io/bhabot/", "abc123hash");
         expect (url).toBe ("https://qczar.github.io/bhabot/admin#abc123hash");
      });

      it ("builds URL with hash and guildId query param", () => {
         const url = adminDashboardUrl ("https://qczar.github.io/bhabot", "abc123hash", "123456789");
         expect (url).toBe ("https://qczar.github.io/bhabot/admin?server=123456789#abc123hash");
      });
   });

   describe ("serializeSettings & deserializeSettings", () => {
      it ("serializes all dynamic settings to a valid Base64 string and deserializes correctly", () => {
         const hash = serializeSettings ();
         const deserialized = deserializeSettings (hash);

         for (const key of dynamicKeys) {
            expect (deserialized[key]).toBeDefined ();
            expect (deserialized[key]).toEqual (env[key]);
         }
      });

      it ("deserializes from a full dashboard URL", () => {
         const hash = serializeSettings ();
         const fullUrl = `https://qczar.github.io/bhabot/admin?server=123456789#${hash}`;
         const deserialized = deserializeSettings (fullUrl);

         expect (deserialized.ONBOARDING_MIN_LENGTH).toBe (50);
      });

      it ("deserializes from a raw JSON string", () => {
         const jsonStr = JSON.stringify ({
            CHANNEL_ADMIN: "999888777",
            ALLOW_EVERYONE_PING: true
         });
         const deserialized = deserializeSettings (jsonStr);

         expect (deserialized.CHANNEL_ADMIN).toBe ("999888777");
         expect (deserialized.ALLOW_EVERYONE_PING).toBe (true);
      });

      it ("unwraps .settings property if present", () => {
         const payload = {
            version: 1,
            settings: {
               CHANNEL_ADMIN: "111222333"
            }
         };
         const hash = Buffer.from (JSON.stringify (payload)).toString ("base64");
         const deserialized = deserializeSettings (hash);

         expect (deserialized.CHANNEL_ADMIN).toBe ("111222333");
      });

      it ("throws an error on invalid / malformed input", () => {
         expect (() => deserializeSettings ("not-valid-json-or-base64-{}[]")).toThrow ();
         expect (() => deserializeSettings ("[]")).toThrow ("Settings payload must be a JSON object.");
      });
   });

   describe ("applyImportedSettings", () => {
      it ("applies settings to guild scope and updates in-memory cache", async () => {
         const guildId = "guild-test-123";
         const toImport = {
            CHANNEL_ADMIN: "<#channel-123>",
            ALLOW_EVERYONE_PING: true,
            COOLDOWN_USER_PING: 120,
            UNKNOWN_KEY: "should-be-ignored"
         };

         const result = await applyImportedSettings (mockDb, guildId, toImport);

         expect (result.updated).toEqual (expect.arrayContaining ([
            "CHANNEL_ADMIN",
            "ALLOW_EVERYONE_PING",
            "COOLDOWN_USER_PING"
         ]));
         expect (result.ignored).toContain ("UNKNOWN_KEY");
         expect (result.failed).toHaveLength (0);

         expect (guildSettings[guildId]?.CHANNEL_ADMIN).toBe ("channel-123");
         expect (guildSettings[guildId]?.ALLOW_EVERYONE_PING).toBe (true);
         expect (guildSettings[guildId]?.COOLDOWN_USER_PING).toBe (120);
      });

      it ("handles validation errors gracefully", async () => {
         const toImport = {
            MEETUP_TIMEZONE: "Invalid/Timezone_Name"
         };

         const result = await applyImportedSettings (mockDb, null, toImport);

         expect (result.failed).toHaveLength (1);
         expect (result.failed[0].key).toBe ("MEETUP_TIMEZONE");
      });
   });
});
