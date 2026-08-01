import { registeredActivityRoles } from "./ActivityRoles";

describe ("registeredActivityRoles", () => {
   it ("returns only registered roles that belong to the requested guild", () => {
      const subscriptions = [
         { id: "guild-a-games" },
         { id: "guild-b-games" },
         { id: "guild-a-hiking" }
      ];
      const guildRoles = [
         { id: "guild-a-hiking", name: "Hiking" },
         { id: "guild-a-games", name: "Board Games" },
         { id: "unregistered", name: "Unregistered" }
      ];

      expect (registeredActivityRoles (subscriptions, guildRoles)).toEqual ([
         { id: "guild-a-games", name: "Board Games" },
         { id: "guild-a-hiking", name: "Hiking" }
      ]);
   });

   it ("does not expose mass-mention roles", () => {
      expect (registeredActivityRoles (
         [{ id: "everyone" }, { id: "here" }],
         [{ id: "everyone", name: "@everyone" }, { id: "here", name: "here" }]
      )).toEqual ([]);
   });
});
