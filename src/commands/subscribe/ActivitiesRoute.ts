import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import * as Discord from "discord.js";

import * as Subscription from "./Subscription";
import { registeredActivityRoles } from "./ActivityRoles";

export const getActivityRoles = (client: Discord.Client) => async (req: Hapi.Request): Promise<unknown> => {
   const serverId = req.query?.server;

   if (typeof serverId !== "string" || !/^\d+$/.test (serverId))
      return Boom.badRequest ("A valid Discord server ID is required");

   const guild = client.guilds.cache.get (serverId)
      ?? await client.guilds.fetch (serverId).catch (() => null);

   if (!guild)
      return Boom.notFound ("BoredBot is not available in that server");

   const [subscriptions, roles] = await Promise.all ([
      Subscription.collection ().then (collection => collection.find ().toArray ()),
      guild.roles.fetch ()
   ]);

   return registeredActivityRoles (subscriptions, [...roles.values ()]);
};
