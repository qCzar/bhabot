import * as Discord from "discord.js";
import * as Interaction from "../interaction";
import * as Subscription from "../commands/subscribe/Subscription";
import { interactionFailed } from "../errors";
import { getSetting } from "../environment";

const list = async (interaction: Discord.ChatInputCommandInteraction) => {
   const collection = await Subscription.collection();
   const subs = await collection.find().toArray();
   const names = subs.map(sub => sub.name).join(", ");

   interaction
      .reply(names.length > 0
         ? `Available activities: ${names}`
         : "There are no activities available")
      .catch(interactionFailed);
};

const join = async (interaction: Discord.ChatInputCommandInteraction) => {
   const name = interaction.options.getString("name");

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
   const name = interaction.options.getString("name");

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

const pingRole = async (interaction: Discord.ChatInputCommandInteraction) => {
   const name = interaction.options.getString("name");
   const message = interaction.options.getString("message");

   if (!name || !message)
      return interaction.reply({ content: "You must provide an activity name and a message", ephemeral: true });

   const lowerName = name.toLowerCase();
   const isSpecial = lowerName === "everyone" || lowerName === "here";

   if (isSpecial) {
      const whitelistStr = getSetting(interaction.guildId, "PING_WHITELIST_CHANNELS") || "";
      const whitelist = whitelistStr.split(",").map((id: string) => id.trim()).filter((id: string) => id.length > 0);
      if (!whitelist.includes(interaction.channelId)) {
         return interaction
            .reply({ content: `You can only ping @${lowerName} in whitelisted channels.`, ephemeral: true })
            .catch(interactionFailed);
      }

      return interaction
         .reply({
            content: `@${lowerName}\n${message}`,
            allowedMentions: { parse: ["everyone"] }
         })
         .catch(interactionFailed);
   }

   const collection = await Subscription.collection();
   const sub = await collection.findOne({ name: lowerName });

   if (!sub)
      return interaction
         .reply({ content: `No activity named '${name}' found. Use '/activity list' to view available activities`, ephemeral: true })
         .catch(interactionFailed);

   interaction
      .reply({
         content: `<@&${sub.id}>\n${message}`,
         allowedMentions: { roles: [sub.id] }
      })
      .catch(interactionFailed);
};

const adminAdd = async (interaction: Discord.ChatInputCommandInteraction) => {
   if (interaction.channelId !== getSetting(interaction.guildId, "CHANNEL_BOT_ADMIN"))
      return interaction
         .reply({ content: "This command can only be used in the admin channel", ephemeral: true })
         .catch(interactionFailed);

   const role = interaction.options.getRole("role");

   if (!role)
      return interaction
         .reply({ content: "You must provide a role to add", ephemeral: true })
         .catch(interactionFailed);

   const collection = await Subscription.collection();
   const existing = await collection.findOne({ id: role.id });

   if (existing)
      return interaction
         .reply({ content: `Role '${role.name}' already exists as an activity`, ephemeral: true })
         .catch(interactionFailed);

   await collection.insertOne({
      id: role.id,
      name: role.name.toLowerCase()
   });

   interaction
      .reply(`Added ${role.name} (${role.id}) to available activities`)
      .catch(interactionFailed);
};

const adminRemove = async (interaction: Discord.ChatInputCommandInteraction) => {
   if (interaction.channelId !== getSetting(interaction.guildId, "CHANNEL_BOT_ADMIN"))
      return interaction
         .reply({ content: "This command can only be used in the admin channel", ephemeral: true })
         .catch(interactionFailed);

   const name = interaction.options.getString("name");

   if (!name)
      return interaction
         .reply({ content: "You must provide an activity name to remove it", ephemeral: true })
         .catch(interactionFailed);

   const collection = await Subscription.collection();
   const sub = await collection.findOne({ name });

   if (!sub)
      return interaction
         .reply({ content: `Can't remove activity: No activity named '${name}' exists`, ephemeral: true })
         .catch(interactionFailed);

   await collection.deleteOne({ name });
   interaction
      .reply(`Removed ${name} from activities`)
      .catch(interactionFailed);
};

const { commandType, optionType } = Interaction;
export const activity = Interaction.make({
   config: [{
      name: "activity",
      description: "Manage activity subscriptions",
      type: commandType.slash,
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
               name: "name",
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
               name: "name",
               description: "The name of the activity to leave",
               required: true,
               autocomplete: true
            }]
         },
         {
            type: optionType.sub_command,
            name: "ping",
            description: "Ping an activity role",
            options: [
               {
                  type: optionType.string,
                  name: "name",
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
         },
         {
            type: optionType.sub_command_group,
            name: "admin",
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
                     name: "name",
                     description: "The name of the activity to remove",
                     required: true,
                     autocomplete: true
                  }]
               }
            ]
         }
      ]
   }],

   handle: interaction => {
      const group = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (group === "admin") {
         switch (subcommand) {
            case "add":
               adminAdd(interaction);
               break;
            case "remove":
               adminRemove(interaction);
               break;
            default:
               throw new Error(`Unrecognized admin subcommand '${subcommand}'`);
         }
         return;
      }

      switch (subcommand) {
         case "list":
            list(interaction);
            break;
         case "join":
            join(interaction);
            break;
         case "leave":
            leave(interaction);
            break;
         case "ping":
            pingRole(interaction);
            break;
         default:
            throw new Error(`Unrecognized subcommand '${subcommand}'`);
      }
   },

   autocomplete: async interaction => {
      const focusedValue = interaction.options.getFocused();
      const search = typeof focusedValue === "string" ? focusedValue.toLowerCase() : "";

      const collection = await Subscription.collection();
      const subsFromDb = await collection.find().toArray();

      const subs = subsFromDb.map(sub => ({ name: sub.name, value: sub.name }));

      const whitelistStr = getSetting(interaction.guildId, "PING_WHITELIST_CHANNELS") || "";
      const whitelist = whitelistStr.split(",").map((id: string) => id.trim()).filter((id: string) => id.length > 0);
      if (whitelist.includes(interaction.channelId)) {
         subs.push({ name: "everyone", value: "everyone" });
         subs.push({ name: "here", value: "here" });
      }

      const filtered = subs
         .filter(sub => sub.name.toLowerCase().includes(search))
         .slice(0, 25);

      await interaction.respond(filtered);
   }
});
