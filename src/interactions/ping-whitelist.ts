/** Parses the configured comma-separated channel ID whitelist. */
export function getWhitelistedChannelIds (whitelistRaw: string): string[] {
   return whitelistRaw
      .split (",")
      .map (id => id.trim ())
      .filter (Boolean);
}

/**
 * Returns whether a channel may send mass mentions based on the configured
 * whitelist. Threads inherit approval from their parent.
 */
export function isPingWhitelistedChannel (
   whitelistRaw: string,
   channelId: string,
   parentId?: string | null
): boolean {
   const whitelistedIds = getWhitelistedChannelIds (whitelistRaw);
   return whitelistedIds.includes (channelId) || (!!parentId && whitelistedIds.includes (parentId));
}
