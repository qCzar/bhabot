import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { interaction } from "../interaction";
import { env, dynamicKeys, updateSetting, DynamicKey, getSetting } from "../environment";
import { logger } from "../logger";
import { handleActivityAdminSubcommand, handleActivityAutocomplete } from "./activity";
import { handleModSubcommand } from "./mod";
import { handleMeetupAdminSubcommand } from "./meetup";

const log = logger("boredbot");

const addGlobalOption = (option: any) => 
    option.setName("global")
        .setDescription("Apply globally (Bot Admin only)")
        .setRequired(false);

const config = new SlashCommandBuilder()
    .setName("boredbot")
    .setDescription("BoredBot administration and moderation commands")
    .setDefaultMemberPermissions(Discord.PermissionFlagsBits.KickMembers)
    // Subcommand Group: settings
    .addSubcommandGroup(group => group
        .setName("settings")
        .setDescription("Manage BoredBot settings")
        .addSubcommand(subcommand => subcommand
            .setName("get")
            .setDescription("Get a setting value")
            .addStringOption(option => {
                option.setName("key")
                    .setDescription("The setting key")
                    .setRequired(true);
                dynamicKeys.forEach(k => option.addChoices({ name: k, value: k }));
                return option;
            })
            .addBooleanOption(addGlobalOption)
        )
        .addSubcommand(subcommand => subcommand
            .setName("set")
            .setDescription("Set a setting value")
            .addStringOption(option => {
                option.setName("key")
                    .setDescription("The setting key")
                    .setRequired(true);
                dynamicKeys.forEach(k => option.addChoices({ name: k, value: k }));
                return option;
            })
            .addStringOption(option => option
                .setName("value")
                .setDescription("The new value")
                .setRequired(true)
            )
            .addBooleanOption(addGlobalOption)
        )
        .addSubcommand(subcommand => subcommand
            .setName("append")
            .setDescription("Append a value to a comma-separated list setting")
            .addStringOption(option => {
                option.setName("key")
                    .setDescription("The setting key")
                    .setRequired(true);
                dynamicKeys.forEach(k => option.addChoices({ name: k, value: k }));
                return option;
            })
            .addStringOption(option => option
                .setName("value")
                .setDescription("The value to append")
                .setRequired(true)
            )
            .addBooleanOption(addGlobalOption)
        )
        .addSubcommand(subcommand => subcommand
            .setName("remove_item")
            .setDescription("Remove a value from a comma-separated list setting")
            .addStringOption(option => {
                option.setName("key")
                    .setDescription("The setting key")
                    .setRequired(true);
                dynamicKeys.forEach(k => option.addChoices({ name: k, value: k }));
                return option;
            })
            .addStringOption(option => option
                .setName("value")
                .setDescription("The value to remove")
                .setRequired(true)
            )
            .addBooleanOption(addGlobalOption)
        )
    )
    // Subcommand Group: activity
    .addSubcommandGroup(group => group
        .setName("activity")
        .setDescription("Admin commands for managing activities")
        .addSubcommand(subcommand => subcommand
            .setName("add")
            .setDescription("Add a role as an activity")
            .addRoleOption(option => option
                .setName("role")
                .setDescription("The role to add as an activity")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("remove")
            .setDescription("Remove an activity")
            .addStringOption(option => option
                .setName("role")
                .setDescription("The name of the activity to remove")
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
    )
    // Subcommand Group: meetup
    .addSubcommandGroup(group => group
        .setName("meetup")
        .setDescription("Admin meetup commands")
        .addSubcommand(subcommand => subcommand
            .setName("refresh")
            .setDescription("Refresh all live meetup announcements")
        )
    )
    // Subcommand Group: mod
    .addSubcommandGroup(group => group
        .setName("mod")
        .setDescription("Commands meant to help make modding easier")
        .addSubcommand(subcommand => subcommand
            .setName("log")
            .setDescription("Log a note about a specific user")
            .addUserOption(option => option
                .setName("user")
                .setDescription("The user this note is about")
                .setRequired(true)
            )
            .addStringOption(option => option
                .setName("note")
                .setDescription("The note you want to save for this user")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("echo")
            .setDescription("Play simon says with bored bot (hey, dont abuse this!)")
            .addStringOption(option => option
                .setName("text")
                .setDescription("The text that bored bot will repeat")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("lookup")
            .setDescription("Look up notes that have been saved for a user")
            .addUserOption(option => option
                .setName("user")
                .setDescription("The user to lookup")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("multipost-exempt-add")
            .setDescription("Add a role that will be exempt from multipost detection")
            .addRoleOption(option => option
                .setName("role")
                .setDescription("The role to exempt")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("multipost-exempt-remove")
            .setDescription("Remove a role from multipost detection exemptions")
            .addRoleOption(option => option
                .setName("role")
                .setDescription("The role to remove")
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("multipost-exempt-list")
            .setDescription("List all roles currently exempt from multipost detection")
        )
    );

export const boredbot: interaction = {
    config: [config],
    handle: async (interaction, world) => {
        if (interaction.commandName !== "boredbot") return;

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // Perform authorization based on subcommand group
        const member = interaction.member as Discord.GuildMember;

        if (group === "settings" || group === "activity") {
            if (!member?.permissions?.has(Discord.PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: "You do not have Manage Server permissions to use settings or activity admin commands.", ephemeral: true });
                return;
            }
        } else {
            // mod and meetup admin commands require KickMembers permission
            if (!member?.permissions?.has(Discord.PermissionFlagsBits.KickMembers)) {
                await interaction.reply({ content: "You do not have Kick Members permissions to use moderation commands.", ephemeral: true });
                return;
            }
        }

        if (group === "settings") {
            const isGlobal = interaction.options.getBoolean("global") ?? false;
            const targetGuildId = isGlobal ? null : interaction.guildId;
            const scopeName = isGlobal ? "Global" : `Server (${targetGuildId})`;
            const key = interaction.options.getString("key", true) as DynamicKey;

            if (subcommand === "get") {
                const value = getSetting(targetGuildId, key);
                await interaction.reply({ content: `[${scopeName}] **${key}** is currently set to: \`${value}\``, ephemeral: true });
            } 
            else if (subcommand === "set") {
                let value = interaction.options.getString("value", true);
                // Automatically strip mention wrappers if setting a channel/role ID key
                if (key.startsWith("CHANNEL_") || key.endsWith("_ID") || key.includes("CHANNELS")) {
                    value = value.replace(/[<#@&>]/g, "");
                }
                try {
                    await updateSetting(world.mongodb, targetGuildId, key, value);
                    await interaction.reply({ content: `[${scopeName}] Successfully updated **${key}** to \`${value}\``, ephemeral: true });
                    log.info(`Setting ${key} updated by ${interaction.user.tag} in scope ${scopeName}`, { key, value, guildId: targetGuildId });
                } catch (e) {
                    log.error(`Failed to update setting ${key}`, e);
                    await interaction.reply({ content: `Failed to update setting: ${e instanceof Error ? e.message : 'Unknown error'}`, ephemeral: true });
                }
            }
            else if (subcommand === "append") {
                let valueToAdd = interaction.options.getString("value", true).trim();
                if (key.startsWith("CHANNEL_") || key.endsWith("_ID") || key.includes("CHANNELS")) {
                    valueToAdd = valueToAdd.replace(/[<#@&>]/g, "");
                }
                const currentValue = (getSetting(targetGuildId, key) as string) || "";
                
                const list = currentValue.split(",").map(i => i.trim()).filter(i => i.length > 0);
                if (list.includes(valueToAdd)) {
                    await interaction.reply({ content: `[${scopeName}] **${valueToAdd}** is already in **${key}**`, ephemeral: true });
                    return;
                }
                
                list.push(valueToAdd);
                const newValue = list.join(",");
                
                try {
                    await updateSetting(world.mongodb, targetGuildId, key, newValue);
                    await interaction.reply({ content: `[${scopeName}] Successfully appended to **${key}**. New value: \`${newValue}\``, ephemeral: true });
                    log.info(`Setting ${key} appended by ${interaction.user.tag} in scope ${scopeName}`, { key, value: newValue, guildId: targetGuildId });
                } catch (e) {
                    log.error(`Failed to append to setting ${key}`, e);
                    await interaction.reply({ content: `Failed to append to setting: ${e instanceof Error ? e.message : 'Unknown error'}`, ephemeral: true });
                }
            }
            else if (subcommand === "remove_item") {
                let valueToRemove = interaction.options.getString("value", true).trim();
                if (key.startsWith("CHANNEL_") || key.endsWith("_ID") || key.includes("CHANNELS")) {
                    valueToRemove = valueToRemove.replace(/[<#@&>]/g, "");
                }
                const currentValue = (getSetting(targetGuildId, key) as string) || "";
                
                let list = currentValue.split(",").map(i => i.trim()).filter(i => i.length > 0);
                if (!list.includes(valueToRemove)) {
                    await interaction.reply({ content: `[${scopeName}] **${valueToRemove}** is not in **${key}**`, ephemeral: true });
                    return;
                }
                
                list = list.filter(i => i !== valueToRemove);
                const newValue = list.join(",");
                
                try {
                    await updateSetting(world.mongodb, targetGuildId, key, newValue);
                    await interaction.reply({ content: `[${scopeName}] Successfully removed from **${key}**. New value: \`${newValue}\``, ephemeral: true });
                    log.info(`Setting ${key} item removed by ${interaction.user.tag} in scope ${scopeName}`, { key, value: newValue, guildId: targetGuildId });
                } catch (e) {
                    log.error(`Failed to remove item from setting ${key}`, e);
                    await interaction.reply({ content: `Failed to remove item from setting: ${e instanceof Error ? e.message : 'Unknown error'}`, ephemeral: true });
                }
            }
        }
        else if (group === "activity") {
            return handleActivityAdminSubcommand(interaction);
        }
        else if (group === "meetup") {
            return handleMeetupAdminSubcommand(interaction);
        }
        else if (group === "mod") {
            return handleModSubcommand(interaction, world);
        }
    },

    autocomplete: async (interaction, world) => {
        if (interaction.commandName !== "boredbot") return;

        const group = interaction.options.getSubcommandGroup();
        if (group === "activity") {
            return handleActivityAutocomplete(interaction);
        }
    }
};
