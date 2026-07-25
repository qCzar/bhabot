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

  // Definition of per-server configuration settings
  const settingsDefinitions = [
    // Category 1: Mention Cooldowns & Pings
    {
      id: 'user_mention_cooldown',
      category: 'cooldowns',
      name: 'User Mention Cooldown',
      key: 'user_mention_cooldown',
      type: 'number',
      default: 300,
      min: 0,
      unit: 'seconds',
      description: 'Cooldown period (in seconds) required before a single user can send another role mention.'
    },
    {
      id: 'role_mention_cooldown',
      category: 'cooldowns',
      name: 'Role Mention Cooldown',
      key: 'role_mention_cooldown',
      type: 'number',
      default: 600,
      min: 0,
      unit: 'seconds',
      description: 'Global cooldown period (in seconds) before a specific role can be pinged again by anyone.'
    },
    {
      id: 'max_pings_per_meetup',
      category: 'cooldowns',
      name: 'Max Pings Per Meetup',
      key: 'max_pings_per_meetup',
      type: 'number',
      default: 1,
      min: 0,
      unit: 'pings',
      description: 'Maximum number of role pings allowed when scheduling or updating a single meetup event.'
    },
    {
      id: 'allow_everyone_ping',
      category: 'cooldowns',
      name: 'Allow @everyone / @here Pings',
      key: 'allow_everyone_ping',
      type: 'boolean',
      default: false,
      description: 'Enable or disable permission for users to ping @everyone or @here in whitelisted channels.'
    },
    {
      id: 'ping_whitelist_channels',
      category: 'cooldowns',
      name: 'Ping Whitelist Channels',
      key: 'ping_whitelist_channels',
      type: 'text',
      default: '#announcements, #events',
      placeholder: '#announcements, #events or 123456789012345678',
      description: 'Comma-separated list of channel names or Channel IDs where @everyone and @here pings are permitted.'
    },

    // Category 2: Meetup & RSVP Defaults
    {
      id: 'default_duration',
      category: 'meetup',
      name: 'Default Meetup Duration',
      key: 'default_duration',
      type: 'number',
      default: 120,
      min: 15,
      unit: 'minutes',
      description: 'Default scheduled event length in minutes if unspecified by creator.'
    },
    {
      id: 'max_rsvp_limit',
      category: 'meetup',
      name: 'Default Max Capacity',
      key: 'max_rsvp_limit',
      type: 'number',
      default: 200,
      min: 1,
      unit: 'attendees',
      description: 'Default maximum RSVP attendee limit per meetup.'
    },
    {
      id: 'rsvp_cutoff_hours',
      category: 'meetup',
      name: 'RSVP Cutoff Deadline Buffer',
      key: 'rsvp_cutoff_hours',
      type: 'number',
      default: 0,
      min: 0,
      unit: 'hours',
      description: 'Hours prior to event start time when RSVPs automatically close (0 allows RSVPs up until or after event starts).'
    },
    {
      id: 'require_approval',
      category: 'meetup',
      name: 'Require Moderator Approval',
      key: 'require_approval',
      type: 'boolean',
      default: false,
      description: 'When enabled, member-created meetups require moderator sign-off before being published.'
    },
    {
      id: 'auto_archive_hours',
      category: 'meetup',
      name: 'Auto-Archive Delay',
      key: 'auto_archive_hours',
      type: 'number',
      default: 24,
      min: 1,
      unit: 'hours',
      description: 'Hours after event conclusion before the event discussion channel or thread auto-archives.'
    },

    // Category 3: Channels & Logs
    {
      id: 'admin_log_channel',
      category: 'channels',
      name: 'Admin Log Channel',
      key: 'admin_log_channel',
      type: 'text',
      default: '#admin-logs',
      placeholder: '#admin-logs or 123456789012345678',
      description: 'Discord channel name or Channel ID where admin bot audit events and alerts are posted.'
    },
    {
      id: 'announcement_channel',
      category: 'channels',
      name: 'Meetups Announcement Channel',
      key: 'announcement_channel',
      type: 'text',
      default: '#meetups',
      placeholder: '#meetups or 123456789012345678',
      description: 'Main channel where public meetup cards and notification embeds are published.'
    },

    // Category 4: Permissions & Moderation
    {
      id: 'admin_roles',
      category: 'permissions',
      name: 'Admin Roles',
      key: 'admin_roles',
      type: 'text',
      default: 'Admin, Server Lead',
      placeholder: 'Admin, Manager, 9876543210',
      description: 'Comma-separated role names or Role IDs with full permissions to edit bot settings.'
    },
    {
      id: 'mod_roles',
      category: 'permissions',
      name: 'Moderator Roles',
      key: 'mod_roles',
      type: 'text',
      default: 'Moderator, Event Host',
      placeholder: 'Moderator, Staff',
      description: 'Comma-separated role names or Role IDs allowed to manage RSVPs and approve events.'
    },
    {
      id: 'allow_member_meetups',
      category: 'permissions',
      name: 'Allow Member-Created Meetups',
      key: 'allow_member_meetups',
      type: 'boolean',
      default: true,
      description: 'Allow standard server members to create and host community meetups.'
    },

    // Category 5: Onboarding & Anti-Spam
    {
      id: 'enable_onboarding_welcome',
      category: 'onboarding',
      name: 'Enable Onboarding Welcome',
      key: 'enable_onboarding_welcome',
      type: 'boolean',
      default: true,
      description: 'Automatically send welcome messages and orientation guides when new members join the server.'
    },
    {
      id: 'enable_multipost_detection',
      category: 'onboarding',
      name: 'Enable Multi-Post Detection',
      key: 'enable_multipost_detection',
      type: 'boolean',
      default: true,
      description: 'Detect and flag duplicate or similar messages sent across multiple channels by the same user.'
    },
    {
      id: 'multipost_timeframe',
      category: 'onboarding',
      name: 'Multi-Post Detection Timeframe',
      key: 'multipost_timeframe',
      type: 'number',
      default: 60,
      min: 5,
      unit: 'seconds',
      description: 'Time window (in seconds) within which multi-post detection tracks member messages.'
    },
    {
      id: 'multipost_message_limit',
      category: 'onboarding',
      name: 'Multi-Post Message Limit',
      key: 'multipost_message_limit',
      type: 'number',
      default: 2,
      min: 2,
      unit: 'messages',
      description: 'Maximum permitted duplicate or similar posts across channels within timeframe before triggering moderation (minimum 2 required).'
    },
    {
      id: 'delete_triggering_message',
      category: 'onboarding',
      name: 'Delete Triggering Multi-Post Message',
      key: 'delete_triggering_message',
      type: 'boolean',
      default: false,
      description: 'Automatically delete the message that triggers a multi-post timeout so only (limit - 1) spam messages remain visible.'
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
        controlHTML = `
          <input type="number" id="input-${setting.id}" value="${state[setting.id]}" min="${minVal}" step="1">
        `;
      } else {
        controlHTML = `
          <input type="text" id="input-${setting.id}" value="${escapeHtml(state[setting.id])}" placeholder="${escapeHtml(setting.placeholder || '')}">
        `;
      }

      item.innerHTML = `
        <div class="setting-header">
          <div class="setting-info">
            <div class="setting-title">
              ${escapeHtml(setting.name)}
              <span class="setting-key">${escapeHtml(setting.key)}</span>
            </div>
            <div class="setting-desc">${escapeHtml(setting.description)}</div>
          </div>
          <div class="setting-control">
            ${controlHTML}
          </div>
        </div>
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
            }
            state[setting.id] = val;
          } else {
            state[setting.id] = e.target.value;
          }
          updateSingleSettingCommand(setting);
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

      // Initial command render
      updateSingleSettingCommand(setting);
    });
  }

  // Format single slash command
  function generateSlashCommand(setting) {
    const val = state[setting.id];
    let valStr = val;
    if (setting.type === 'boolean') {
      valStr = val ? 'true' : 'false';
    } else if (setting.type === 'text') {
      valStr = `"${val}"`;
    }
    return `/boredbot config set ${setting.key}: ${valStr}`;
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
      valStr = `"${escapeHtml(val)}"`;
    }

    textEl.innerHTML = `<span class="cmd-verb">/boredbot config set</span> <span class="cmd-key">${escapeHtml(setting.key)}:</span> <span class="cmd-val">${valStr}</span>`;
  }

  // Update Summary card showing all commands
  function updateSummaryOutput() {
    const commands = settingsDefinitions.map(setting => generateSlashCommand(setting));
    const fullText = `# Server Configuration Commands (${serverIdInput.value.trim() || 'Default Server'})\n` + commands.join('\n');
    summaryOutput.textContent = fullText;
  }

  // Helper: Copy text to clipboard
  function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      copyToast.classList.add('show');
      setTimeout(() => {
        copyToast.classList.remove('show');
      }, 2500);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
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

  // Copy All Commands Button
  copyAllBtn.addEventListener('click', () => {
    copyTextToClipboard(summaryOutput.textContent);
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
      updateSummaryOutput();
    }
  });

  // Init execution
  initServerParam();
  renderSettings();
  updateSummaryOutput();
});
