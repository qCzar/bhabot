import { getWhitelistedChannelIds } from "./ping-whitelist";

export type Platform = {
   id: string;
   name: string;
};

type PlatformChoice = {
   name: string;
   value: string;
};

export function getPlatformChoices (
   forums: ReadonlyArray<{ id: string; availableTags: ReadonlyArray<Platform> }>,
   whitelistRaw: string
): Platform[] {
   const whitelistedIds = new Set (getWhitelistedChannelIds (whitelistRaw));
   const platforms = forums
      .filter (forum => whitelistedIds.has (forum.id))
      .flatMap (forum => forum.availableTags);

   return [...new Map (platforms.map (platform => [platform.id, platform])).values ()];
}

export function getPlatformAutocompleteChoices (
   platforms: ReadonlyArray<Platform>,
   searchRaw: string
): PlatformChoice[] {
   const search = searchRaw.toLowerCase ();

   return platforms
      .filter (platform => platform.name.toLowerCase ().includes (search))
      .slice (0, 25)
      .map (platform => ({ name: platform.name, value: platform.id }));
}

export function resolvePlatform (
   platforms: ReadonlyArray<Platform>,
   selection: string
): Platform | undefined {
   const normalizedSelection = selection.trim ().toLowerCase ();

   return platforms.find (platform =>
      platform.id === selection || platform.name.toLowerCase () === normalizedSelection
   );
}
