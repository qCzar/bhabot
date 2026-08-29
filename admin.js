// RBHA / BoredBot Admin & Server Settings Page Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const serverIdInput = document.getElementById('serverId');
  const serverBadge = document.getElementById('serverBadge');
  const serverBadgeText = document.getElementById('serverBadgeText');
  const copyToast = document.getElementById('copyToast');
  const summaryOutput = document.getElementById('summaryOutput');
  const copyAllBtn = document.getElementById('copyAllBtn');
  const resetBtn = document.getElementById('resetBtn');

  // Hash Import / Export Elements
  const importHashInput = document.getElementById('importHashInput');
  const loadHashBtn = document.getElementById('loadHashBtn');
  const exportHashOutput = document.getElementById('exportHashOutput');
  const copyHashBtn = document.getElementById('copyHashBtn');
  const copyImportCmdBtn = document.getElementById('copyImportCmdBtn');

  // Definition of all 23 bot configuration settings
  const settingsDefinitions = [
    // Category 1: Mention Cooldowns & Pings
    {
      id: 'COOLDOWN_USER_PING',
      category: 'cooldowns',
      name: 'User Mention Cooldown',
      key: 'COOLDOWN_USER_PING',
      type: 'number',
      default: 60,
      min: 0,
      unit: 'seconds',
      description: 'Cooldown period (in seconds) required before a single user can send another role mention.'
    },
    {
      id: 'COOLDOWN_ROLE_PING',
      category: 'cooldowns',
      name: 'Role Mention Cooldown',
      key: 'COOLDOWN_ROLE_PING',
      type: 'number',
      default: 7200,
      min: 0,
      unit: 'seconds',
      description: 'Global cooldown period (in seconds) before a specific role can be pinged again by anyone.'
    },
    {
      id: 'ALLOW_EVERYONE_PING',
      category: 'cooldowns',
      name: 'Allow @everyone / @here Pings',
      key: 'ALLOW_EVERYONE_PING',
      type: 'boolean',
      default: false,
      description: 'Enable or disable permission for users to ping @everyone or @here in whitelisted channels.'
    },
    {
      id: 'PING_WHITELIST_CHANNELS',
      category: 'cooldowns',
      name: 'Ping Whitelist Channels',
      key: 'PING_WHITELIST_CHANNELS',
      type: 'text',
      default: '',
      placeholder: '#announcements, #events or 123456789012345678',
      description: 'Comma-separated list of channel names or Channel IDs where @everyone and @here pings are permitted.'
    },

    // Category 2: Meetup & Recurrence Defaults
    {
      id: 'MEETUP_TIMEZONE',
      category: 'meetup',
      name: 'Meetup Timezone',
      key: 'MEETUP_TIMEZONE',
      type: 'text',
      default: 'America/Chicago',
      placeholder: 'America/Chicago',
      description: 'IANA timezone for meetup scheduling and recurrence calculations.'
    },
    {
      id: 'MEETUP_RECURRENCE_WINDOW_DAYS',
      category: 'meetup',
      name: 'Recurrence Window (Days)',
      key: 'MEETUP_RECURRENCE_WINDOW_DAYS',
      type: 'number',
      default: 21,
      min: 1,
      max: 365,
      unit: 'days',
      description: 'How many days in advance recurring meetup occurrences are automatically generated.'
    },
    {
      id: 'MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS',
      category: 'meetup',
      name: 'Auto-Cancel Missing Organizer Window',
      key: 'MEETUP_AUTOCANCEL_NO_ORGANIZER_HOURS',
      type: 'number',
      default: 24,
      min: 0,
      unit: 'hours',
      description: 'Hours to wait before auto-cancelling a meetup if no organizer is RSVP\'d (0 to disable).'
    },
    {
      id: 'MEETUP_AUTOCANCEL_BEFORE_START_HOURS',
      category: 'meetup',
      name: 'Auto-Cancel Start Proximity Deadline',
      key: 'MEETUP_AUTOCANCEL_BEFORE_START_HOURS',
      type: 'number',
      default: 2,
      min: 0,
      unit: 'hours',
      description: 'Hours before event start time to auto-cancel if no organizer is RSVP\'d (0 to disable).'
    },

    // Category 3: Channels & Logs
    {
      id: 'CHANNEL_ADMIN',
      category: 'channels',
      name: 'Admin Channel',
      key: 'CHANNEL_ADMIN',
      type: 'text',
      default: '',
      placeholder: '#admin or 123456789012345678',
      description: 'Discord channel ID for main admin operations.'
    },
    {
      id: 'CHANNEL_BOT_ADMIN',
      category: 'channels',
      name: 'Bot Admin Channel',
      key: 'CHANNEL_BOT_ADMIN',
      type: 'text',
      default: '',
      placeholder: '#bot-admin or 123456789012345678',
      description: 'Discord channel ID for bot administration commands.'
    },
    {
      id: 'CHANNEL_MEETUPS',
      category: 'channels',
      name: 'Meetups Channel',
      key: 'CHANNEL_MEETUPS',
      type: 'text',
      default: '',
      placeholder: '#meetups or 123456789012345678',
      description: 'Main channel where public meetup cards and notification embeds are published.'
    },
    {
      id: 'CHANNEL_MEETUPS_DIR',
      category: 'channels',
      name: 'Meetups Directory Channel',
      key: 'CHANNEL_MEETUPS_DIR',
      type: 'text',
      default: '',
      placeholder: '#meetup-directory or 123456789012345678',
      description: 'Directory channel listing active events.'
    },
    {
      id: 'CHANNEL_MEMBER_REPORTS',
      category: 'channels',
      name: 'Member Reports Channel',
      key: 'CHANNEL_MEMBER_REPORTS',
      type: 'text',
      default: '',
      placeholder: '#member-reports or 123456789012345678',
      description: 'Channel ID where member reports and alerts are directed.'
    },
    {
      id: 'CHANNEL_SHITPOST',
      category: 'channels',
      name: 'Shitpost / Spam Channel',
      key: 'CHANNEL_SHITPOST',
      type: 'text',
      default: '',
      placeholder: '#shitpost or 123456789012345678',
      description: 'Channel ID dedicated to casual and bot fun commands.'
    },
    {
      id: 'CHANNEL_THROWDOWN',
      category: 'channels',
      name: 'Throwdown Channel',
      key: 'CHANNEL_THROWDOWN',
      type: 'text',
      default: '',
      placeholder: '#throwdown or 123456789012345678',
      description: 'Channel ID for throwdown minigame interactions.'
    },
    {
      id: 'CHANNEL_BOT_LOG',
      category: 'channels',
      name: 'Bot Audit Log Channel',
      key: 'CHANNEL_BOT_LOG',
      type: 'text',
      default: '',
      placeholder: '#bot-logs or 123456789012345678',
      description: 'Discord channel ID where bot audit events and logs are posted.'
    },

    // Category 4: Onboarding & Moderation Audit
    {
      id: 'ONBOARDING_CHANNEL_ID',
      category: 'onboarding',
      name: 'Onboarding Channel ID',
      key: 'ONBOARDING_CHANNEL_ID',
      type: 'text',
      default: '',
      placeholder: '#welcome or 123456789012345678',
      description: 'Channel ID where new members undergo onboarding verification.'
    },
    {
      id: 'ONBOARDING_ROLE_ID',
      category: 'onboarding',
      name: 'Onboarding Role ID',
      key: 'ONBOARDING_ROLE_ID',
      type: 'text',
      default: '',
      placeholder: '123456789012345678',
      description: 'Role ID assigned to members upon completing onboarding.'
    },
    {
      id: 'ONBOARDING_MIN_LENGTH',
      category: 'onboarding',
      name: 'Onboarding Min Message Length',
      key: 'ONBOARDING_MIN_LENGTH',
      type: 'number',
      default: 50,
      min: 1,
      unit: 'characters',
      description: 'Minimum character length required for onboarding intro posts.'
    },
    {
      id: 'LOG_MEMBER_BANS',
      category: 'onboarding',
      name: 'Log Member Bans',
      key: 'LOG_MEMBER_BANS',
      type: 'boolean',
      default: true,
      description: 'Automatically post an audit embed when a member is banned.'
    },
    {
      id: 'LOG_MEMBER_KICKS',
      category: 'onboarding',
      name: 'Log Member Kicks',
      key: 'LOG_MEMBER_KICKS',
      type: 'boolean',
      default: true,
      description: 'Automatically post an audit embed when a member is kicked.'
    },
    {
      id: 'LOG_MEMBER_MESSAGE_DELETES',
      category: 'onboarding',
      name: 'Log Message Deletions',
      key: 'LOG_MEMBER_MESSAGE_DELETES',
      type: 'boolean',
      default: true,
      description: 'Automatically post an audit embed when a message is deleted.'
    },
    {
      id: 'REDDIT_SECRET',
      category: 'onboarding',
      name: 'Reddit Secret Key',
      key: 'REDDIT_SECRET',
      type: 'text',
      default: '',
      placeholder: 'Secret token',
      description: 'Secret token used for Reddit integrations.'
    }
  ];

  // Current values state map
  const state = {};

  // Parse URL query parameters (e.g. ?server=123456789)
  function initServerParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const serverId = urlParams.get('server') || urlParams.get('guild') || urlParams.get('guild_id');
    if (serverId) {
      serverIdInput.value = serverId;
      serverBadgeText.textContent = `Server: ${serverId}`;
      serverBadge.style.display = 'inline-flex';
    }
  }

  // Initialize state defaults
  settingsDefinitions.forEach(setting => {
    state[setting.id] = setting.default;
  });

  // Evaluate status and dependencies for color-blind friendly badges and actionable error banners
  function evaluateSettingStatus(settingId, currentValues) {
    const val = currentValues[settingId];
    const strVal = typeof val === 'string' ? val.trim() : (val !== undefined && val !== null ? String(val).trim() : '');

    // Admin Channels
    if (settingId === 'CHANNEL_BOT_ADMIN') {
      const adminVal = (currentValues['CHANNEL_ADMIN'] || '').trim();
      if (strVal) {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Bot admin channel is explicitly configured.' };
      } else if (adminVal) {
        return { status: 'fallback', symbol: '🔁', label: 'Fallback Active', message: `Unset — automatically falling back to CHANNEL_ADMIN ("${adminVal}").` };
      } else {
        return { status: 'error', symbol: '❌', label: 'Missing Admin Channel', message: 'Neither CHANNEL_BOT_ADMIN nor CHANNEL_ADMIN is set. The bot cannot send alerts or execute admin commands.' };
      }
    }

    if (settingId === 'CHANNEL_ADMIN') {
      const botAdminVal = (currentValues['CHANNEL_BOT_ADMIN'] || '').trim();
      if (strVal) {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Admin channel is explicitly configured.' };
      } else if (botAdminVal) {
        return { status: 'fallback', symbol: '🔁', label: 'Fallback Active', message: `Unset — automatically falling back to CHANNEL_BOT_ADMIN ("${botAdminVal}").` };
      } else {
        return { status: 'error', symbol: '❌', label: 'Missing Admin Channel', message: 'Neither CHANNEL_ADMIN nor CHANNEL_BOT_ADMIN is set.' };
      }
    }

    // Onboarding
    if (settingId === 'ONBOARDING_CHANNEL_ID') {
      const roleVal = (currentValues['ONBOARDING_ROLE_ID'] || '').trim();
      if (strVal && !roleVal) {
        return { status: 'error', symbol: '❌', label: 'Broken Dependency', message: 'ONBOARDING_ROLE_ID must be set when ONBOARDING_CHANNEL_ID is configured, otherwise members cannot receive a role upon completing introduction.' };
      } else if (strVal && roleVal) {
        return { status: 'healthy', symbol: '✅', label: 'Linked & Healthy', message: 'Onboarding introductions are active and linked to role verification.' };
      } else if (!strVal && roleVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Channel Unset', message: 'ONBOARDING_ROLE_ID is set, but ONBOARDING_CHANNEL_ID is empty. Onboarding verification will not trigger.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Onboarding is not configured.' };
      }
    }

    if (settingId === 'ONBOARDING_ROLE_ID') {
      const chanVal = (currentValues['ONBOARDING_CHANNEL_ID'] || '').trim();
      if (chanVal && !strVal) {
        return { status: 'error', symbol: '❌', label: 'Missing Required Role', message: 'Required by ONBOARDING_CHANNEL_ID so new members receive access.' };
      } else if (!chanVal && strVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Unlinked Role', message: 'Role is set, but ONBOARDING_CHANNEL_ID is empty.' };
      } else if (chanVal && strVal) {
        return { status: 'healthy', symbol: '✅', label: 'Linked & Healthy', message: 'Role is linked to onboarding introductions.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Onboarding role is not configured.' };
      }
    }

    // Meetup & Directory
    if (settingId === 'CHANNEL_MEETUPS') {
      const dirVal = (currentValues['CHANNEL_MEETUPS_DIR'] || '').trim();
      if (strVal && !dirVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Missing Directory', message: 'CHANNEL_MEETUPS is set, but CHANNEL_MEETUPS_DIR is unset. Meetup directory synchronization is inactive.' };
      } else if (!strVal && dirVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Missing Meetups Channel', message: 'Directory is set, but CHANNEL_MEETUPS is unset (no channel to create/host meetups).' };
      } else if (strVal && dirVal) {
        return { status: 'healthy', symbol: '✅', label: 'Linked & Healthy', message: 'Both meetup creation and directory channels are configured.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Meetup channel is not configured.' };
      }
    }

    if (settingId === 'CHANNEL_MEETUPS_DIR') {
      const meetupVal = (currentValues['CHANNEL_MEETUPS'] || '').trim();
      if (strVal && !meetupVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Missing Meetups Channel', message: 'CHANNEL_MEETUPS_DIR is set, but CHANNEL_MEETUPS is unset.' };
      } else if (!strVal && meetupVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Directory Unset', message: 'Meetup channel is set, but directory channel is unset.' };
      } else if (strVal && meetupVal) {
        return { status: 'healthy', symbol: '✅', label: 'Linked & Healthy', message: 'Directory channel is linked.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Directory channel is not configured.' };
      }
    }

    if (settingId === 'MEETUP_TIMEZONE') {
      if (!strVal) {
        return { status: 'error', symbol: '❌', label: 'Missing Timezone', message: 'Timezone is required for meetup scheduling.' };
      }
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: strVal }).format();
        return { status: 'healthy', symbol: '✅', label: 'Valid Timezone', message: 'Valid IANA timezone.' };
      } catch (_) {
        return { status: 'error', symbol: '❌', label: 'Invalid Timezone', message: `"${strVal}" is not a recognized IANA timezone (e.g. America/Chicago, America/New_York).` };
      }
    }

    // Moderation & Reports
    if (settingId === 'CHANNEL_MEMBER_REPORTS') {
      const botLogVal = (currentValues['CHANNEL_BOT_LOG'] || '').trim();
      if (strVal) {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Forum channel configured for member case file dossiers.' };
      } else if (botLogVal) {
        return { status: 'fallback', symbol: '🔁', label: 'Fallback Active', message: `Unset — member reports and mod notes will route directly to CHANNEL_BOT_LOG ("${botLogVal}").` };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Member reports forum is not configured.' };
      }
    }

    if (settingId === 'CHANNEL_BOT_LOG') {
      if (strVal) {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Text channel configured for real-time mod log feed.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Optional / Unset', message: 'Bot log channel is not configured.' };
      }
    }

    // Reddit
    if (settingId === 'REDDIT_SECRET') {
      const shitpostVal = (currentValues['CHANNEL_SHITPOST'] || '').trim();
      if (strVal && !shitpostVal) {
        return { status: 'error', symbol: '❌', label: 'Missing Destination', message: 'REDDIT_SECRET is set, but CHANNEL_SHITPOST is missing. Webhooks will fail.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Reddit webhook secret is set.' };
      }
    }

    if (settingId === 'CHANNEL_SHITPOST') {
      const secretVal = (currentValues['REDDIT_SECRET'] || '').trim();
      if (strVal && !secretVal) {
        return { status: 'warning', symbol: '⚠️', label: 'Missing Secret', message: 'CHANNEL_SHITPOST is set, but REDDIT_SECRET is empty.' };
      } else {
        return { status: 'healthy', symbol: '✅', label: 'Configured', message: 'Shitpost channel is configured.' };
      }
    }

    return { status: 'healthy', symbol: '✅', label: 'Healthy', message: 'Setting is healthy.' };
  }

  function updateSingleSettingStatus(setting) {
    const item = document.getElementById(`item-${setting.id}`);
    if (!item) return;

    const header = item.querySelector('.setting-header');
    const badge = item.querySelector(`#status-badge-${setting.id}`);
    const banner = item.querySelector(`#status-desc-${setting.id}`);

    const status = evaluateSettingStatus(setting.id, state);

    // Update item and header classes
    ['status-healthy', 'status-fallback', 'status-warning', 'status-error'].forEach(cls => {
      item.classList.remove(cls);
      if (header) header.classList.remove(cls);
      if (badge) badge.classList.remove(cls);
      if (banner) banner.classList.remove(cls);
    });

    item.classList.add(`status-${status.status}`);
    if (header) header.classList.add(`status-${status.status}`);
    if (badge) {
      badge.classList.add(`status-${status.status}`);
      badge.innerHTML = `${status.symbol} ${escapeHtml(status.label)}`;
    }
    if (banner) {
      banner.classList.add(`status-${status.status}`);
      banner.innerHTML = `<span>${status.symbol}</span> <span>${escapeHtml(status.message)}</span>`;
    }
  }

  function updateAllSettingStatuses() {
    settingsDefinitions.forEach(setting => {
      updateSingleSettingStatus(setting);
    });
  }

  // Render setting fields into respective category containers
  function renderSettings() {
    settingsDefinitions.forEach(setting => {
      const container = document.getElementById(`category-${setting.category}`);
      if (!container) return;

      const item = document.createElement('div');
      item.className = 'setting-item';
      item.id = `item-${setting.id}`;

      // Control HTML based on type
      let controlHTML = '';
      if (setting.type === 'boolean') {
        controlHTML = `
          <label class="switch">
            <input type="checkbox" id="input-${setting.id}" ${state[setting.id] ? 'checked' : ''}>
            <span class="slider"></span>
          </label>
        `;
      } else if (setting.type === 'number') {
        const minVal = setting.min !== undefined ? setting.min : 0;
        const maxAttr = setting.max !== undefined ? `max="${setting.max}"` : '';
        controlHTML = `
          <input type="number" id="input-${setting.id}" value="${state[setting.id]}" min="${minVal}" ${maxAttr} step="1">
        `;
      } else {
        controlHTML = `
          <input type="text" id="input-${setting.id}" value="${escapeHtml(String(state[setting.id] || ''))}" placeholder="${escapeHtml(setting.placeholder || '')}">
        `;
      }

      item.innerHTML = `
        <div class="setting-header">
          <div class="setting-info">
            <div class="setting-title">
              ${escapeHtml(setting.name)}
              <span class="setting-key">${escapeHtml(setting.key)}</span>
              <span class="status-badge" id="status-badge-${setting.id}"></span>
            </div>
            <div class="setting-desc">${escapeHtml(setting.description)}</div>
          </div>
          <div class="setting-control">
            ${controlHTML}
          </div>
        </div>
        <div class="status-desc-banner" id="status-desc-${setting.id}"></div>
        <div class="inline-cmd-box">
          <div class="inline-cmd-text" id="cmd-text-${setting.id}">
            <!-- Rendered by JS -->
          </div>
          <button type="button" class="btn-inline-copy" id="copy-btn-${setting.id}" data-id="${setting.id}">
            <i class="material-icons">content_copy</i> Copy
          </button>
        </div>
      `;

      container.appendChild(item);

      // Attach event listener
      const inputEl = document.getElementById(`input-${setting.id}`);
      if (inputEl) {
        const evtType = setting.type === 'boolean' ? 'change' : 'input';
        inputEl.addEventListener(evtType, (e) => {
          if (setting.type === 'boolean') {
            state[setting.id] = e.target.checked;
          } else if (setting.type === 'number') {
            let val = parseFloat(e.target.value);
            if (isNaN(val)) {
              val = setting.default;
            } else if (setting.min !== undefined && val < setting.min) {
              val = setting.min;
              e.target.value = setting.min;
            } else if (setting.max !== undefined && val > setting.max) {
              val = setting.max;
              e.target.value = setting.max;
            }
            state[setting.id] = val;
          } else {
            state[setting.id] = e.target.value;
          }
          updateSingleSettingCommand(setting);
          updateAllSettingStatuses();
          updateSummaryOutput();
        });

        if (setting.type === 'number') {
          inputEl.addEventListener('change', (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || (setting.min !== undefined && val < setting.min)) {
              const clampedVal = isNaN(val) ? setting.default : setting.min;
              e.target.value = clampedVal;
              state[setting.id] = clampedVal;
              updateSingleSettingCommand(setting);
              updateAllSettingStatuses();
              updateSummaryOutput();
            }
          });
        }
      }

      // Inline Copy Button listener
      const copyBtn = item.querySelector(`#copy-btn-${setting.id}`);
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const cmd = generateSlashCommand(setting);
          copyTextToClipboard(cmd);
        });
      }

      // Initial command render and status
      updateSingleSettingCommand(setting);
      updateSingleSettingStatus(setting);
    });
  }

  // Format single slash command
  function generateSlashCommand(setting) {
    const val = state[setting.id];
    let valStr = val;
    if (setting.type === 'boolean') {
      valStr = val ? 'true' : 'false';
    } else if (setting.type === 'text') {
      valStr = `"${val || ''}"`;
    }
    return `/boredbot settings set key: ${setting.key} value: ${valStr}`;
  }

  // Update single setting inline code block
  function updateSingleSettingCommand(setting) {
    const textEl = document.getElementById(`cmd-text-${setting.id}`);
    if (!textEl) return;

    const val = state[setting.id];
    let valStr = val;
    if (setting.type === 'boolean') {
      valStr = val ? 'true' : 'false';
    } else if (setting.type === 'text') {
      valStr = `"${escapeHtml(String(val || ''))}"`;
    }

    textEl.innerHTML = `<span class="cmd-verb">/boredbot settings set</span> key: <span class="cmd-key">${escapeHtml(setting.key)}</span> value: <span class="cmd-val">${valStr}</span>`;
  }

  // Generate clean settings dictionary and export hash
  function generateExportHash() {
    const payload = {};
    settingsDefinitions.forEach(setting => {
      payload[setting.key] = state[setting.id];
    });
    try {
      return btoa(JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to encode settings to base64', e);
      return '';
    }
  }

  // Update Summary card and Export Hash Output
  function updateSummaryOutput() {
    // 1. Update individual commands text
    const commands = settingsDefinitions.map(setting => generateSlashCommand(setting));
    const fullText = `# Server Configuration Commands (${serverIdInput.value.trim() || 'Default Server'})\n` + commands.join('\n');
    summaryOutput.textContent = fullText;

    // 2. Update export hash box
    const hash = generateExportHash();
    if (exportHashOutput) {
      exportHashOutput.value = hash;
    }
  }

  // Apply imported data object or hash string
  function applyImportedData(input, showFeedback = true) {
    if (!input || typeof input !== 'string') return false;

    let raw = input.trim();
    if (!raw) return false;

    // If input contains a URL with hash, extract everything after the last #
    if (raw.includes('#')) {
      raw = raw.slice(raw.lastIndexOf('#') + 1).trim();
    }

    let parsed = null;

    // 1. Try Base64 decode
    try {
      const decodedJson = atob(raw);
      parsed = JSON.parse(decodedJson);
    } catch (_) {
      // 2. Try parsing raw input directly as JSON
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        if (showFeedback) {
          alert('Could not decode settings data. Please provide a valid Base64 hash, dashboard URL, or JSON string.');
        }
        return false;
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      if (showFeedback) alert('Invalid settings structure. Expected a key-value dictionary.');
      return false;
    }

    const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : parsed;
    let appliedCount = 0;

    settingsDefinitions.forEach(setting => {
      if (settings[setting.key] !== undefined) {
        let val = settings[setting.key];
        if (setting.type === 'boolean') {
          val = Boolean(val);
        } else if (setting.type === 'number') {
          val = Number(val);
          if (isNaN(val)) val = setting.default;
        } else {
          val = String(val ?? '');
        }
        state[setting.id] = val;

        const inputEl = document.getElementById(`input-${setting.id}`);
        if (inputEl) {
          if (setting.type === 'boolean') {
            inputEl.checked = val;
          } else {
            inputEl.value = val;
          }
        }
        updateSingleSettingCommand(setting);
        appliedCount++;
      }
    });

    updateAllSettingStatuses();
    updateSummaryOutput();

    if (showFeedback) {
      showToast(`Loaded ${appliedCount} setting(s) successfully!`);
    }
    return true;
  }

  // Read hash on load or on hashchange
  function loadFromHash() {
    if (window.location.hash && window.location.hash.length > 1) {
      const hashContent = window.location.hash.slice(1);
      if (importHashInput) {
        importHashInput.value = window.location.href;
      }
      applyImportedData(hashContent, false);
      showToast('Loaded settings from URL hash!');
    }
  }

  // Helper: Copy text to clipboard
  function copyTextToClipboard(text, customMessage) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(customMessage || 'Command copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  }

  // Helper: Show toast
  function showToast(message) {
    copyToast.innerHTML = `<i class="material-icons">check_circle</i> ${escapeHtml(message)}`;
    copyToast.classList.add('show');
    setTimeout(() => {
      copyToast.classList.remove('show');
    }, 2500);
  }

  // Helper: Escape HTML
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  // Server ID input listener
  serverIdInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val) {
      serverBadgeText.textContent = `Server: ${val}`;
      serverBadge.style.display = 'inline-flex';
    } else {
      serverBadge.style.display = 'none';
    }
    updateSummaryOutput();
  });

  // Load Hash Button
  if (loadHashBtn && importHashInput) {
    loadHashBtn.addEventListener('click', () => {
      applyImportedData(importHashInput.value, true);
    });

    importHashInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        applyImportedData(importHashInput.value, true);
      }
    });
  }

  // Copy Settings Hash Button
  if (copyHashBtn) {
    copyHashBtn.addEventListener('click', () => {
      const hash = generateExportHash();
      copyTextToClipboard(hash, 'Settings hash copied to clipboard!');
    });
  }

  // Copy Import Slash Command Button
  if (copyImportCmdBtn) {
    copyImportCmdBtn.addEventListener('click', () => {
      const hash = generateExportHash();
      const cmd = `/boredbot settings import data: ${hash}`;
      copyTextToClipboard(cmd, 'Import command copied to clipboard!');
    });
  }

  // Copy All Commands Button
  copyAllBtn.addEventListener('click', () => {
    copyTextToClipboard(summaryOutput.textContent, 'All commands copied to clipboard!');
  });

  // Reset Defaults Button
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings to their default values?')) {
      settingsDefinitions.forEach(setting => {
        state[setting.id] = setting.default;
        const inputEl = document.getElementById(`input-${setting.id}`);
        if (inputEl) {
          if (setting.type === 'boolean') {
            inputEl.checked = setting.default;
          } else {
            inputEl.value = setting.default;
          }
        }
        updateSingleSettingCommand(setting);
      });
      updateAllSettingStatuses();
      updateSummaryOutput();
      showToast('Settings reset to defaults');
    }
  });

  // Window hash change listener
  window.addEventListener('hashchange', loadFromHash);

  // Init execution
  initServerParam();
  renderSettings();
  updateSummaryOutput();
  loadFromHash();
});
