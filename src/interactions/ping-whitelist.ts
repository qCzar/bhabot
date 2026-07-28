/**
 * Returns whether a channel may send mass mentions based on the configured
 * comma-separated whitelist. Threads inherit approval from their parent.
 */
export function isPingWhitelistedChannel (
   whitelistRaw: string,
   channelId: string,
   parentId?: string | null
): boolean {
   const whitelistedIds = whitelistRaw
      .split (",")
      .map (id => id.trim ())
      .filter (Boolean);

   return whitelistedIds.includes (channelId) || (!!parentId && whitelistedIds.includes (parentId));
}
