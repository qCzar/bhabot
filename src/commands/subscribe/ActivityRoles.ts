type RegisteredActivity = { id: string };
type GuildRole = { id: string; name: string };

export const registeredActivityRoles = (
   subscriptions: RegisteredActivity[],
   guildRoles: GuildRole[]
): GuildRole[] => {
   const registeredIds = new Set (subscriptions.map (subscription => subscription.id));

   return guildRoles
      .filter (role => registeredIds.has (role.id))
      .filter (role => !["everyone", "here"].includes (role.name.replace (/^@/, "").toLowerCase ()))
      .map (role => ({ id: role.id, name: role.name }))
      .sort ((left, right) => left.name.localeCompare (right.name));
};
