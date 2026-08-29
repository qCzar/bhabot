import * as Discord from "discord.js";
import { env, guildSettings, getSetting, getRawSetting } from "../environment";
import {
   checkSettingDependencies,
   checkDiscordPermissions,
   validateGuildSettings,
   getSettingChangeWarnings,
   isValidTimezone,
   sendAdminAlert
} from "./settings-validator";

describe("settings-validator", () => {
   const testGuildId = "guild-validator-test";

   beforeEach(() => {
      guildSettings[testGuildId] = {};
   });

   describe("isValidTimezone", () => {
      it("validates correct IANA timezones", () => {
         expect(isValidTimezone("America/Chicago")).toBe(true);
         expect(isValidTimezone("America/New_York")).toBe(true);
         expect(isValidTimezone("UTC")).toBe(true);
      });

      it("rejects invalid timezones", () => {
         expect(isValidTimezone("Invalid/Timezone")).toBe(false);
         expect(isValidTimezone("")).toBe(false);
      });
   });

   describe("Bidirectional Fallback in getSetting", () => {
      it("falls back to CHANNEL_ADMIN when CHANNEL_BOT_ADMIN is empty", () => {
         guildSettings[testGuildId] = {
            CHANNEL_ADMIN: "admin-channel-id",
            CHANNEL_BOT_ADMIN: ""
         };

         expect(getSetting(testGuildId, "CHANNEL_BOT_ADMIN")).toBe("admin-channel-id");
         expect(getSetting(testGuildId, "CHANNEL_ADMIN")).toBe("admin-channel-id");
      });

      it("falls back to CHANNEL_BOT_ADMIN when CHANNEL_ADMIN is empty", () => {
         guildSettings[testGuildId] = {
            CHANNEL_ADMIN: "",
            CHANNEL_BOT_ADMIN: "bot-admin-channel-id"
         };

         expect(getSetting(testGuildId, "CHANNEL_ADMIN")).toBe("bot-admin-channel-id");
         expect(getSetting(testGuildId, "CHANNEL_BOT_ADMIN")).toBe("bot-admin-channel-id");
      });

      it("returns respective values when both are configured", () => {
         guildSettings[testGuildId] = {
            CHANNEL_ADMIN: "admin-chan",
            CHANNEL_BOT_ADMIN: "bot-admin-chan"
         };

         expect(getSetting(testGuildId, "CHANNEL_ADMIN")).toBe("admin-chan");
         expect(getSetting(testGuildId, "CHANNEL_BOT_ADMIN")).toBe("bot-admin-chan");
      });
   });

   describe("checkSettingDependencies", () => {
      it("detects missing onboarding role when onboarding channel is set", () => {
         guildSettings[testGuildId] = {
            ONBOARDING_CHANNEL_ID: "onboarding-chan",
            ONBOARDING_ROLE_ID: ""
         };

         const results = checkSettingDependencies(testGuildId);
         const onboardingError = results.find(r => r.key === "ONBOARDING_CHANNEL_ID");
         expect(onboardingError).toBeDefined();
         expect(onboardingError?.status).toBe("error");
         expect(onboardingError?.symbol).toBe("❌");
      });

      it("detects unlinked onboarding role when onboarding channel is missing", () => {
         guildSettings[testGuildId] = {
            ONBOARDING_CHANNEL_ID: "",
            ONBOARDING_ROLE_ID: "onboarding-role"
         };

         const results = checkSettingDependencies(testGuildId);
         const onboardingWarning = results.find(r => r.key === "ONBOARDING_ROLE_ID");
         expect(onboardingWarning).toBeDefined();
         expect(onboardingWarning?.status).toBe("warning");
         expect(onboardingWarning?.symbol).toBe("⚠️");
      });

      it("detects missing meetup directory when meetup channel is set", () => {
         guildSettings[testGuildId] = {
            CHANNEL_MEETUPS: "meetups-chan",
            CHANNEL_MEETUPS_DIR: ""
         };

         const results = checkSettingDependencies(testGuildId);
         const dirWarning = results.find(r => r.key === "CHANNEL_MEETUPS");
         expect(dirWarning).toBeDefined();
         expect(dirWarning?.status).toBe("warning");
         expect(dirWarning?.symbol).toBe("⚠️");
      });

      it("detects missing shitpost channel when reddit secret is set", () => {
         guildSettings[testGuildId] = {
            REDDIT_SECRET: "my-secret",
            CHANNEL_SHITPOST: ""
         };

         const results = checkSettingDependencies(testGuildId);
         const redditError = results.find(r => r.key === "REDDIT_SECRET");
         expect(redditError).toBeDefined();
         expect(redditError?.status).toBe("error");
         expect(redditError?.symbol).toBe("❌");
      });
   });

   describe("getSettingChangeWarnings", () => {
      it("warns about missing onboarding role when ONBOARDING_CHANNEL_ID is updated", () => {
         guildSettings[testGuildId] = {
            ONBOARDING_ROLE_ID: ""
         };

         const warnings = getSettingChangeWarnings(testGuildId, "ONBOARDING_CHANNEL_ID", "new-chan-id");
         expect(warnings.length).toBeGreaterThan(0);
         expect(warnings[0]).toContain("ONBOARDING_ROLE_ID");
      });

      it("warns about missing meetup directory when CHANNEL_MEETUPS is updated", () => {
         guildSettings[testGuildId] = {
            CHANNEL_MEETUPS_DIR: ""
         };

         const warnings = getSettingChangeWarnings(testGuildId, "CHANNEL_MEETUPS", "new-meetups-chan");
         expect(warnings.length).toBeGreaterThan(0);
         expect(warnings[0]).toContain("CHANNEL_MEETUPS_DIR");
      });
   });

   describe("validateGuildSettings", () => {
      it("creates a comprehensive report with healthy/warning/error counts", async () => {
         guildSettings[testGuildId] = {
            CHANNEL_ADMIN: "admin-id",
            CHANNEL_BOT_ADMIN: "bot-admin-id",
            ONBOARDING_CHANNEL_ID: "onboard-chan",
            ONBOARDING_ROLE_ID: "", // error
            CHANNEL_MEETUPS: "meetup-chan",
            CHANNEL_MEETUPS_DIR: "" // warning
         };

         const report = await validateGuildSettings(null, testGuildId);
         expect(report.isHealthy).toBe(false);
         expect(report.summary.error).toBeGreaterThan(0);
         expect(report.summary.warning).toBeGreaterThan(0);
      });
   });
});
