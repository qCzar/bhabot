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
- [Command Structure](#command-structure)
- [/bored — Public Commands](#bored--public-commands)
  - [/bored ban](#bored-ban)
  - [/bored changelog](#bored-changelog)
  - [/bored christmas](#bored-christmas)
  - [/bored define](#bored-define)
  - [/bored mention](#bored-mention)
  - [/bored play](#bored-play)
  - [/bored pong](#bored-pong)
  - [/bored version](#bored-version)
  - [/bored activity (group)](#bored-activity-group)
  - [/bored meetup (group)](#bored-meetup-group)
  - [/bored throwdown (group)](#bored-throwdown-group)
  - [/bored tldr (group)](#bored-tldr-group)
- [/boredbot — Admin Commands](#boredbot--admin-commands)
  - [/boredbot settings (group)](#boredbot-settings-group)
  - [/boredbot activity (group)](#boredbot-activity-group)
  - [/boredbot meetup (group)](#boredbot-meetup-group)
  - [/boredbot mod (group)](#boredbot-mod-group)
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
cd bhabot
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

#### Global System Variables (`.env` only)
These variables configure application-wide infrastructure and cannot be changed per-server at runtime:

| Variable | Description | Default |
|---|---|---|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal | — |
| `DISCORD_CLIENT_ID` | Application (client) ID from the Developer Portal | — |
| `SERVER_ID` | Main Discord server (guild) ID | — |
| `MONGO_URL` | MongoDB connection string (e.g. `mongodb://username:password@127.0.0.1:27017/sjbha?authSource=admin`) | — |
| `HTTP_PORT` | Port for the internal Hapi HTTP server | — |
| `HAPI_HOST` | Hostname for the Hapi server | — |
| `MEETUP_FORM_URL` | Public URL for the meetup creation/edit form | `https://qczar.github.io/bhabot/` |
| `MEETUP_API_URL` | Public URL for meetup data and calendar routes | `https://meetup.rochesterbored.com` |
| `NODE_ENV` | `development` or `production` | `development` |

#### Per-Server Configurable Settings (`.env` or `/boredbot settings`)
These variables can have initial defaults set in `.env` and can be overridden dynamically per-server using Discord slash commands:

| Variable | Description | Default |
|---|---|---|
| `CHANNEL_ADMIN` | Channel ID for server admin commands | — |
| `CHANNEL_BOT_ADMIN` | Channel ID for bot admin commands | — |
| `CHANNEL_BOT_LOG` | Channel ID where bot logs/notes are broadcast | — |
| `CHANNEL_MEETUPS` | Channel ID where meetup announcements are posted | — |
| `CHANNEL_MEETUPS_DIR` | Channel ID for the meetups directory | — |
| `CHANNEL_SHITPOST` | Channel ID for the shitpost channel | — |
| `CHANNEL_THROWDOWN` | Channel ID where throwdown can be used | — |
| `ONBOARDING_CHANNEL_ID` | Channel ID for new-member onboarding | — |
| `ONBOARDING_ROLE_ID` | Role ID granted after a user completes onboarding | — |
| `ONBOARDING_MIN_LENGTH` | Minimum intro message length required for onboarding | `50` |
| `REDDIT_SECRET` | Secret for the Reddit webhook integration | — |
| `MEETUP_RECURRENCE_WINDOW_DAYS` | Number of days ahead to post recurring meetup occurrences | `21` |
| `MEETUP_TIMEZONE` | IANA timezone used for recurring meetup schedules | `America/Chicago` |
| `PING_WHITELIST_CHANNELS` | Comma-separated channel IDs allowed to use `/bored play`; threads inherit approval from a whitelisted parent channel (including all posts in a forum). Forum tags provide the available platforms. | `""` |
| `COOLDOWN_USER_PING` | Per-user cooldown duration in seconds for mentioning roles | `60` |
| `COOLDOWN_ROLE_PING` | Per-role cooldown duration in seconds before a role can be mentioned again | `7200` |

> **Tip:** Per-server configurable settings can be updated dynamically per-server in Discord using `/boredbot settings set key:<KEY> value:<VALUE>` without restarting the bot.

**Example `.env`:**

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=123456789012345678
SERVER_ID=987654321098765432
MONGO_URL=mongodb://sjbha_user:secure_password@127.0.0.1:27017/sjbha?authSource=admin
HTTP_PORT=3000
HAPI_HOST=localhost
MEETUP_FORM_URL=https://qczar.github.io/bhabot/
MEETUP_API_URL=https://meetup.rochesterbored.com
MEETUP_RECURRENCE_WINDOW_DAYS=21
MEETUP_TIMEZONE=America/Chicago
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

---

### 3. Securing MongoDB (Critical)

> [!WARNING]
> Running MongoDB without authentication or exposed to `0.0.0.0` leaves your database vulnerable to automated internet ransomware bots that scan port 27017 and wipe unauthenticated databases.

Follow these steps to secure your local MongoDB instance or deployment:

#### Option A: Local MongoDB Service

1. **Restrict Network Binding (Localhost Only)**
   Edit your MongoDB configuration file (typically `/etc/mongod.conf` on Linux):
   ```yaml
   net:
     port: 27017
     bindIp: 127.0.0.1
   ```
   Restart MongoDB:
   ```bash
   sudo systemctl restart mongod
   ```

2. **Create Admin & Application User Credentials**
   Connect to MongoDB via shell (`mongosh`):
   ```js
   use admin
   db.createUser({
     user: "adminUser",
     pwd: "StrongAdminPasswordHere",
     roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
   })

   use sjbha
   db.createUser({
     user: "sjbha_user",
     pwd: "StrongAppPasswordHere",
     roles: [ { role: "readWrite", db: "sjbha" } ]
   })
   ```

3. **Enable Authorization**
   In `/etc/mongod.conf`, enable security authorization:
   ```yaml
   security:
     authorization: enabled
   ```
   Restart MongoDB again (`sudo systemctl restart mongod`).

4. **Firewall Rules**
   Ensure external access to port 27017 is blocked:
   ```bash
   sudo ufw deny 27017
   ```

5. **Update `.env` Connection String**
   Use the authenticated database URI:
   ```env
   MONGO_URL=mongodb://sjbha_user:StrongAppPasswordHere@127.0.0.1:27017/sjbha?authSource=admin
   ```

#### Option B: Docker Compose Deployment (Recommended for Easy Setup)

Use the included `docker-compose.yml` to automatically run MongoDB isolated on localhost with authentication enabled:

```bash
docker-compose up -d
```

The Docker Compose configuration automatically restricts MongoDB's port exposure to `127.0.0.1:27017:27017` and passes root credentials securely via environment variables.

---

### 4. Register the Bot with Discord

The bot automatically registers its slash commands with Discord on startup (via `Routes.applicationCommands`). No manual command registration is needed — just start the bot.

For the bot to appear in your server, make sure you have invited it with the correct OAuth2 scopes:
- `bot`
- `applications.commands`

Use the Discord Developer Portal → OAuth2 → URL Generator to generate an invite link with these scopes and the permissions your bot needs (at minimum: Send Messages, Read Message History, Manage Roles, Kick Members for mod features).

### 5. Run the Bot

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

## Command Structure

All functionality is consolidated into **two top-level slash commands**:

| Command | Audience | Permission Required |
|---|---|---|
| `/bored` | Everyone | None |
| `/boredbot` | Staff | Kick Members (all groups); Manage Server (settings & activity admin) |

Each command uses **subcommand groups** to organize related features. This keeps the command list clean and makes permission enforcement straightforward — all admin functionality lives under `/boredbot` and is hidden from regular members.

---

## /bored — Public Commands

General-purpose commands available to all server members.

---

### /bored ban `<user>`

Playfully "ban" a user from the server with a randomly selected funny reason.

| Option | Required | Description |
|---|---|---|
| `user` | ✅ | The user to playfully ban |

> **Note:** Watch out! There is a 1-in-6 chance that the command backfires and times out the command caller for 60 seconds with a self-ban reason.

---

### /bored changelog

Display the 5 most recent git commit messages as a changelog embed.

> In production the bot also posts the changelog to `CHANNEL_BOT_ADMIN` automatically on startup.

---

### /bored christmas

Replies with how many days are left until Christmas 🎄.

---

### /bored define `<word>`

Look up a word on Urban Dictionary. Posts the top definition as an embed. The person who ran the command can click the **Remove** button to delete the reply within 1 hour; after that window the button disappears.

| Option | Required | Description |
|---|---|---|
| `word` | ✅ | The word to look up |

---

### /bored mention `<role>` `<message>`

Ping a registered activity role with a message. This command cannot mention `everyone` or `here`.

| Option | Required | Description |
|---|---|---|
| `role` | ✅ | Activity role name (autocomplete) |
| `message` | ✅ | Message to send with the ping |

> **Note:** Non-admin users are subject to a per-user cooldown (`COOLDOWN_USER_PING`, default 60s) and a per-role cooldown (`COOLDOWN_ROLE_PING`, default 2 hours) before the same role can be pinged again. Users with Manage Server or Kick Members permissions bypass these cooldowns.

---

### /bored play `<platform>` `<message>`

Announce a game session in a channel listed in `PING_WHITELIST_CHANNELS`, or in a thread under a whitelisted forum. Platforms are drawn from the tags configured on whitelisted forum channels. The bot posts the announcement as `PLATFORM - Message - @everyone`.

| Option | Required | Description |
|---|---|---|
| `platform` | ✅ | Forum tag representing the platform (autocomplete) |
| `message` | ✅ | Announcement message |

---

### /bored pong

A simple health check — replies with `Ping?` to confirm the bot is alive.

---

### /bored version

Replies with the currently running bot version from `package.json`.

---

### /bored activity (group)

Opt-in role subscriptions. Members can self-assign Discord roles to stay in the loop for specific activities.

| Subcommand | Options | Description |
|---|---|---|
| `list` | — | Privately list activities, grouped by roles you have and roles available to join |
| `join <role>` | `role` (autocomplete) | Join an activity and receive its role |
| `leave <role>` | `role` (autocomplete) | Leave an activity and remove its role |

---

### /bored meetup (group)

Create and manage community meetups. Creation posts `DATE - TITLE` and the
selected activity-role mention in the meetups channel, then starts the meetup's
discussion thread from that post.

| Subcommand | Options | Description |
|---|---|---|
| `create [options]` | `options` (optional YAML string) | With no options, open the web creator; with options, create a meetup in `CHANNEL_MEETUPS` |
| `edit [options] [scope]` | `options` (optional YAML string), `scope` (`occurrence` or `future`) | Update one occurrence or it and future occurrences inside its thread |
| `cancel <reason> [scope]` | `reason`, `scope` (`occurrence` or `series`) | Cancel one occurrence or all future occurrences in its series |
| `announce` | — | Ping all RSVPs — must be used inside the thread (organizer only) |
| `help` | — | Show the meetup command reference |

**Permissions:**
- `create` — any member; submitting generated options is restricted to `CHANNEL_MEETUPS`
- `edit` / `cancel` — organizer or a user with Kick Members permission
- `announce` — organizer only

Run `/bored meetup create` without options to receive a private link to
`MEETUP_FORM_URL`. Fill out the web form, then paste its generated YAML into
the `options` field of the same command to create the meetup. The link includes
the Discord server ID so the form can populate that server's activity roles.

Run `/bored meetup edit` without options inside a meetup thread to receive a
private editor link containing that meetup's ID and the Discord server ID.
After editing the form, paste its generated YAML into the `options` field of
the same command in the thread.

The public `GET /activities?server=<guild-id>` endpoint returns registered
activity roles that exist in the requested server. The meetup form uses this
endpoint to populate its role selector.

**YAML options format** (passed to `create` / `edit`):
```yaml
title: "Hike at Alum Rock"
date: "2026-08-15T10:00:00.000-05:00"
description: "Casual morning hike."
category: outdoors
location: "Alum Rock Ave, San Jose, CA"
links:
  - label: "Trail Map"
    url: "https://example.com"
maxRsvp: 20
rsvpDeadline: "2026-08-14T10:00:00.000-05:00"
duration: 3
```

One-off meetup YAML remains unchanged. For a recurring meetup, the web form adds this optional block:

```yaml
recurrence:
  frequency: weekly
  interval: 1
  weekdays: [6]
  endDate: "2026-12-19"
```

Weekdays use ISO numbering (`1` Monday through `7` Sunday). The original `date` is the first occurrence and its weekday must be selected. The bot applies the server's `MEETUP_TIMEZONE` internally. Recurring occurrences are posted only within `MEETUP_RECURRENCE_WINDOW_DAYS`; the organizer is automatically marked as attending each occurrence.

---

### /bored throwdown (group)

Rock Paper Scissors with a persistent win streak and leaderboard. **Can only be used in `CHANNEL_THROWDOWN`.**

| Subcommand | Options | Description |
|---|---|---|
| `play <hand>` | `hand` (Rock / Paper / Scissors) | Play a round against the bot |
| `profile` | — | View your current streak and personal best |
| `leaderboard` | — | View the all-time best streaks for everyone |

**How it works:**
- Winning increments your current streak
- Losing resets your streak and starts a **60-minute cooldown** before you can play again
- Ties don't affect your streak but are recorded in your history
- Setting a new server-wide high score pins the announcement in the channel

---

### /bored tldr (group)

Save and retrieve short community summaries.

| Subcommand | Options | Description |
|---|---|---|
| `save <note>` | `note` | Save a TLDR summary |
| `list` | — | Show the 10 most recent TLDRs |

> `list` replies are ephemeral unless used in `CHANNEL_SHITPOST`.

---

## /boredbot — Admin Commands

Staff-only commands. The entire `/boredbot` command requires **Kick Members** permission by default. The `settings` and `activity` subcommand groups additionally require **Manage Server**.

---

### /boredbot settings (group)

Manage per-server and global bot settings at runtime — no restart required. 

#### How Settings Are Saved & Resolved
1. **Persistence (MongoDB)**: All settings configured via slash commands are persisted in the `settings` collection in MongoDB (with the schema `{ key, guildId, value }`). 
2. **Caching & Lifecycle**:
   - On startup, the bot loads all settings from MongoDB into an in-memory cache (`guildSettings`).
   - If a setting is missing from MongoDB on startup, the bot backfills the database with the value defined in the `.env` file (acting as the initial global default).
3. **Multi-Server Resolution Scope**:
   - **Global Scope (`global: true`)**: Updates the setting globally. This is stored in MongoDB with a `guildId: null` and overrides the base `.env` value.
   - **Server Scope (`global: false` or omitted)**: Scopes the setting specifically to the server (guild) where the command is executed.
   - When retrieving a setting via `getSetting(guildId, key)`:
     1. It first checks for a server-specific setting override (`guildSettings[guildId][key]`).
     2. If not defined, it falls back to the global environment value (`env[key]`).

| Subcommand | Options | Description |
|---|---|---|
| `get <key>` | `key` (dropdown), `global` (bool) | Read the current value of a setting |
| `set <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Update a setting's value |
| `append <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Append a value to a comma-separated list setting |
| `remove_item <key> <value>` | `key` (dropdown), `value`, `global` (bool) | Remove a value from a comma-separated list setting |

#### Examples: How to Set Variables via Slash Commands

To set or update any of these variables in Discord, an admin with **Manage Server** permissions runs the `/boredbot settings` commands:

1. **Set a server-specific channel or role ID:**
   ```
   /boredbot settings set key:CHANNEL_MEETUPS value:123456789012345678
   ```
   *(This configures `CHANNEL_MEETUPS` for the server where the command is typed.)*

2. **Set a setting globally across all servers (overriding global fallback):**
   ```
   /boredbot settings set key:ONBOARDING_MIN_LENGTH value:100 global:true
   ```

3. **Check the current setting for a server:**
   ```
   /boredbot settings get key:ONBOARDING_ROLE_ID
   ```

4. **Add a channel ID to a list setting (e.g. ping whitelist):**
   ```
   /boredbot settings append key:PING_WHITELIST_CHANNELS value:987654321098765432
   ```

5. **Remove a channel ID from a list setting:**
   ```
   /boredbot settings remove_item key:PING_WHITELIST_CHANNELS value:987654321098765432
   ```

**Configurable keys:** `CHANNEL_ADMIN`, `CHANNEL_BOT_ADMIN`, `CHANNEL_MEETUPS`, `CHANNEL_MEETUPS_DIR`, `CHANNEL_SHITPOST`, `CHANNEL_THROWDOWN`, `CHANNEL_BOT_LOG`, `ONBOARDING_CHANNEL_ID`, `ONBOARDING_ROLE_ID`, `ONBOARDING_MIN_LENGTH`, `REDDIT_SECRET`, `PING_WHITELIST_CHANNELS`, `COOLDOWN_USER_PING`, `COOLDOWN_ROLE_PING`

---

### /boredbot activity (group)

Manage which Discord roles are registered as activities. *(Requires Manage Server)*

| Subcommand | Options | Description |
|---|---|---|
| `add` | `role` (role) OR `roles` (string) | Add a single role (`role`) or bulk-add multiple mentioned roles (`roles`, e.g. `@Role1 @Role2`) |
| `remove` | `role` (autocomplete) OR `roles` (string) OR *(none)* | Remove a single activity (`role`), bulk-remove comma-separated activities (`roles`), or leave options blank to **prune** all orphaned activities whose roles no longer exist in the server |

---

### /boredbot meetup (group)

Admin meetup utilities.

| Subcommand | Options | Description |
|---|---|---|
| `refresh` | — | Refresh all live meetup announcement embeds — must be used in `CHANNEL_BOT_ADMIN` |

---

### /boredbot mod (group)

Moderator utilities for tracking user notes and managing multipost detection.

| Subcommand | Options | Description |
|---|---|---|
| `log <user> <note>` | `user` (mention), `note` | Save a mod note for a user; broadcast to `CHANNEL_BOT_LOG` |
| `lookup <user>` | `user` (mention) | View all saved notes for a user |
| `echo <text>` | `text` | Make the bot say something in the current channel |
| `multipost-exempt-add <role>` | `role` | Add a role to the multipost detection exemption list |
| `multipost-exempt-remove <role>` | `role` | Remove a role from the multipost exemption list |
| `multipost-exempt-list` | — | List all roles currently exempt from multipost detection |

> `log` and `lookup` replies are ephemeral unless used in `CHANNEL_ADMIN`.

---

## Automatic Features

These features run passively without a slash command.

### Onboarding

When a new member joins the server, the bot posts a welcome message in `ONBOARDING_CHANNEL_ID` prompting them to write an introduction of at least `ONBOARDING_MIN_LENGTH` characters.

Once the member posts (or edits) an introduction that meets the length requirement, the bot:
1. Grants the member the `ONBOARDING_ROLE_ID` role
2. Creates a welcome thread on their introduction message

### Multipost Detection

The bot watches all incoming messages and detects if users are posting the same content across multiple channels in a short window. Roles added via `/boredbot mod multipost-exempt-add` are excluded from this detection.
