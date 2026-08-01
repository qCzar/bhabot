import { getPlatformAutocompleteChoices, getPlatformChoices, resolvePlatform } from "./play-platforms";

describe ("getPlatformChoices", () => {
   const forums = [
      {
         id: "approved-forum",
         availableTags: [
            { id: "pc", name: "PC" },
            { id: "switch", name: "Nintendo Switch" }
         ]
      },
      {
         id: "other-forum",
         availableTags: [{ id: "mobile", name: "Mobile" }]
      }
   ];

   it ("returns tags only from whitelisted forums", () => {
      expect (getPlatformChoices (forums, "approved-forum")).toEqual ([
         { id: "pc", name: "PC" },
         { id: "switch", name: "Nintendo Switch" }
      ]);
   });

   it ("returns tags from each whitelisted forum", () => {
      expect (getPlatformChoices (forums, "approved-forum, other-forum")).toEqual ([
         { id: "pc", name: "PC" },
         { id: "switch", name: "Nintendo Switch" },
         { id: "mobile", name: "Mobile" }
      ]);
   });

   it ("returns no platforms when no forum is whitelisted", () => {
      expect (getPlatformChoices (forums, "some-text-channel")).toEqual ([]);
   });
});

describe ("getPlatformAutocompleteChoices", () => {
   const platforms = [
      { id: "pc", name: "PC" },
      { id: "switch", name: "Nintendo Switch" },
      { id: "mobile", name: "Mobile" }
   ];

   it ("uses the forum tag ID as Discord's autocomplete value", () => {
      expect (getPlatformAutocompleteChoices (platforms, "switch")).toEqual ([
         { name: "Nintendo Switch", value: "switch" }
      ]);
   });

   it ("returns at most Discord's limit of 25 choices", () => {
      const manyPlatforms = Array.from ({ length: 30 }, (_, index) => ({
         id: `tag-${index}`,
         name: `Platform ${index}`
      }));

      expect (getPlatformAutocompleteChoices (manyPlatforms, "")).toHaveLength (25);
   });
});

describe ("resolvePlatform", () => {
   const platforms = [
      { id: "pc-tag-id", name: "PC" },
      { id: "switch-tag-id", name: "Nintendo Switch" }
   ];

   it ("resolves an autocomplete tag ID", () => {
      expect (resolvePlatform (platforms, "switch-tag-id")).toEqual (platforms[1]);
   });

   it ("also resolves a manually entered tag name", () => {
      expect (resolvePlatform (platforms, "  nintendo switch ")).toEqual (platforms[1]);
   });

   it ("rejects text that is not an available forum tag", () => {
      expect (resolvePlatform (platforms, "PlayStation")).toBeUndefined ();
   });
});
