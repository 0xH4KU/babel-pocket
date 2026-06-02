/**
 * Access tab: user whitelist management, per-user budgets, and user language preferences.
 */

let userBudgetData = {};
let accessUserIds = [];
let userProfiles = {};
let allowedUsersPage = 1,
    allowedUsersPageSize = 15;
let accessAllowedUserIdsDraft = [];
let accessWhitelistDirty = false;
let accessWhitelistLoaded = false;

function normalizeUserIds(ids) {
    return [...new Set((ids || []).map((id) => String(id).trim()).filter(Boolean))];
}

function sameUserIds(a, b) {
    const left = normalizeUserIds(a).sort();
    const right = normalizeUserIds(b).sort();

    if (left.length !== right.length) return false;
    return left.every((id, index) => id === right[index]);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
        const entities = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return entities[char];
    });
}

function userProfile(userId) {
    return userProfiles[userId] || null;
}

function userDisplayName(userId) {
    const profile = userProfile(userId);
    return profile?.displayName || profile?.globalName || profile?.username || userId;
}

function userAvatar(userId) {
    return userProfile(userId)?.avatarUrl || genAvatar(userDisplayName(userId));
}

function userSearchText(userId) {
    const profile = userProfile(userId);
    return [userId, profile?.displayName, profile?.globalName, profile?.username]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function renderUserIdentity(userId, withAvatar = false) {
    const displayName = escapeHtml(userDisplayName(userId));
    const escapedUserId = escapeHtml(userId);
    const avatar = withAvatar
        ? `<img class="user-identity-avatar" src="${escapeHtml(userAvatar(userId))}" alt="">`
        : '';

    return `<span class="user-identity">
        ${avatar}
        <span class="user-identity-text">
          <span class="user-identity-name">${displayName}</span>
          <span class="user-identity-id">${escapedUserId}</span>
        </span>
      </span>`;
}

function updateAccessSaveState() {
    const status = accessWhitelistDirty
        ? `${accessAllowedUserIdsDraft.length} enabled user(s) pending save`
        : 'No unsaved whitelist changes';

    document.querySelectorAll('[data-access-save-status]').forEach((node) => {
        node.textContent = status;
        node.classList.toggle('dirty', accessWhitelistDirty);
    });

    document.querySelectorAll('[data-access-save-button]').forEach((button) => {
        button.disabled = !accessWhitelistDirty;
    });
}

function setAccessWhitelistDraft(allowedUserIds) {
    accessAllowedUserIdsDraft = normalizeUserIds(allowedUserIds);
    accessWhitelistDirty = !sameUserIds(
        accessAllowedUserIdsDraft,
        currentConfig.allowedUserIds || [],
    );
    updateAccessSaveState();
}

function updateAccessUsersFromBudgetPayload(payload) {
    userBudgetData = payload.budgets || payload;
    const ids = normalizeUserIds(Object.keys(userBudgetData));
    const merged = new Set([...ids, ...accessAllowedUserIdsDraft]);
    accessUserIds = [...merged];
}

async function loadAccess() {
    try {
        const [cfgRes, budgetRes] = await Promise.all([api('/config'), api('/user-budgets')]);
        currentConfig = await cfgRes.json();
        currentConfig.allowedUserIds = normalizeUserIds(currentConfig.allowedUserIds || []);
        if (!accessWhitelistLoaded || !accessWhitelistDirty) {
            accessAllowedUserIdsDraft = [...currentConfig.allowedUserIds];
        }
        accessWhitelistLoaded = true;
        const budgetPayload = await budgetRes.json();
        updateAccessUsersFromBudgetPayload(budgetPayload);
        userProfiles = budgetPayload.profiles || {};
        renderAllowedUsers();
        updateAccessSaveState();
        loadUserPrefs();
    } catch {}
}

async function saveUserWhitelist() {
    const allowedUserIds = normalizeUserIds(accessAllowedUserIdsDraft);

    const res = await api('/config', {
        method: 'POST',
        body: JSON.stringify({ allowedUserIds }),
    });

    if (res.ok) {
        currentConfig.allowedUserIds = [...allowedUserIds];
        accessAllowedUserIdsDraft = [...allowedUserIds];
        accessWhitelistDirty = false;
        const budgetRes = await api('/user-budgets');
        const budgetPayload = await budgetRes.json();
        updateAccessUsersFromBudgetPayload(budgetPayload);
        userProfiles = { ...userProfiles, ...(budgetPayload.profiles || {}) };
        updateAccessSaveState();
        renderAllowedUsers();
        showToast('Access settings saved!');
    } else {
        showToast('Save failed', true);
    }
}

function renderAllowedUsers() {
    const container = document.getElementById('user-access-list');
    if (!container) return;

    const allowed = accessUserIds;
    const enabledIds = new Set(accessAllowedUserIdsDraft);
    const defaultBudget = currentConfig.defaultUserDailyBudgetUsd || 0;

    if (allowed.length === 0) {
        container.innerHTML =
            '<div class="no-guilds">No users have requested access yet. Paste a Discord User ID below to add one.</div>';
        document.getElementById('user-access-pagination').innerHTML = '';
        return;
    }

    const totalPages = Math.max(Math.ceil(allowed.length / allowedUsersPageSize), 1);
    allowedUsersPage = Math.min(allowedUsersPage, totalPages);
    const start = (allowedUsersPage - 1) * allowedUsersPageSize;
    const pageItems = allowed.slice(start, start + allowedUsersPageSize);

    container.innerHTML = pageItems
        .map((userId) => {
            const budgetData = userBudgetData[userId];
            const enabled = enabledIds.has(userId);
            const pending = Boolean(budgetData?.pending) && !enabled;
            const hasCustomBudget = budgetData && budgetData.isCustom;
            const effectiveBudget = hasCustomBudget ? budgetData.budget : defaultBudget;
            const budgetLabel = hasCustomBudget
                ? formatUsd(effectiveBudget)
                : defaultBudget > 0
                  ? formatUsd(defaultBudget) + ' (default)'
                  : 'Unlimited';

            return `<div class="guild-item guild-item-col">
      <div class="guild-item-row">
        <img src="${escapeHtml(userAvatar(userId))}" alt="">
        <span class="guild-name">${renderUserIdentity(userId)}</span>
        <span class="guild-members user-access-state">
          <span class="badge ${enabled ? 'badge-green' : pending ? 'badge-yellow' : 'badge-red'}">
            ${enabled ? 'Enabled' : pending ? 'Pending' : 'Disabled'}
          </span>
        </span>
        <label class="toggle user-access-toggle" title="${enabled ? 'Disable this user' : 'Enable this user'}">
          <input type="checkbox" ${enabled ? 'checked' : ''} onchange="setAllowedUserEnabled('${userId}', this.checked)">
          <span class="slider"></span>
        </label>
      </div>
      <div class="guild-budget-row">
        <div class="guild-budget-info">
          <span class="guild-budget-label">Budget: ${budgetLabel}</span>
        </div>
        <div class="guild-budget-actions">
          <input type="number" class="guild-budget-input" id="ub-${userId}" min="0" step="0.1"
            placeholder="${hasCustomBudget ? effectiveBudget : 'Default'}"
            value="${hasCustomBudget ? effectiveBudget : ''}"
            title="Set per-user budget (USD). Empty = use default.">
          <button class="btn btn-secondary btn-xs" onclick="saveUserBudget('${userId}')">Set</button>
          ${hasCustomBudget ? `<button class="btn-danger btn-xs" onclick="resetUserBudget('${userId}')" title="Reset to default">↺</button>` : ''}
        </div>
      </div>
    </div>`;
        })
        .join('');

    renderPagination('user-access-pagination', {
        total: allowed.length,
        page: allowedUsersPage,
        pageSize: allowedUsersPageSize,
        onPageChange: 'setAllowedUsersPage',
        onSizeChange: 'setAllowedUsersPageSize',
    });
}

function setAllowedUsersPage(p) {
    allowedUsersPage = p;
    renderAllowedUsers();
}
function setAllowedUsersPageSize(s) {
    allowedUsersPageSize = s;
    allowedUsersPage = 1;
    renderAllowedUsers();
}

function addAllowedUser() {
    const input = document.getElementById('add-user-input');
    const id = input.value.trim();
    if (!id || !/^\d+$/.test(id)) {
        showToast('Please enter a valid Discord User ID (numbers only)', true);
        return;
    }

    const nextAllowed = new Set(accessAllowedUserIdsDraft);
    if (nextAllowed.has(id)) {
        showToast('User already in whitelist draft');
        return;
    }

    nextAllowed.add(id);
    setAccessWhitelistDraft([...nextAllowed]);
    accessUserIds = normalizeUserIds([...accessUserIds, id]);
    allowedUsersPage = Math.max(Math.ceil(accessUserIds.length / allowedUsersPageSize), 1);
    input.value = '';
    renderAllowedUsers();
    showToast('User added — click Save to apply');
}

function setAllowedUserEnabled(id, enabled) {
    const nextAllowed = new Set(accessAllowedUserIdsDraft);
    if (enabled) {
        nextAllowed.add(id);
    } else {
        nextAllowed.delete(id);
    }

    accessUserIds = normalizeUserIds([...accessUserIds, id]);
    setAccessWhitelistDraft([...nextAllowed]);
    renderAllowedUsers();
    showToast(`${enabled ? 'User enabled' : 'User disabled'} — click Save to apply`);
}

async function saveUserBudget(userId) {
    const input = document.getElementById('ub-' + userId);
    const val = input.value.trim();

    if (val === '') {
        return resetUserBudget(userId);
    }

    const budget = parseFloat(val);
    if (isNaN(budget) || budget < 0) {
        showToast('Invalid budget value', true);
        return;
    }

    const res = await api('/user-budgets/' + userId, {
        method: 'POST',
        body: JSON.stringify({ dailyBudgetUsd: budget }),
    });

    if (res.ok) {
        showToast('User budget saved!');
        const budgetRes = await api('/user-budgets');
        const budgetPayload = await budgetRes.json();
        updateAccessUsersFromBudgetPayload(budgetPayload);
        userProfiles = { ...userProfiles, ...(budgetPayload.profiles || {}) };
        renderAllowedUsers();
    } else {
        showToast('Save failed', true);
    }
}

async function resetUserBudget(userId) {
    const res = await api('/user-budgets/' + userId, {
        method: 'POST',
        body: JSON.stringify({ dailyBudgetUsd: null }),
    });

    if (res.ok) {
        showToast('Reset to default user budget');
        const budgetRes = await api('/user-budgets');
        const budgetPayload = await budgetRes.json();
        updateAccessUsersFromBudgetPayload(budgetPayload);
        userProfiles = { ...userProfiles, ...(budgetPayload.profiles || {}) };
        renderAllowedUsers();
    } else {
        showToast('Reset failed', true);
    }
}

// ===== User Preferences =====

const LANG_NAMES = {
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português',
    ru: 'Русский',
    it: 'Italiano',
    vi: 'Tiếng Việt',
    th: 'ไทย',
    ar: 'العربية',
    hi: 'हिन्दी',
    id: 'Bahasa Indonesia',
    tr: 'Türkçe',
};

let allPrefsData = {};
let prefsPage = 1,
    prefsPageSize = 15;
let prefsSearch = '';
let selectedPrefUserIds = new Set();

async function loadUserPrefs() {
    try {
        const res = await api('/user-prefs');
        if (!res.ok) return;
        const { prefs, count, profiles } = await res.json();
        allPrefsData = prefs;
        userProfiles = { ...userProfiles, ...(profiles || {}) };
        document.getElementById('prefs-count').textContent =
            count + ' user(s) with custom settings';
        prefsPage = 1;
        selectedPrefUserIds = new Set(
            [...selectedPrefUserIds].filter((userId) =>
                Object.prototype.hasOwnProperty.call(prefs, userId),
            ),
        );
        renderUserPrefs();
    } catch {}
}

function filteredPrefsEntries() {
    const query = prefsSearch.trim().toLowerCase();
    const entries = Object.entries(allPrefsData);

    if (!query) return entries;

    return entries.filter(([userId, lang]) => {
        const name = LANG_NAMES[lang] || lang;
        return (
            userId.toLowerCase().includes(query) ||
            userSearchText(userId).includes(query) ||
            String(lang).toLowerCase().includes(query) ||
            String(name).toLowerCase().includes(query)
        );
    });
}

function updatePrefBatchState() {
    const button = document.getElementById('prefs-batch-delete');
    if (!button) return;

    button.disabled = selectedPrefUserIds.size === 0;
    button.textContent =
        selectedPrefUserIds.size === 0
            ? 'Clear Selected'
            : `Clear Selected (${selectedPrefUserIds.size})`;
}

function renderUserPrefs() {
    const container = document.getElementById('user-prefs-container');
    const entries = filteredPrefsEntries();

    if (entries.length === 0) {
        container.innerHTML =
            '<div class="empty-state">No matching user language preferences.</div>';
        document.getElementById('prefs-pagination').innerHTML = '';
        updatePrefBatchState();
        return;
    }

    const start = (prefsPage - 1) * prefsPageSize;
    const pageEntries = entries.slice(start, start + prefsPageSize);

    let html = `<div class="table-scroll"><table class="data-table user-prefs-table"><thead><tr>
    <th></th><th>User</th><th>Language</th><th></th>
  </tr></thead><tbody>`;
    for (const [userId, lang] of pageEntries) {
        const name = LANG_NAMES[lang] || lang;
        const checked = selectedPrefUserIds.has(userId) ? 'checked' : '';
        html += `<tr>
      <td><input type="checkbox" onchange="togglePrefSelection('${userId}', this.checked)" ${checked}></td>
      <td>${renderUserIdentity(userId, true)}</td>
      <td>${escapeHtml(name)} (${escapeHtml(lang)})</td>
      <td><button class="btn-danger" onclick="deleteUserPref('${userId}')">Delete</button></td>
    </tr>`;
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;

    renderPagination('prefs-pagination', {
        total: entries.length,
        page: prefsPage,
        pageSize: prefsPageSize,
        onPageChange: 'setPrefsPage',
        onSizeChange: 'setPrefsPageSize',
    });
    document.getElementById('prefs-count').textContent =
        `${entries.length} shown / ${Object.keys(allPrefsData).length} total`;
    updatePrefBatchState();
}

function setPrefsPage(p) {
    prefsPage = p;
    renderUserPrefs();
}
function setPrefsPageSize(s) {
    prefsPageSize = s;
    prefsPage = 1;
    renderUserPrefs();
}

function setPrefsSearch(value) {
    prefsSearch = value || '';
    prefsPage = 1;
    renderUserPrefs();
}

function togglePrefSelection(userId, checked) {
    if (checked) {
        selectedPrefUserIds.add(userId);
    } else {
        selectedPrefUserIds.delete(userId);
    }

    updatePrefBatchState();
}

async function deleteSelectedUserPrefs() {
    const userIds = [...selectedPrefUserIds];
    if (userIds.length === 0) return;

    const res = await api('/user-prefs/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ userIds }),
    });

    if (res.ok) {
        const data = await res.json();
        for (const userId of data.deleted || []) {
            delete allPrefsData[userId];
            selectedPrefUserIds.delete(userId);
        }
        showToast(`${(data.deleted || []).length} user preference(s) cleared`);
        renderUserPrefs();
    } else {
        showToast('Batch delete failed', true);
    }
}

async function deleteUserPref(userId) {
    const res = await api('/user-prefs/' + userId, { method: 'DELETE' });
    if (res.ok) {
        showToast('User preference deleted');
        delete allPrefsData[userId];
        selectedPrefUserIds.delete(userId);
        document.getElementById('prefs-count').textContent =
            Object.keys(allPrefsData).length + ' user(s) with custom settings';
        renderUserPrefs();
    } else {
        showToast('Delete failed', true);
    }
}
