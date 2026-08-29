import * as z from "zod";

const timezone = z.string ().refine (value => {
   try {
      new Intl.DateTimeFormat ("en-US", { timeZone: value }).format ();
      return true;
   }
   catch (_) {
      return false;
   }
}, "Must be a valid IANA timezone such as America/Chicago");

const envSchema = z.object ({
   CHANNEL_ADMIN: z.string (),
   CHANNEL_BOT_ADMIN: z.string (),
   CHANNEL_MEETUPS: z.string (),
   CHANNEL_MEETUPS_DIR: z.string (),
   CHANNEL_MEMBER_REPORTS: z.string ().default (""),
   CHANNEL_SHITPOST: z.string (),
   CHANNEL_THROWDOWN: z.string (),
   CHANNEL_BOT_LOG: z.string (),
   DISCORD_TOKEN: z.string (),
   DISCORD_CLIENT_ID: z.string (),
   HAPI_HOST: z.string (),
   HTTP_PORT: z.string (),
   MONGO_URL: z.string (),
   NODE_ENV: z.string ().default ("development"),
   ONBOARDING_CHANNEL_ID: z.string (),
   ONBOARDING_ROLE_ID: z.string (),
   ONBOARDING_MIN_LENGTH: z.coerce.number().default (50),
   REDDIT_SECRET: z.string (),
   SERVER_ID: z.string (),
   MEETUP_FORM_URL: z.string ().default ("https://qczar.github.io/bhabot/"),
   MEETUP_API_URL: z.string ().default ("https://meetup.rochesterbored.com"),
   MEETUP_RECURRENCE_WINDOW_DAYS: z.coerce.number ().int ().min (1).max (365).default (21),
   MEETUP_TIMEZONE: timezone.default ("America/Chicago"),
   MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS: z.coerce.number().default (24),
   MEETUP_AUTOCANCEL_BEFORE_START_HOURS: z.coerce.number().default (2),
   PING_WHITELIST_CHANNELS: z.string ().default (""),
   ALLOW_EVERYONE_PING: z.coerce.boolean().default(false),
   COOLDOWN_USER_PING: z.coerce.number().default(60),
   COOLDOWN_ROLE_PING: z.coerce.number().default(7200),
   LOG_MEMBER_BANS: z.coerce.boolean().default(true),
   LOG_MEMBER_KICKS: z.coerce.boolean().default(true),
   LOG_MEMBER_MESSAGE_DELETES: z.coerce.boolean().default(true)
});

export type environment = z.infer<typeof envSchema>;

const defaultTestEnv: environment = {
   CHANNEL_ADMIN: "test-admin",
   CHANNEL_BOT_ADMIN: "test-bot-admin",
   CHANNEL_MEETUPS: "test-meetups",
   CHANNEL_MEETUPS_DIR: "test-meetups-dir",
   CHANNEL_MEMBER_REPORTS: "test-member-reports",
   CHANNEL_SHITPOST: "test-shitpost",
   CHANNEL_THROWDOWN: "test-throwdown",
   CHANNEL_BOT_LOG: "test-bot-log",
   DISCORD_TOKEN: "test-token",
   DISCORD_CLIENT_ID: "test-client-id",
   HAPI_HOST: "localhost",
   HTTP_PORT: "8080",
   MONGO_URL: "mongodb://localhost:27017/test",
   NODE_ENV: "test",
   ONBOARDING_CHANNEL_ID: "test-onboarding-channel",
   ONBOARDING_ROLE_ID: "test-onboarding-role",
   ONBOARDING_MIN_LENGTH: 50,
   REDDIT_SECRET: "test-reddit-secret",
   SERVER_ID: "test-server-id",
   MEETUP_FORM_URL: "https://qczar.github.io/bhabot/",
   MEETUP_API_URL: "https://meetup.rochesterbored.com",
   MEETUP_RECURRENCE_WINDOW_DAYS: 21,
   MEETUP_TIMEZONE: "America/Chicago",
   MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS: 24,
   MEETUP_AUTOCANCEL_BEFORE_START_HOURS: 2,
   PING_WHITELIST_CHANNELS: "",
   ALLOW_EVERYONE_PING: false,
   COOLDOWN_USER_PING: 60,
   COOLDOWN_ROLE_PING: 7200,
   LOG_MEMBER_BANS: true,
   LOG_MEMBER_KICKS: true,
   LOG_MEMBER_MESSAGE_DELETES: true
};

const parsedEnv = envSchema.safeParse(process.env);

// Global fallback settings
export let env: environment = parsedEnv.success
   ? parsedEnv.data
   : (process.env.NODE_ENV === "test" ? defaultTestEnv : envSchema.parse(process.env));

// Guild-specific settings cache
export const guildSettings: Record<string, Partial<environment>> = {};

export const dynamicKeys = [
   "CHANNEL_ADMIN", "CHANNEL_BOT_ADMIN", "CHANNEL_MEETUPS", "CHANNEL_MEETUPS_DIR",
   "CHANNEL_MEMBER_REPORTS", "CHANNEL_SHITPOST", "CHANNEL_THROWDOWN", "CHANNEL_BOT_LOG", "ONBOARDING_CHANNEL_ID",
   "ONBOARDING_ROLE_ID", "ONBOARDING_MIN_LENGTH", "REDDIT_SECRET", "MEETUP_RECURRENCE_WINDOW_DAYS", "MEETUP_TIMEZONE",
   "MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS", "MEETUP_AUTOCANCEL_BEFORE_START_HOURS",
   "PING_WHITELIST_CHANNELS", "ALLOW_EVERYONE_PING", "COOLDOWN_USER_PING", "COOLDOWN_ROLE_PING",
   "LOG_MEMBER_BANS", "LOG_MEMBER_KICKS", "LOG_MEMBER_MESSAGE_DELETES"
] as const;

export type DynamicKey = typeof dynamicKeys[number];

import { Db } from "mongodb";

export const initSettings = async (db: Db) => {
   const collection = db.collection("settings");
   // We will loop through all existing settings in DB and populate the cache
   const docs = await collection.find({}).toArray();
   
   for (const doc of docs) {
      if (dynamicKeys.includes(doc.key as DynamicKey)) {
         if (doc.guildId) {
            guildSettings[doc.guildId] = guildSettings[doc.guildId] || {};
            (guildSettings[doc.guildId] as any)[doc.key] = doc.value;
         } else {
            (env as any)[doc.key] = doc.value;
         }
      }
   }
   
   // Backfill missing global defaults if not present
   for (const key of dynamicKeys) {
      if ((env as any)[key] === undefined || process.env[key] !== undefined) {
         // Process.env acts as the ultimate default for initial setup
         if (!docs.some(d => d.key === key && !d.guildId)) {
            await collection.updateOne({ key, guildId: null }, { $set: { value: env[key] } }, { upsert: true });
         }
      }
   }
   
   // re-validate env to ensure global types are still correct
   env = envSchema.parse(env);
};

export const getRawSetting = (guildId: string | null | undefined, key: DynamicKey): any => {
   if (guildId && guildSettings[guildId] && guildSettings[guildId][key] !== undefined) {
      return guildSettings[guildId][key];
   }
   return env[key];
};

export const getSetting = (guildId: string | null | undefined, key: DynamicKey): any => {
   const val = getRawSetting(guildId, key);
   if (val !== undefined && val !== null && val !== "") {
      return val;
   }

   // Bidirectional fallback between CHANNEL_BOT_ADMIN and CHANNEL_ADMIN
   if (key === "CHANNEL_BOT_ADMIN") {
      const fallbackVal = getRawSetting(guildId, "CHANNEL_ADMIN");
      if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== "") {
         return fallbackVal;
      }
   } else if (key === "CHANNEL_ADMIN") {
      const fallbackVal = getRawSetting(guildId, "CHANNEL_BOT_ADMIN");
      if (fallbackVal !== undefined && fallbackVal !== null && fallbackVal !== "") {
         return fallbackVal;
      }
   }

   return val;
};

export const updateSetting = async (db: Db, guildId: string | null, key: DynamicKey, value: any) => {
   // Validate just the new value by parsing a dummy env
   const testEnv = { ...env, [key]: value };
   const parsed = envSchema.parse(testEnv);

   const collection = db.collection("settings");
   await collection.updateOne(
      { key, guildId: guildId || null }, 
      { $set: { value: parsed[key] } }, 
      { upsert: true }
   );
   
   if (guildId) {
      guildSettings[guildId] = guildSettings[guildId] || {};
      (guildSettings[guildId] as any)[key] = parsed[key];
   } else {
      (env as any)[key] = parsed[key];
   }
};
