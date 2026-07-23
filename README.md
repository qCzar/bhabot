# @hellos3b/sjbha-bot

A Discord bot built with [discord.js v14](https://discord.js.org/) and TypeScript. All user-facing features are implemented as Discord slash commands. The bot connects to MongoDB for persistence and exposes a small HTTP API via [Hapi](https://hapi.dev/).

---

## Table of Contents

- [Requirements](#requirements)
- [Setup](#setup)
  - [1. Clone & Install](#1-clone--install)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Register the Bot with Discord](#3-register-the-bot-with-discord)
  - [4. Run the Bot](#4-run-the-bot)
- [Scripts](#scripts)
- [Slash Commands](#slash-commands)
  - [/activity](#activity)
  - [/aqi](#aqi)
  - [/boredbot](#boredbot)
  - [/changelog](#changelog)
  - [/christmas](#christmas)
  - [/define](#define)
  - [/meetup](#meetup)
  - [/mod](#mod)
  - [/pong](#pong)
  - [/throwdown](#throwdown)
  - [/tldr](#tldr)
  - [/version](#version)
- [Automatic Features](#automatic-features)
  - [Onboarding](#onboarding)
  - [Multipost Detection](#multipost-detection)

---

## Requirements

- **Node.js** >= 16
- **MongoDB** instance (local or remote)
- A **Discord application** with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- **pnpm** (recommended) or npm

---

## Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd rbhabot_expanded
pnpm install
```

### 2. Configure Environment Variables

Copy or create a `.env` file in the project root. All variables below are required unless a default is noted.

| Variable | Description | Default |
|---|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal | — |
| `DISCORD_CLIENT_ID` | Application (client) ID from the Developer Portal | — |
| `SERVER_ID` | Your Discord server (guild) ID | — |
| `MONGO_URL` | MongoDB connection string (e.g. `mongodb://localhost:27017/sjbha`) | — |
| `HTTP_PORT` | Port for the internal Hapi HTTP server | — |
| `HAPI_HOST` | Hostname for the Hapi server | — |
| `UI_HOSTNAME` | Public URL for any linked web UIs | — |
| `NODE_ENV` | `development` or `production` | `development` |
| `CHANNEL_ADMIN` | Channel ID for server admin commands | — |
| `CHANNEL_BOT_ADMIN` | Channel ID for bot admin commands | — |
| `CHANNEL_BOT_LOG` | Channel ID where bot logs/notes are broadcast | — |
| `CHANNEL_MEETUPS` | Channel ID where meetup announcements are posted | — |
| `CHANNEL_MEETUPS_DIR` | Channel ID for the meetups directory | — |
| `CHANNEL_SHITPOST` | Channel ID for the shitpost channel | — |
| `CHANNEL_THROWDOWN` | Channel ID where `/throwdown` can be used | — |
| `ONBOARDING_CHANNEL_ID` | Channel ID for new-member onboarding | — |
| `ONBOARDING_ROLE_ID` | Role ID granted after a user completes onboarding | — |
| `ONBOARDING_MIN_LENGTH` | Minimum intro message length required for onboarding | `50` |
| `REDDIT_SECRET` | Secret for the Reddit webhook integration | — |
| `PING_WHITELIST_CHANNELS` | Comma-separated channel IDs allowed to use `/activity ping everyone` | `""` |

> **Tip:** Many channel/role values can be overridden per-server at runtime via the `/boredbot settings` command without editing `.env`.

**Example `.env`:**

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=123456789012345678
SERVER_ID=987654321098765432
MONGO_URL=mongodb://localhost:27017/sjbha
HTTP_PORT=3000
HAPI_HOST=localhost
UI_HOSTNAME=https://your-ui-host.example.com
CHANNEL_ADMIN=111111111111111111
CHANNEL_BOT_ADMIN=222222222222222222
CHANNEL_BOT_LOG=333333333333333333
CHANNEL_MEETUPS=444444444444444444
CHANNEL_MEETUPS_DIR=555555555555555555
CHANNEL_SHITPOST=666666666666666666
CHANNEL_THROWDOWN=777777777777777777
ONBOARDING_CHANNEL_ID=888888888888888888
ONBOARDING_ROLE_ID=999999999999999999
REDDIT_SECRET=your_reddit_secret
```

### 3. Register the Bot with Discord

The bot automatically registers its slash commands with Discord on startup (via `Routes.applicationCommands`). No manual command registration is needed — just start the bot.

For the bot to appear in your server, make sure you have invited it with the correct OAuth2 scopes:
- `bot`
- `applications.commands`

Use the Discord Developer Portal → OAuth2 → URL Generator to generate an invite link with these scopes and the permissions your bot needs (at minimum: Send Messages, Read Message History, Manage Roles, Kick Members for mod features).

### 4. Run the Bot

**Development** (auto-restarts on file changes):
```bash
pnpm dev
```

**Production:**
```bash
pnpm start
```

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `NODE_ENV=production tsx src/Main.ts` | Run the bot in production mode |
| `dev` | `ts-node-dev ./src/main.ts` | Run with live reload for development |
| `test` | `jest` | Run the test suite |
| `test:watch` | `jest --watch` | Run tests in watch mode |

---

## Slash Commands

All commands are registered globally (available in any server the bot is in).

---

### /activity

Manage opt-in activity subscriptions backed by Discord roles. Members can self-assign roles to stay in the loop for specific activities.

| Subcommand | Options | Description |
|---|---|---|
| `list` | — | List all available activities |
| `join <name>` | `name` (autocomplete) | Join an activity and receive its role |
| `leave <name>` | `name` (autocomplete) | Leave an activity and remove its role |
| `ping <name> <message>` | `name` (autocomplete), `message` | Ping everyone in an activity with a message |
| `admin add <role>` | `role` | *(Bot admin channel only)* Register a Discord role as an activity |
| `admin remove <name>` | `name` (autocomplete) | *(Bot admin channel only)* Remove an activity |

> **Note:** `/activity ping everyone` and `/activity ping here` are only available in channels listed in `PING_WHITELIST_CHANNELS`. Admin subcommands are restricted to the channel set in `CHANNEL_BOT_ADMIN`.

---

### /aqi

Display the current Air Quality Index from Purple Air sensors across the South Bay.

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | — | Shows AQI readings for Downtown San Jose, East San Jose, South San Jose, Santa Clara, Mountain View, and San Mateo |

AQI levels are color-coded:
- 🟢 **Good** (< 50)
- 🟡 **Sketchy** (50–99)
- 🟠 **Bad** (100–149)
- 🔴 **Terrible** (150+)

---

### /boredbot

*(Requires Manage Server permission)*

Manage per-server and global bot settings at runtime — no restart required. Settings are persisted in MongoDB.

| Subcommand | Options | Description |
|---|---|---|
| `settings get <key>` | `key` (dropdown), `global` (bool) | Read the current value of a setting |
| `settings set <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Update a setting's value |
| `settings append <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Append a value to a comma-separated list setting |
| `settings remove_item <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Remove a value from a comma-separated list setting |

Pass `global: true` to update the setting across all servers (global scope); omit it or pass `false` to update it only for the current server.

**Configurable keys:** `CHANNEL_ADMIN`, `CHANNEL_BOT_ADMIN`, `CHANNEL_MEETUPS`, `CHANNEL_MEETUPS_DIR`, `CHANNEL_SHITPOST`, `CHANNEL_THROWDOWN`, `CHANNEL_BOT_LOG`, `ONBOARDING_CHANNEL_ID`, `ONBOARDING_ROLE_ID`, `ONBOARDING_MIN_LENGTH`, `SERVER_ID`, `UI_HOSTNAME`, `REDDIT_SECRET`, `PING_WHITELIST_CHANNELS`

---

### /changelog

Display the 5 most recent git commit messages as a changelog.

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | — | Posts an embed with the last 5 commit subjects |

> In production, the bot also sends the changelog to `CHANNEL_BOT_ADMIN` automatically on startup.

---

### /christmas

Find out how many days are left until Christmas 🎄.

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | — | Replies with the number of days until December 25th |

---

### /define

Look up a word on Urban Dictionary.

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | `word` (required) | Posts the top definition, with a **Remove** button available for 1 hour |

The person who ran the command can click **Remove** to delete the reply within 1 hour. After that window, the button disappears.

---

### /meetup

Create and manage community meetups. Meetups are created in the designated meetups channel and get their own discussion thread.

| Subcommand | Options | Description |
|---|---|---|
| `create <options>` | `options` (YAML string) | Create a new meetup from YAML (use in `CHANNEL_MEETUPS`) |
| `edit <options>` | `options` (YAML string) | Edit an existing meetup — must be used inside the meetup thread |
| `cancel <reason>` | `reason` | Cancel a meetup — must be used inside the meetup thread |
| `announce` | — | Ping all RSVPs in the meetup thread (organizer only) |
| `help` | — | Show the meetup command reference |
| `admin refresh` | — | *(Bot admin channel only)* Refresh all live meetup announcement embeds |

**Permissions:**
- `create` — any member (in the meetups channel)
- `edit` / `cancel` — organizer or a user with Kick Members permission
- `announce` — organizer only
- `admin refresh` — must be used in `CHANNEL_BOT_ADMIN`

**YAML options format** (passed to `create` / `edit`):
```yaml
title: "Hike at Alum Rock"
date: "2025-08-15T10:00:00"
description: "Casual morning hike."
category: outdoors
location:
  address: "Alum Rock Ave, San Jose, CA"
links:
  - label: "Trail Map"
    url: "https://example.com"
maxRsvp: 20
rsvpDeadline: "2025-08-14"
duration: 3
```

---

### /mod

*(Requires Kick Members permission)*

Moderator utilities for tracking user notes and managing multipost detection.

| Subcommand | Options | Description |
|---|---|---|
| `log <user> <note>` | `user` (mention), `note` | Save a moderation note for a user; broadcast to `CHANNEL_BOT_LOG` |
| `lookup <user>` | `user` (mention) | View all saved notes for a user |
| `echo <text>` | `text` | Make the bot say something in the current channel |
| `multipost-exempt-add <role>` | `role` | Add a role to the multipost detection exemption list |
| `multipost-exempt-remove <role>` | `role` | Remove a role from the multipost exemption list |
| `multipost-exempt-list` | — | List all roles currently exempt from multipost detection |

> **Note:** `log` and `lookup` replies are ephemeral unless used in `CHANNEL_ADMIN`.

---

### /pong

A simple health check command.

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | — | Replies with `Ping?` to confirm the bot is running |

---

### /throwdown

Rock Paper Scissors with a persistent win streak and leaderboard. Can only be used in the channel configured as `CHANNEL_THROWDOWN`.

| Subcommand | Options | Description |
|---|---|---|
| `play <hand>` | `hand` (Rock / Paper / Scissors) | Play a round against the bot |
| `profile` | — | View your current streak and personal best |
| `leaderboard` | — | View the all-time best streaks for everyone |

**How it works:**
- Winning increments your current streak
- Losing resets your streak and starts a **60-minute cooldown** before you can play again
- Ties don't affect your streak but are recorded in your history
- Setting a new server-wide high score pins the announcement message in the channel

---

### /tldr

Save and retrieve short community summaries.

| Subcommand | Options | Description |
|---|---|---|
| `save <note>` | `note` | Save a TLDR summary |
| `list` | — | Show the 10 most recent TLDRs |

> `list` replies are ephemeral unless used in `CHANNEL_SHITPOST`.

---

### /version

Display the currently running bot version (from `package.json`).

| Subcommand | Options | Description |
|---|---|---|
| *(none)* | — | Replies with the current package version |

---

## Automatic Features

These features run passively without a slash command.

### Onboarding

When a new member joins the server, the bot posts a welcome message in `ONBOARDING_CHANNEL_ID` prompting them to write an introduction of at least `ONBOARDING_MIN_LENGTH` characters.

Once the member posts (or edits) an introduction that meets the length requirement, the bot:
1. Grants the member the `ONBOARDING_ROLE_ID` role
2. Creates a welcome thread on their introduction message

### Multipost Detection

The bot watches all incoming messages and detects if users are posting the same content in multiple channels in a short window. Roles added via `/mod multipost-exempt-add` are excluded from this detection.