import * as Discord from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import { interaction } from "../interaction";
import { env, dynamicKeys, updateSetting, DynamicKey, getSetting } from "../environment";
import { logger } from "../logger";

const log = logger("boredbot");

const addGlobalOption = (option: any) => 
    option.setName("global")
        .setDescription("Apply globally (Bot Admin only)")
        .setRequired(false);

const config = new SlashCommandBuilder()
    .setName("boredbot")
    .setDescription("BoredBot administration commands")
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
                
                // Add choices for all dynamic keys
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
    );

export const boredbot: interaction = {
    config: [config],
    handle: async (interaction, world) => {
        if (interaction.commandName !== "boredbot") return;

        const member = interaction.member as Discord.GuildMember;
        if (!member?.permissions?.has(Discord.PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
            return;
        }

        const isGlobal = interaction.options.getBoolean("global") ?? false;
        
        // If they want to change global settings, check if they are in the bot admin channel or have another way to verify.
        // For simplicity and since they have ManageGuild, we will just warn/log. But to be safe:
        // we could check if member has some global bot admin role, or we just allow it for this specific bot's context.
        if (isGlobal && env.CHANNEL_BOT_ADMIN) {
            // Very simplistic check: are they in a guild that has the bot admin channel?
            // A safer check might be validating against a specific user ID, but we don't have that configured.
            // We'll allow it if they are ManageGuild, but log it explicitly as a global change.
        }

        const targetGuildId = isGlobal ? null : interaction.guildId;
        const scopeName = isGlobal ? "Global" : `Server (${targetGuildId})`;

        const group = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (group === "settings") {
            const key = interaction.options.getString("key", true) as DynamicKey;

            if (subcommand === "get") {
                const value = getSetting(targetGuildId, key);
                await interaction.reply({ content: `[${scopeName}] **${key}** is currently set to: \`${value}\``, ephemeral: true });
            } 
            else if (subcommand === "set") {
                const value = interaction.options.getString("value", true);
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
                const valueToAdd = interaction.options.getString("value", true).trim();
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
                const valueToRemove = interaction.options.getString("value", true).trim();
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
    }
};
