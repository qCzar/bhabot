import * as z from "zod";

const envSchema = z.object ({
   CHANNEL_ADMIN: z.string (),
   CHANNEL_BOT_ADMIN: z.string (),
   CHANNEL_MEETUPS: z.string (),
   CHANNEL_MEETUPS_DIR: z.string (),
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
   MEETUP_API_URL: z.string ().default ("http://meetup.rochesterbored.com"),
   PING_WHITELIST_CHANNELS: z.string ().default (""),
   ALLOW_EVERYONE_PING: z.coerce.boolean().default(false),
   COOLDOWN_USER_PING: z.coerce.number().default(60),
   COOLDOWN_ROLE_PING: z.coerce.number().default(7200)
});

export type environment = z.infer<typeof envSchema>;

// Global fallback settings
export let env: environment = envSchema.parse(process.env);

// Guild-specific settings cache
export const guildSettings: Record<string, Partial<environment>> = {};

export const dynamicKeys = [
   "CHANNEL_ADMIN", "CHANNEL_BOT_ADMIN", "CHANNEL_MEETUPS", "CHANNEL_MEETUPS_DIR",
   "CHANNEL_SHITPOST", "CHANNEL_THROWDOWN", "CHANNEL_BOT_LOG", "ONBOARDING_CHANNEL_ID",
   "ONBOARDING_ROLE_ID", "ONBOARDING_MIN_LENGTH", "REDDIT_SECRET",
   "PING_WHITELIST_CHANNELS", "ALLOW_EVERYONE_PING", "COOLDOWN_USER_PING", "COOLDOWN_ROLE_PING"
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

export const getSetting = (guildId: string | null | undefined, key: DynamicKey): any => {
   if (guildId && guildSettings[guildId] && guildSettings[guildId][key] !== undefined) {
      return guildSettings[guildId][key];
   }
   return env[key];
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
