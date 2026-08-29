import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { interaction } from "../interaction";
import { env, dynamicKeys, updateSetting, DynamicKey, getSetting } from "../environment";
import { logger } from "../logger";
import { handleActivityAdminSubcommand, handleActivityAutocomplete } from "./activity";
import { handleModSubcommand } from "./mod";
import { handleMeetupAdminSubcommand } from "./meetup";
import { serializeSettings, deserializeSettings, adminDashboardUrl, applyImportedSettings } from "./settings-serializer";
import { validateGuildSettings, getSettingChangeWarnings } from "../features/settings-validator";

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
        .addSubcommand(subcommand => subcommand
            .setName("check")
            .setDescription("Audit all settings, dependencies, and Discord permissions")
            .addBooleanOption(addGlobalOption)
        )
        .addSubcommand(subcommand => subcommand
            .setName("export")
            .setDescription("Export all settings as an encoded hash and dashboard link")
            .addBooleanOption(addGlobalOption)
        )
        .addSubcommand(subcommand => subcommand
            .setName("import")
            .setDescription("Import settings from an exported hash, URL, or JSON")
            .addStringOption(option => option
                .setName("data")
                .setDescription("The exported settings hash, dashboard URL, or JSON")
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
                .setRequired(false)
            )
            .addStringOption(option => option
                .setName("roles")
                .setDescription("Multiple roles to add (mention them all)")
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("remove")
            .setDescription("Remove an activity (leave blank to prune deleted roles)")
            .addStringOption(option => option
                .setName("role")
                .setDescription("The name of the activity to remove")
                .setRequired(false)
                .setAutocomplete(true)
            )
            .addStringOption(option => option
                .setName("roles")
                .setDescription("Multiple activities to remove (comma-separated)")
                .setRequired(false)
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
            .addStringOption(option => option
                .setName("note")
                .setDescription("The note you want to save for this user")
                .setRequired(true)
            )
            .addUserOption(option => option
                .setName("user")
                .setDescription("The user this note is about (defaults to current thread's member)")
                .setRequired(false)
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
                .setDescription("The user to lookup (defaults to current thread's member)")
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand => subcommand
            .setName("audit-log")
            .setDescription("Fetch recent server audit log actions for a user")
            .addUserOption(option => option
                .setName("user")
                .setDescription("The user to check audit logs for (defaults to current thread's member)")
                .setRequired(false)
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

            if (subcommand === "check") {
                await interaction.deferReply({ ephemeral: true });
                const report = await validateGuildSettings(isGlobal ? null : interaction.guild, targetGuildId);

                const statusColor = report.summary.error > 0 ? 0xED4245 : (report.summary.warning > 0 ? 0xFEE75C : 0x57F287);
                const statusTitle = report.summary.error > 0
                    ? `❌ Settings Audit: Issues Detected [${scopeName}]`
                    : (report.summary.warning > 0 || report.summary.fallback > 0
                        ? `⚠️ Settings Audit: Configuration Notices [${scopeName}]`
                        : `✅ Settings Audit: All Clear [${scopeName}]`);

                const fields: Discord.APIEmbedField[] = [
                    {
                        name: "Audit Summary",
                        value: [
                            `✅ **Healthy:** ${report.summary.healthy}`,
                            `🔁 **Fallback Active:** ${report.summary.fallback}`,
                            `⚠️ **Warnings:** ${report.summary.warning}`,
                            `❌ **Errors / Broken:** ${report.summary.error}`
                        ].join("  •  ")
                    }
                ];

                const errors = report.items.filter(i => i.status === "error");
                const warnings = report.items.filter(i => i.status === "warning");
                const fallbacks = report.items.filter(i => i.status === "fallback");
                const healthy = report.items.filter(i => i.status === "healthy");

                if (errors.length > 0) {
                    fields.push({
                        name: `❌ Errors / Broken Dependencies (${errors.length})`,
                        value: errors.map(i => `• **${i.title}**: ${i.message}`).join("\n").slice(0, 1024)
                    });
                }

                if (warnings.length > 0) {
                    fields.push({
                        name: `⚠️ Incomplete / Warnings (${warnings.length})`,
                        value: warnings.map(i => `• **${i.title}**: ${i.message}`).join("\n").slice(0, 1024)
                    });
                }

                if (fallbacks.length > 0) {
                    fields.push({
                        name: `🔁 Fallback Routing Active (${fallbacks.length})`,
                        value: fallbacks.map(i => `• **${i.title}**: ${i.message}`).join("\n").slice(0, 1024)
                    });
                }

                if (healthy.length > 0 && errors.length === 0 && warnings.length === 0) {
                    fields.push({
                        name: `✅ Verified Healthy (${healthy.length})`,
                        value: healthy.map(i => `• **${i.title}**`).slice(0, 10).join("\n") + (healthy.length > 10 ? `\n*+${healthy.length - 10} more*` : "")
                    });
                }

                await interaction.editReply({
                    embeds: [{
                        title: statusTitle,
                        description: `Audit performed for **${scopeName}** at <t:${Math.floor(Date.now() / 1000)}:T>.`,
                        color: statusColor,
                        fields
                    }]
                });
                return;
            }

            if (subcommand === "export") {
                const hash = serializeSettings(targetGuildId);
                const formUrl = env.MEETUP_FORM_URL || "https://qczar.github.io/bhabot/";
                const adminUrl = adminDashboardUrl(formUrl, hash, targetGuildId);

                await interaction.reply({
                    embeds: [{
                        title: `⚙️ Exported Settings [${scopeName}]`,
                        description: [
                            `🔗 [**Open in Admin Dashboard**](${adminUrl})`,
                            ``,
                            `**Settings Hash:**`,
                            `\`\`\`text\n${hash}\n\`\`\``,
                            `*Copy the hash above to back up settings or import them using \`/boredbot settings import\`.*`
                        ].join("\n"),
                        color: 0x5865F2
                    }],
                    ephemeral: true
                });
                return;
            }
            else if (subcommand === "import") {
                const data = interaction.options.getString("data", true);
                let parsed: Record<string, any>;
                try {
                    parsed = deserializeSettings(data);
                } catch (e) {
                    await interaction.reply({
                        content: `⚠️ Failed to parse settings data: ${e instanceof Error ? e.message : 'Invalid format'}`,
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply({ ephemeral: true });

                const result = await applyImportedSettings(world.mongodb, targetGuildId, parsed);

                if (result.updated.length === 0 && result.failed.length === 0) {
                    await interaction.editReply({
                        content: `⚠️ No recognized settings found to import. Make sure the data contains valid setting keys.`
                    });
                    return;
                }

                const lines: string[] = [
                    `✅ [${scopeName}] Successfully imported **${result.updated.length}** setting(s).`
                ];

                if (result.updated.length > 0) {
                    lines.push(`\n**Updated:**\n` + result.updated.map(k => `• \`${k}\``).join("\n"));
                }

                if (result.failed.length > 0) {
                    lines.push(`\n⚠️ **Failed to update (${result.failed.length}):**\n` + result.failed.map(f => `• \`${f.key}\`: ${f.error}`).join("\n"));
                }

                if (result.ignored.length > 0) {
                    lines.push(`\nℹ️ *Ignored unknown keys: ${result.ignored.map(k => `\`${k}\``).join(", ")}*`);
                }

                // Check post-import dependency health
                const importReport = await validateGuildSettings(isGlobal ? null : interaction.guild, targetGuildId);
                const importWarnings = importReport.items.filter(i => i.status === "error" || i.status === "warning");
                if (importWarnings.length > 0) {
                    lines.push(`\n⚠️ **Configuration Alerts:**\n` + importWarnings.map(w => `${w.symbol} **${w.title}**: ${w.message}`).join("\n"));
                }

                log.info(`Imported ${result.updated.length} settings in scope ${scopeName} by ${interaction.user.tag}`, {
                    guildId: targetGuildId,
                    updatedCount: result.updated.length,
                    failedCount: result.failed.length
                });

                await interaction.editReply({ content: lines.join("\n") });
                return;
            }

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
                    const warnings = getSettingChangeWarnings(targetGuildId, key, value);
                    let replyContent = `[${scopeName}] Successfully updated **${key}** to \`${value}\``;
                    if (warnings.length > 0) {
                        replyContent += "\n\n" + warnings.join("\n");
                    }
                    await interaction.reply({ content: replyContent, ephemeral: true });
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
                    const warnings = getSettingChangeWarnings(targetGuildId, key, newValue);
                    let replyContent = `[${scopeName}] Successfully appended to **${key}**. New value: \`${newValue}\``;
                    if (warnings.length > 0) {
                        replyContent += "\n\n" + warnings.join("\n");
                    }
                    await interaction.reply({ content: replyContent, ephemeral: true });
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
                    const warnings = getSettingChangeWarnings(targetGuildId, key, newValue);
                    let replyContent = `[${scopeName}] Successfully removed from **${key}**. New value: \`${newValue}\``;
                    if (warnings.length > 0) {
                        replyContent += "\n\n" + warnings.join("\n");
                    }
                    await interaction.reply({ content: replyContent, ephemeral: true });
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
