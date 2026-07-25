// Meetup Creator Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const meetupForm = document.getElementById('meetupForm');
  const titleInput = document.getElementById('title');
  const dateInput = document.getElementById('date');
  const durationInput = document.getElementById('duration');
  const categoryChipsContainer = document.getElementById('categoryChips');
  const presetButtons = document.querySelectorAll('.preset-btn');
  const descriptionInput = document.getElementById('description');
  const descCharCount = document.getElementById('descCharCount');
  
  const maxRsvpInput = document.getElementById('maxRsvp');
  const rsvpDeadlineInput = document.getElementById('rsvpDeadline');
  
  // Subscription / Role Elements
  const roleSelect = document.getElementById('roleSelect');
  const roleLoadingStatus = document.getElementById('roleLoadingStatus');
  const serverBadge = document.getElementById('serverBadge');
  const serverBadgeText = document.getElementById('serverBadgeText');
  
  const locationInput = document.getElementById('location');
  const locationCommentsInput = document.getElementById('locationComments');
  const locCommentsCharCount = document.getElementById('locCommentsCharCount');
  const locationLinkedInput = document.getElementById('locationLinked');
  
  const linksListContainer = document.getElementById('linksList');
  const addLinkBtn = document.getElementById('addLinkBtn');
  
  const generateBtn = document.getElementById('generateBtn');
  const outputModal = document.getElementById('outputModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const commandPreview = document.getElementById('commandPreview');
  const copyBtn = document.getElementById('copyBtn');
  const copyToast = document.getElementById('copyToast');
  const modeBadge = document.getElementById('modeBadge');
  const mainHeaderTitle = document.getElementById('mainHeaderTitle');

  // Categories config
  const categories = [
    { label: 'default', emoji: '🗓️' },
    { label: 'food', emoji: '🍔' },
    { label: 'drinks', emoji: '🍺' },
    { label: 'fitness', emoji: '💪' },
    { label: 'voice', emoji: '🔊' },
    { label: 'gaming', emoji: '🎮' },
    { label: 'outdoors', emoji: '🌲' },
    { label: 'concert', emoji: '🎵' },
    { label: 'holiday', emoji: '🎉' },
    { label: 'volunteer', emoji: '🎗️' },
    { label: 'pet', emoji: '🐕' }
  ];

  let selectedCategory = 'default';
  let links = [];
  let isEditMode = false;
  let meetupId = null;
  let serverActivities = [];

  // Fetch registered server activity roles from Database based on Server ID parameter
  function initServerRoleSelection() {
    const urlParams = new URLSearchParams(window.location.search);
    const serverId = urlParams.get('server') || urlParams.get('guild') || urlParams.get('guild_id');
    const rolesParam = urlParams.get('roles');

    if (serverId) {
      serverBadgeText.textContent = `Server: ${serverId}`;
      serverBadge.style.display = 'inline-flex';
    }

    roleSelect.innerHTML = '<option value="">-- No Role Mention --</option>';

    // Parse inline query parameters if present (e.g. ?roles=BoardGames:102030,Fitness:405060 or ?roles=BoardGames,Fitness)
    if (rolesParam) {
      const parsedRoles = rolesParam.split(/[,|]/).map(item => {
        const parts = item.split(':');
        return {
          name: parts[0].trim(),
          id: parts[1] ? parts[1].trim() : parts[0].trim()
        };
      }).filter(r => r.name.length > 0);

      if (parsedRoles.length > 0) {
        populateRoleDropdown(parsedRoles);
        roleLoadingStatus.textContent = 'Roles loaded from URL parameters';
        return;
      }
    }

    if (!serverId) {
      roleLoadingStatus.textContent = 'Pass ?server=<guild_id> in the URL to automatically load your server\'s activity roles.';
      return;
    }

    // Query Database API endpoint for registered activity roles for this server
    roleLoadingStatus.textContent = `Loading registered activity roles for server ${serverId}...`;

    fetch(`https://comicidiot.com/api/activities?server=${encodeURIComponent(serverId)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          serverActivities = data;
          populateRoleDropdown(serverActivities);
          roleLoadingStatus.textContent = `${data.length} registered activity role(s) loaded.`;
        } else {
          roleLoadingStatus.textContent = 'No registered activity roles found for this server. Add roles using "/boredbot activity add"';
        }
      })
      .catch(err => {
        console.warn('Could not fetch activity roles from database API:', err);
        // Secondary fallback check if API route is at /activities
        fetch(`https://comicidiot.com/activities?server=${encodeURIComponent(serverId)}`)
          .then(r => r.json())
          .then(data => {
            if (Array.isArray(data) && data.length > 0) {
              serverActivities = data;
              populateRoleDropdown(serverActivities);
              roleLoadingStatus.textContent = `${data.length} registered activity role(s) loaded.`;
            } else {
              roleLoadingStatus.textContent = 'No registered activity roles found for this server.';
            }
          })
          .catch(() => {
            roleLoadingStatus.textContent = 'Could not connect to database API to load server activity roles.';
          });
      });
  }

  function populateRoleDropdown(roleList) {
    roleSelect.innerHTML = '<option value="">-- No Role Mention --</option>';
    roleList.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role.name;
      opt.setAttribute('data-id', role.id || role.name);
      opt.textContent = `@${role.name}${role.id && role.id !== role.name ? ` (${role.id})` : ''}`;
      roleSelect.appendChild(opt);
    });
  }

  // Initialize Category Chips
  function renderCategoryChips() {
    categoryChipsContainer.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = `chip ${selectedCategory === cat.label ? 'selected' : ''}`;
      chip.innerHTML = `<span>${cat.emoji}</span><span>${cat.label}</span>`;
      chip.addEventListener('click', () => {
        selectedCategory = cat.label;
        renderCategoryChips();
      });
      categoryChipsContainer.appendChild(chip);
    });
  }

  // Preset Duration Handler
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      const mins = btn.getAttribute('data-mins');
      durationInput.value = mins;
      btn.classList.add('active');
    });
  });

  durationInput.addEventListener('input', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    const val = durationInput.value;
    presetButtons.forEach(b => {
      if (b.getAttribute('data-mins') === val) {
        b.classList.add('active');
      }
    });
  });

  // Default Date Time (Now + 2 hours rounded to next hour)
  function getDefaultDateTime() {
    const now = new Date();
    now.setHours(now.getHours() + 2, 0, 0, 0);
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  dateInput.value = getDefaultDateTime();

  // Character Counters
  descriptionInput.addEventListener('input', () => {
    const len = descriptionInput.value.length;
    descCharCount.textContent = `${len} / 1000 characters`;
    if (len > 1000) {
      descCharCount.className = 'char-counter exceeded';
    } else if (len > 900) {
      descCharCount.className = 'char-counter warning';
    } else {
      descCharCount.className = 'char-counter';
    }
  });

  locationCommentsInput.addEventListener('input', () => {
    const len = locationCommentsInput.value.length;
    locCommentsCharCount.textContent = `${len} / 300 characters`;
    if (len > 300) {
      locCommentsCharCount.className = 'char-counter exceeded';
    } else if (len > 250) {
      locCommentsCharCount.className = 'char-counter warning';
    } else {
      locCommentsCharCount.className = 'char-counter';
    }
  });

  // Dynamic Link Rows
  function renderLinks() {
    linksListContainer.innerHTML = '';
    links.forEach((link, idx) => {
      const row = document.createElement('div');
      row.className = 'link-item';
      row.innerHTML = `
        <input type="text" placeholder="https://example.com" value="${escapeHtml(link.url)}" data-field="url" data-idx="${idx}" />
        <input type="text" placeholder="Link Title (e.g. Menu)" value="${escapeHtml(link.label || '')}" data-field="label" data-idx="${idx}" />
        <button type="button" class="btn-icon" data-remove="${idx}" title="Remove link">
          <i class="material-icons">close</i>
        </button>
      `;
      linksListContainer.appendChild(row);
    });

    linksListContainer.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.getAttribute('data-idx'));
        const field = e.target.getAttribute('data-field');
        links[idx][field] = e.target.value;
      });
    });

    linksListContainer.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-remove'));
        links.splice(idx, 1);
        renderLinks();
      });
    });
  }

  addLinkBtn.addEventListener('click', () => {
    links.push({ label: '', url: '' });
    renderLinks();
  });

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Load Edit Data from Hash if present
  function checkHashEditMode() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return;

    meetupId = hash;
    isEditMode = true;
    modeBadge.textContent = `Mode: Editing Meetup #${meetupId}`;
    mainHeaderTitle.textContent = 'Edit Meetup';

    fetch(`https://comicidiot.com/meetup/${meetupId}`)
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        if (data.title) titleInput.value = data.title;
        if (data.description) {
          descriptionInput.value = data.description;
          descriptionInput.dispatchEvent(new Event('input'));
        }
        if (data.timestamp) {
          const dt = new Date(data.timestamp);
          const tzOffset = dt.getTimezoneOffset() * 60000;
          dateInput.value = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
        }
        if (data.category) {
          selectedCategory = data.category;
          renderCategoryChips();
        }
        if (data.duration) {
          durationInput.value = data.duration;
          durationInput.dispatchEvent(new Event('input'));
        }
        if (data.maxRsvp) maxRsvpInput.value = data.maxRsvp;
        if (data.rsvpDeadline) {
          const dt = new Date(data.rsvpDeadline);
          const tzOffset = dt.getTimezoneOffset() * 60000;
          rsvpDeadlineInput.value = (new Date(dt.getTime() - tzOffset)).toISOString().slice(0, 16);
        }
        
        if (data.subscription) {
          // If subscription role is not currently in dropdown, add it
          let matched = false;
          for (let opt of roleSelect.options) {
            if (opt.value === data.subscription) {
              roleSelect.value = data.subscription;
              matched = true;
              break;
            }
          }
          if (!matched) {
            const opt = document.createElement('option');
            opt.value = data.subscription;
            opt.textContent = `@${data.subscription}`;
            roleSelect.appendChild(opt);
            roleSelect.value = data.subscription;
          }
        }

        if (data.location) {
          if (typeof data.location === 'object') {
            locationInput.value = data.location.value || '';
            locationCommentsInput.value = data.location.comments || '';
            locationLinkedInput.checked = data.location.autoLink !== false;
          } else {
            locationInput.value = data.location;
          }
          locationCommentsInput.dispatchEvent(new Event('input'));
        }

        if (data.links && Array.isArray(data.links)) {
          links = data.links.map(l => ({ label: l.label || '', url: l.url || '' }));
          renderLinks();
        }
      })
      .catch(err => {
        console.warn('Could not load meetup details for editing:', err);
      });
  }

  function toISOStringWithTZ(dateTimeLocalVal) {
    if (!dateTimeLocalVal) return null;
    const d = new Date(dateTimeLocalVal);
    return d.toISOString();
  }

  // Build YAML payload string
  function buildCommandOutput() {
    const title = titleInput.value.trim();
    if (!title) {
      alert('Please enter a title for your meetup!');
      titleInput.focus();
      return null;
    }

    const meetupObj = {
      title: title,
      date: toISOStringWithTZ(dateInput.value),
    };

    if (selectedCategory && selectedCategory !== 'default') {
      meetupObj.category = selectedCategory;
    }

    if (durationInput.value) {
      const dur = parseInt(durationInput.value, 10);
      if (!isNaN(dur) && dur > 0) {
        meetupObj.duration = dur;
      }
    }

    if (maxRsvpInput.value) {
      const maxCap = parseInt(maxRsvpInput.value, 10);
      if (!isNaN(maxCap) && maxCap > 0) {
        meetupObj.maxRsvp = maxCap;
      }
    }

    if (rsvpDeadlineInput.value) {
      meetupObj.rsvpDeadline = toISOStringWithTZ(rsvpDeadlineInput.value);
    }

    if (roleSelect.value) {
      meetupObj.subscription = roleSelect.value;
    }

    if (descriptionInput.value.trim()) {
      meetupObj.description = descriptionInput.value.trim();
    }

    if (locationInput.value.trim()) {
      meetupObj.location = locationInput.value.trim();
      if (locationCommentsInput.value.trim()) {
        meetupObj.location_comments = locationCommentsInput.value.trim();
      }
      meetupObj.location_linked = locationLinkedInput.checked;
    }

    const validLinks = links.filter(l => l.url && l.url.trim().length > 0);
    if (validLinks.length > 0) {
      meetupObj.links = validLinks.map(l => {
        const item = { url: l.url.trim() };
        if (l.label && l.label.trim()) item.label = l.label.trim();
        return item;
      });
    }

    let yamlBody = '';
    if (typeof jsyaml !== 'undefined') {
      yamlBody = jsyaml.dump(meetupObj, { lineWidth: -1 });
    } else {
      yamlBody = JSON.stringify(meetupObj, null, 2);
    }

    const commandHead = isEditMode ? `!meetup edit` : `!meetup create`;
    return `${commandHead}\n${yamlBody.trim()}`;
  }

  // Action Event Handlers
  generateBtn.addEventListener('click', () => {
    const cmd = buildCommandOutput();
    if (!cmd) return;

    commandPreview.textContent = cmd;
    outputModal.classList.add('active');
  });

  closeModalBtn.addEventListener('click', () => {
    outputModal.classList.remove('active');
  });

  outputModal.addEventListener('click', (e) => {
    if (e.target === outputModal) {
      outputModal.classList.remove('active');
    }
  });

  copyBtn.addEventListener('click', () => {
    const textToCopy = commandPreview.textContent;
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyToast.classList.add('show');
      setTimeout(() => {
        copyToast.classList.remove('show');
      }, 2500);
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err);
    });
  });

  // Init
  initServerRoleSelection();
  renderCategoryChips();
  checkHashEditMode();
});
