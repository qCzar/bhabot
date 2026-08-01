import { getPlatformChoices } from "./play";

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
