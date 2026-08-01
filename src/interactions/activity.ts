import * as Discord from "discord.js";
import * as Interaction from "../interaction";
import * as Subscription from "../commands/subscribe/Subscription";
import { interactionFailed } from "../errors";
import { getSetting } from "../environment";
import { formatActivityListMessages } from "./activity-list";

const list = async (interaction: Discord.ChatInputCommandInteraction) => {
   if (!(interaction.member instanceof Discord.GuildMember) || !interaction.guild)
      return interaction
         .reply({ content: "Activity subscriptions are only available in a server.", ephemeral: true })
         .catch(interactionFailed);

   const member = interaction.member;
   const guild = interaction.guild;
   const collection = await Subscription.collection();
   const subs = await collection.find().toArray();
   const activities = subs.flatMap(sub => {
      const role = guild.roles.cache.get(sub.id);
      return role ? [{ id: sub.id, name: role.name }] : [];
   });
   const joinedNames = activities
      .filter(activity => member.roles.cache.has(activity.id))
      .map(activity => activity.name);
   const availableNames = activities
      .filter(activity => !member.roles.cache.has(activity.id))
      .map(activity => activity.name);
   const messages = formatActivityListMessages(joinedNames, availableNames);

   await interaction
      .reply({ content: messages[0], ephemeral: true })
      .catch(interactionFailed);

   for (const content of messages.slice(1)) {
      await interaction
         .followUp({ content, ephemeral: true })
         .catch(interactionFailed);
   }
};

const join = async (interaction: Discord.ChatInputCommandInteraction) => {
   const name = interaction.options.getString("role");

   if (!name)
      return interaction.reply({ content: "You must provide an activity name", ephemeral: true });

   const collection = await Subscription.collection();
   const sub = await collection.findOne({ name: name.toLowerCase() });

   if (!sub)
      return interaction
         .reply({ content: `No activity named '${name}' found. Use '/activity list' to view available activities`, ephemeral: true })
         .catch(interactionFailed);

   if (!(interaction.member instanceof Discord.GuildMember))
      return interaction
         .reply({ content: "You cannot join activities in DMs", ephemeral: true })
         .catch(interactionFailed);

   if (interaction.member.roles.cache.has(sub.id))
      return interaction
         .reply({ content: `You are already Joined to ${sub.name}`, ephemeral: true })
         .catch(interactionFailed);

   await interaction.member.roles.add(sub.id);
   interaction
      .reply(`Joined to ${sub.name}`)
      .catch(interactionFailed);
};

const leave = async (interaction: Discord.ChatInputCommandInteraction) => {
   const name = interaction.options.getString("role");

   if (!name)
      return interaction.reply({ content: "You must provide an activity name", ephemeral: true });

   const collection = await Subscription.collection();
   const sub = await collection.findOne({ name: name.toLowerCase() });

   if (!sub)
      return interaction
         .reply({ content: `No activity named '${name}' found. Use '/activity list' to view available activities`, ephemeral: true })
         .catch(interactionFailed);

   if (!(interaction.member instanceof Discord.GuildMember))
      return interaction
         .reply({ content: "You cannot leave activities in DMs", ephemeral: true })
         .catch(interactionFailed);

   if (!interaction.member.roles.cache.has(sub.id))
      return interaction
         .reply({ content: `You are not joined to ${sub.name}`, ephemeral: true })
         .catch(interactionFailed);

   await interaction.member.roles.remove(sub.id);
   interaction
      .reply(`Left ${sub.name}`)
      .catch(interactionFailed);
};

const userPingCooldowns = new Map<string, number>();
const rolePingCooldowns = new Map<string, number>();

const pingRole = async (interaction: Discord.ChatInputCommandInteraction) => {
   const name = interaction.options.getString("role");
   const message = interaction.options.getString("message");

   if (!name || !message)
      return interaction.reply({ content: "You must provide an activity name and a message", ephemeral: true });

   const lowerName = name.toLowerCase();
   const isSpecial = lowerName === "everyone" || lowerName === "here";

   if (isSpecial) {
      return interaction
         .reply({
            content: `@${lowerName} cannot be mentioned with this command.`,
            ephemeral: true
         })
         .catch(interactionFailed);
   }

   const member = interaction.member as Discord.GuildMember;
   const isAdmin = member?.permissions?.has(Discord.PermissionFlagsBits.ManageGuild) || member?.permissions?.has(Discord.PermissionFlagsBits.KickMembers);
   const now = Date.now();

   if (!isAdmin) {
      const userCooldownDuration = getSetting(interaction.guildId, "COOLDOWN_USER_PING") * 1000;
      const lastUserPing = userPingCooldowns.get(member.id) || 0;
      if (now - lastUserPing < userCooldownDuration) {
         const remaining = Math.ceil((userCooldownDuration - (now - lastUserPing)) / 1000);
         return interaction.reply({ content: `You are on cooldown. Please wait ${remaining} seconds before pinging again.`, ephemeral: true }).catch(interactionFailed);
      }

      const roleCooldownDuration = getSetting(interaction.guildId, "COOLDOWN_ROLE_PING") * 1000;
      const lastRolePing = rolePingCooldowns.get(lowerName) || 0;
      if (now - lastRolePing < roleCooldownDuration) {
         const remaining = Math.ceil((roleCooldownDuration - (now - lastRolePing)) / 1000 / 60);
         return interaction.reply({ content: `This role is on cooldown. Please wait ${remaining} minutes before it can be pinged again.`, ephemeral: true }).catch(interactionFailed);
      }
   }

   const collection = await Subscription.collection();
   const sub = await collection.findOne({ name: lowerName });

   if (!sub)
      return interaction
         .reply({ content: `No activity named '${name}' found. Use '/activity list' to view available activities`, ephemeral: true })
         .catch(interactionFailed);

   userPingCooldowns.set(member.id, now);
   rolePingCooldowns.set(lowerName, now);

   interaction
      .reply({
         content: `${message} - <@&${sub.id}>`,
         allowedMentions: { roles: [sub.id] }
      })
      .catch(interactionFailed);
};

const getAdminChannelId = (guildId: string | null) => {
   const setting = getSetting(guildId, "CHANNEL_BOT_ADMIN") || "";
   return setting.replace(/[<#@&>]/g, "");
};

const adminAdd = async (interaction: Discord.ChatInputCommandInteraction) => {
   if (interaction.channelId !== getAdminChannelId(interaction.guildId))
      return interaction
         .reply({ content: "This command can only be used in the admin channel", ephemeral: true })
         .catch(interactionFailed);

   const role = interaction.options.getRole("role");
   const rolesStr = interaction.options.getString("roles");

   if (!role && !rolesStr)
      return interaction
         .reply({ content: "You must provide a single role or a string of multiple roles to add", ephemeral: true })
         .catch(interactionFailed);

   const collection = await Subscription.collection();

   if (role) {
      const existing = await collection.findOne({ id: role.id });
      if (existing)
         return interaction
            .reply({ content: `Role '${role.name}' already exists as an activity`, ephemeral: true })
            .catch(interactionFailed);

      await collection.insertOne({
         id: role.id,
         name: role.name.toLowerCase()
      });

      return interaction
         .reply(`Added ${role.name} (${role.id}) to available activities`)
         .catch(interactionFailed);
   }

   if (rolesStr) {
      const regex = /<@&(\d+)>/g;
      const matches = [...rolesStr.matchAll(regex)];
      if (matches.length === 0) {
         return interaction
            .reply({ content: "No valid role mentions found in the input string.", ephemeral: true })
            .catch(interactionFailed);
      }

      await interaction.deferReply({ ephemeral: false });
      let added = [];
      let existingNames = [];
      let notFound = [];

      const guild = interaction.guild;
      if (!guild) return;

      for (const match of matches) {
         const roleId = match[1];
         const r = guild.roles.cache.get(roleId);
         if (!r) {
            notFound.push(roleId);
            continue;
         }

         const isExisting = await collection.findOne({ id: r.id });
         if (isExisting) {
            existingNames.push(r.name);
            continue;
         }

         await collection.insertOne({
            id: r.id,
            name: r.name.toLowerCase()
         });
         added.push(r.name);
      }

      let msg = [];
      if (added.length > 0) msg.push(`Added ${added.length} activities: ${added.join(", ")}`);
      if (existingNames.length > 0) msg.push(`Skipped ${existingNames.length} already existing activities: ${existingNames.join(", ")}`);
      if (notFound.length > 0) msg.push(`Skipped ${notFound.length} unknown roles.`);

      return interaction
         .editReply({ content: msg.join("\n") })
         .catch(interactionFailed);
   }
};

const adminRemove = async (interaction: Discord.ChatInputCommandInteraction) => {
   if (interaction.channelId !== getAdminChannelId(interaction.guildId))
      return interaction
         .reply({ content: "This command can only be used in the admin channel", ephemeral: true })
         .catch(interactionFailed);

   const role = interaction.options.getString("role");
   const rolesStr = interaction.options.getString("roles");

   const collection = await Subscription.collection();

   if (!role && !rolesStr) {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      if (!guild) return;

      const allSubs = await collection.find().toArray();
      let pruned = [];
      for (const sub of allSubs) {
         if (!guild.roles.cache.has(sub.id)) {
            await collection.deleteOne({ id: sub.id });
            pruned.push(sub.name);
         }
      }

      if (pruned.length > 0) {
         return interaction
            .editReply({ content: `Pruned ${pruned.length} orphaned activities: ${pruned.join(", ")}` })
            .catch(interactionFailed);
      } else {
         return interaction
            .editReply({ content: `No orphaned activities found to prune.` })
            .catch(interactionFailed);
      }
   }

   if (role) {
      const lowerName = role.toLowerCase();
      const existing = await collection.findOne({ name: lowerName });

      if (!existing)
         return interaction
            .reply({ content: `Role '${role}' is not an activity`, ephemeral: true })
            .catch(interactionFailed);

      await collection.deleteOne({ name: lowerName });

      return interaction
         .reply(`Removed ${role} from available activities`)
         .catch(interactionFailed);
   }

   if (rolesStr) {
      await interaction.deferReply({ ephemeral: false });
      const names = rolesStr.split(",").map(s => s.trim().toLowerCase()).filter(s => s.length > 0);

      let removed = [];
      let notFound = [];

      for (const n of names) {
         const existing = await collection.findOne({ name: n });
         if (existing) {
            await collection.deleteOne({ name: n });
            removed.push(n);
         } else {
            notFound.push(n);
         }
      }

      let msg = [];
      if (removed.length > 0) msg.push(`Removed ${removed.length} activities: ${removed.join(", ")}`);
      if (notFound.length > 0) msg.push(`Skipped ${notFound.length} unknown activities: ${notFound.join(", ")}`);

      return interaction
         .editReply({ content: msg.join("\n") })
         .catch(interactionFailed);
   }
};

const { commandType, optionType } = Interaction;

export const activitySubcommandGroupConfig: Interaction.option = {
   type: optionType.sub_command_group,
   name: "activity",
   description: "Manage activity subscriptions",
   options: [
      {
         type: optionType.sub_command,
         name: "list",
         description: "List all available activities"
      },
      {
         type: optionType.sub_command,
         name: "join",
         description: "Join an activity",
         options: [{
            type: optionType.string,
            name: "role",
            description: "The name of the activity to join",
            required: true,
            autocomplete: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "leave",
         description: "Leave an activity",
         options: [{
            type: optionType.string,
            name: "role",
            description: "The name of the activity to leave",
            required: true,
            autocomplete: true
         }]
      }
   ]
};

export const mentionSubcommandConfig: Interaction.option = {
   type: optionType.sub_command,
   name: "mention",
   description: "Ping/mention an activity role",
   options: [
      {
         type: optionType.string,
         name: "role",
         description: "The name of the activity to ping",
         required: true,
         autocomplete: true
      },
      {
         type: optionType.string,
         name: "message",
         description: "The message to send",
         required: true
      }
   ]
};

export const activityAdminSubcommandGroupConfig: Interaction.option = {
   type: optionType.sub_command_group,
   name: "activity",
   description: "Admin commands for managing activities",
   options: [
      {
         type: optionType.sub_command,
         name: "add",
         description: "Add a role as an activity",
         options: [{
            type: optionType.role,
            name: "role",
            description: "The role to add as an activity",
            required: true
         }]
      },
      {
         type: optionType.sub_command,
         name: "remove",
         description: "Remove an activity",
         options: [{
            type: optionType.string,
            name: "role",
            description: "The name of the activity to remove",
            required: true,
            autocomplete: true
         }]
      }
   ]
};

export const handleActivitySubcommand = (interaction: Discord.ChatInputCommandInteraction) => {
   const subcommand = interaction.options.getSubcommand();
   switch (subcommand) {
      case "list":
         return list(interaction);
      case "join":
         join(interaction);
         break;
      case "leave":
         leave(interaction);
         break;
      default:
         throw new Error(`Unrecognized activity subcommand '${subcommand}'`);
   }
};

export const handleMentionSubcommand = (interaction: Discord.ChatInputCommandInteraction) => {
   pingRole(interaction);
};

export const handleActivityAdminSubcommand = (interaction: Discord.ChatInputCommandInteraction) => {
   const subcommand = interaction.options.getSubcommand();
   switch (subcommand) {
      case "add":
         adminAdd(interaction);
         break;
      case "remove":
         adminRemove(interaction);
         break;
      default:
         throw new Error(`Unrecognized activity admin subcommand '${subcommand}'`);
   }
};

export const handleActivityAutocomplete = async (interaction: Discord.AutocompleteInteraction) => {
   const focusedValue = interaction.options.getFocused();
   const search = typeof focusedValue === "string" ? focusedValue.toLowerCase() : "";

   const collection = await Subscription.collection();
   const subsFromDb = await collection.find().toArray();

   const subs = subsFromDb.map(sub => ({ name: sub.name, value: sub.name }));

   const filtered = subs
      .filter(sub => sub.name.toLowerCase().includes(search))
      .slice(0, 25);

   await interaction.respond(filtered);
};
