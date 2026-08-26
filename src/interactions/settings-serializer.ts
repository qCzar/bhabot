import { Db } from "mongodb";
import { DynamicKey, dynamicKeys, env, getSetting, updateSetting } from "../environment";

const withoutTrailingSlash = (url: string): string => url.replace (/\/+$/, "");

/**
 * Serializes all dynamic settings for a given guild (or global defaults) into a Base64-encoded JSON string.
 */
export const serializeSettings = (guildId?: string | null): string => {
   const settings: Record<string, any> = {};
   for (const key of dynamicKeys) {
      settings[key] = getSetting (guildId, key);
   }
   return Buffer.from (JSON.stringify (settings), "utf-8").toString ("base64");
};

/**
 * Builds the URL for the GitHub Pages admin dashboard with the settings hash in the fragment.
 */
export const adminDashboardUrl = (formUrl: string, hash: string, guildId?: string | null): string => {
   const base = withoutTrailingSlash (formUrl);
   const url = new URL (`${base}/admin`);
   if (guildId) url.searchParams.set ("server", guildId);
   return `${url.toString ()}#${hash}`;
};

/**
 * Deserializes an input string (which can be a dashboard URL with #hash, a raw Base64 hash, or JSON)
 * into a settings dictionary.
 */
export const deserializeSettings = (input: string): Record<string, any> => {
   const trimmed = input.trim ();
   let raw = trimmed;

   // If the input is a URL containing a hash fragment, extract the hash
   if (raw.includes ("#")) {
      const hashIndex = raw.lastIndexOf ("#");
      raw = raw.slice (hashIndex + 1).trim ();
   }

   let parsed: any;

   // 1. Try decoding as Base64 JSON
   try {
      const jsonStr = Buffer.from (raw, "base64").toString ("utf-8");
      parsed = JSON.parse (jsonStr);
   }
   catch (_) {
      // 2. If Base64 fails, try parsing raw as direct JSON
      try {
         parsed = JSON.parse (trimmed);
      }
      catch (e) {
         throw new Error ("Invalid settings format. Expected a Base64 hash, dashboard URL, or JSON string.");
      }
   }

   if (!parsed || typeof parsed !== "object" || Array.isArray (parsed)) {
      throw new Error ("Settings payload must be a JSON object.");
   }

   // If wrapped in a .settings property (e.g. { settings: { ... } }), unwrap it
   if (parsed.settings && typeof parsed.settings === "object" && !Array.isArray (parsed.settings)) {
      return parsed.settings;
   }

   return parsed;
};

export interface ImportResult {
   updated: DynamicKey[];
   failed: { key: string; error: string }[];
   ignored: string[];
}

/**
 * Applies imported settings to MongoDB and the in-memory cache.
 */
export const applyImportedSettings = async (
   db: Db,
   guildId: string | null,
   settingsData: Record<string, any>
): Promise<ImportResult> => {
   const updated: DynamicKey[] = [];
   const failed: { key: string; error: string }[] = [];
   const ignored: string[] = [];

   for (const [key, value] of Object.entries (settingsData)) {
      if (!dynamicKeys.includes (key as DynamicKey)) {
         ignored.push (key);
         continue;
      }

      const dynamicKey = key as DynamicKey;
      let cleanValue = value;

      // Automatically strip mention wrappers if setting a channel/role ID key
      if (typeof cleanValue === "string" && (dynamicKey.startsWith ("CHANNEL_") || dynamicKey.endsWith ("_ID") || dynamicKey.includes ("CHANNELS"))) {
         cleanValue = cleanValue.replace (/[<#@&>]/g, "");
      }

      try {
         await updateSetting (db, guildId, dynamicKey, cleanValue);
         updated.push (dynamicKey);
      }
      catch (e) {
         failed.push ({
            key: dynamicKey,
            error: e instanceof Error ? e.message : "Validation failed"
         });
      }
   }

   return { updated, failed, ignored };
};
