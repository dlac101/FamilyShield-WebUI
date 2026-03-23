/* ═══════════════════════════════════════════════════════
   SmartOS Family Shield — Main Application
   ═══════════════════════════════════════════════════════ */

// ── State ──
let currentFsView = 'overview';
let currentMonitorTab = 'activity';
let currentTimeRange = { activity: 1440, usage: '1d', webhistory: 7 };
let selectedDeviceMac = null;
let selectedProfileId = null;
let activeProfileTab = 'schedule';
let globalSettings = {};
let allProfiles = [];
let allDevices = [];
let webHistoryFilter = 'all'; // 'all' | 'allowed' | 'blocked'
let activityFilter = 'all';   // 'all' | 'allowed' | 'blocked'

// ── DOM helpers ──
const el = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => document.querySelectorAll(sel);

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  bindNavigation();
  bindThemeToggle();
  bindViewToggle();
  await loadInitialData();
  renderOverview();
});

// ═══════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════

function bindNavigation() {
  // Sidebar sub-item clicks
  qsa('.nav-subitem').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchFsView(item.dataset.view);
      closeMobileSidebar(); // close sidebar on mobile after navigation
    });
  });

  // Sidebar group toggle (expand/collapse)
  const groupToggle = el('navFamilyShield');
  if (groupToggle) {
    groupToggle.addEventListener('click', () => {
      groupToggle.classList.toggle('active-group');
    });
  }

  // Monitor sub-tabs
  qsa('.mon-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentMonitorTab = btn.dataset.montab;
      qsa('.mon-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderMonitorTimeRange();
      renderMonitorContent();
    });
  });
}

function switchFsView(viewName) {
  currentFsView = viewName;

  // Update sidebar active state
  qsa('.nav-subitem').forEach(n => n.classList.remove('active'));
  const navItem = qs(`.nav-subitem[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add('active');

  // Update page title
  const titles = { overview: 'Overview', profiles: 'Profiles', monitor: 'Monitor' };
  el('pageTitle').textContent = titles[viewName] || viewName;

  // Show/hide views
  el('viewOverview').style.display = viewName === 'overview' ? '' : 'none';
  el('viewProfiles').style.display = viewName === 'profiles' ? '' : 'none';
  el('viewMonitor').style.display = viewName === 'monitor' ? '' : 'none';

  // Render
  if (viewName === 'overview') renderOverview();
  else if (viewName === 'profiles') renderProfiles();
  else if (viewName === 'monitor') renderMonitor();
}

// ═══════════════════════════════════════════════════════
//  THEME & VIEW TOGGLES
// ═══════════════════════════════════════════════════════

function bindThemeToggle() {
  el('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') !== 'light';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  });
}

function bindViewToggle() {
  // Restore saved view preference
  const saved = localStorage.getItem('fs_view_mode');
  if (saved) setView(saved);
}

function setView(mode) {
  document.body.dataset.view = mode;
  localStorage.setItem('fs_view_mode', mode);
  qsa('.view-toggle').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === mode)
  );
}

// ── Mobile Sidebar ──
function toggleMobileSidebar() {
  const sidebar = qs('.sidebar');
  const backdrop = el('sidebarBackdrop');
  sidebar.classList.toggle('open');
  backdrop.classList.toggle('visible');
}
function closeMobileSidebar() {
  const sidebar = qs('.sidebar');
  const backdrop = el('sidebarBackdrop');
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════
//  DATA LOADING
// ═══════════════════════════════════════════════════════

async function loadInitialData() {
  try {
    const [settings, profiles, devices] = await Promise.all([
      FS_DATA.getGlobalSettings(),
      FS_DATA.getProfiles(),
      FS_DATA.getDevices(),
    ]);
    globalSettings = settings;
    allProfiles = profiles;
    allDevices = devices;

    if (allDevices.length && !selectedDeviceMac) {
      selectedDeviceMac = allDevices[0].mac;
    }
    if (allProfiles.length && !selectedProfileId) {
      selectedProfileId = allProfiles[0].id;
    }

    // Update topbar stats
    const summary = await FS_DATA.getDashboardSummary();
    el('statProfiles').textContent = summary.profileCount;
    el('statDevices').textContent = summary.deviceCount;
    el('statBlocked').textContent = summary.blockedToday;

    // Shield badge
    updateShieldBadge();
  } catch (err) {
    console.error('[FS] Failed to load initial data:', err);
  }
}

function updateShieldBadge() {
  const badge = el('shieldBadge');
  if (globalSettings.shield) {
    badge.textContent = 'SHIELD ON';
    badge.classList.add('on');
  } else {
    badge.textContent = 'SHIELD OFF';
    badge.classList.remove('on');
  }
}

// ═══════════════════════════════════════════════════════
//  OVERVIEW VIEW
// ═══════════════════════════════════════════════════════

async function renderOverview() {
  renderShieldCard();
  const summary = await FS_DATA.getDashboardSummary();
  renderProfilesSummary(summary);
  renderTodayActivity(summary);
  renderAlerts(summary.alerts);
  renderTopBlocked(summary);
}

function renderShieldCard() {
  const iconWrap = el('shieldIconWrap');
  const heroIcon = el('shieldHeroIcon');
  const stateText = el('shieldStateText');
  const subText = el('shieldSubText');

  if (globalSettings.shield) {
    iconWrap.classList.add('on');
    heroIcon.className = 'ph-duotone ph-shield-check';
    heroIcon.style.fontSize = '40px';
    stateText.textContent = 'Family Shield is ON';
    subText.textContent = 'Default safety controls are applied network-wide';
  } else {
    iconWrap.classList.remove('on');
    heroIcon.className = 'ph-duotone ph-shield-slash';
    heroIcon.style.fontSize = '40px';
    stateText.textContent = 'Family Shield is OFF';
    subText.textContent = 'Enable to apply default safety controls network-wide';
  }

  // Master toggle
  setSwitch('toggleShield', globalSettings.shield);
  bindSwitch('toggleShield', (on) => {
    globalSettings.shield = on;
    renderShieldCard();
    updateShieldBadge();
    FS_DATA.updateGlobalSettings(globalSettings);
  });

  // Chip states
  el('chipMacs')?.classList.toggle('active', !!globalSettings.blockMacs);
  el('chipApproval')?.classList.toggle('active', !!globalSettings.requireApproval);
  el('chipRateLimits')?.classList.toggle('active', !!globalSettings.rateLimits?.enabled);

  // Rate limit inputs visibility
  el('rateLimitInputs').style.display = globalSettings.rateLimits?.enabled ? 'flex' : 'none';
  el('rlDown').value = globalSettings.rateLimits?.down || 150;
  el('rlUp').value = globalSettings.rateLimits?.up || 150;
}

function toggleShieldChip(settingKey, chipId, btn) {
  if (settingKey === 'rateLimits') {
    if (!globalSettings.rateLimits) globalSettings.rateLimits = { enabled: false };
    globalSettings.rateLimits.enabled = !globalSettings.rateLimits.enabled;
    btn.classList.toggle('active', globalSettings.rateLimits.enabled);
    el('rateLimitInputs').style.display = globalSettings.rateLimits.enabled ? 'flex' : 'none';
  } else {
    globalSettings[settingKey] = !globalSettings[settingKey];
    btn.classList.toggle('active', globalSettings[settingKey]);
  }
  FS_DATA.updateGlobalSettings(globalSettings);
}

function renderProfilesSummary(summary) {
  const container = el('profilesSummaryContent');
  container.innerHTML = summary.profiles.map(p => {
    const statusCls = p.status === 'Active' ? 'active' : 'paused';
    const iconCls = statusCls;
    const icon = p.status === 'Active' ? 'ph-bold ph-user' : 'ph-bold ph-user';
    return `
      <div class="profile-summary-row" onclick="switchFsView('profiles');selectProfile('${p.id}')">
        <div class="profile-icon ${iconCls}"><i class="${icon}"></i></div>
        <div class="profile-summary-info">
          <div class="profile-summary-name">${esc(p.name)}</div>
          <div class="profile-summary-meta">${p.deviceCount} device${p.deviceCount !== 1 ? 's' : ''}</div>
        </div>
        <span class="profile-summary-status ${statusCls}">${p.status}</span>
      </div>`;
  }).join('');
}

function renderTodayActivity(summary) {
  const container = el('todayStatsContent');
  const topCat = summary.topBlockedCategories[0];
  const topDom = summary.topBlockedDomains[0];
  container.innerHTML = `
    <div class="today-stat-row">
      <div class="today-stat-box clickable" onclick="goToMonitorTab('activity','blocked')" title="View blocked activity">
        <div class="today-stat-val">${summary.blockedToday}</div>
        <div class="today-stat-label">Blocks</div>
      </div>
      <div class="today-stat-box clickable" onclick="goToMonitorTab('web-history','blocked')" title="View blocked sites">
        <div class="today-stat-val">${summary.topBlockedDomains.length}</div>
        <div class="today-stat-label">Sites</div>
      </div>
      <div class="today-stat-box clickable" onclick="scrollToAlerts()" title="View recent alerts">
        <div class="today-stat-val">${summary.alerts.length}</div>
        <div class="today-stat-label">Alerts</div>
      </div>
    </div>
    <div class="today-top-blocked">
      <strong>Top blocked:</strong> ${topCat ? topCat[0] : 'none'}${topDom ? ', ' + topDom[0] : ''}
    </div>
    <div class="today-chart-section">
      <div class="today-chart-header">
        <span class="today-chart-label">Blocks by hour</span>
        <span class="today-chart-ymax" id="chartYMax"></span>
      </div>
      <div class="today-chart-wrap" style="position:relative">
        <canvas id="blocksChart" width="400" height="48"></canvas>
        <div class="chart-tooltip" id="chartTooltip"></div>
      </div>
      <div class="today-chart-axis">
        <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>12a</span>
      </div>
    </div>`;

  // Draw mini blocks-per-hour chart
  requestAnimationFrame(() => drawBlocksChart(summary));
}

let _chartHours = [];
let _chartBarW = 0;

function drawBlocksChart(summary) {
  const canvas = el('blocksChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.parentElement.offsetWidth;
  const h = 80;
  canvas.width = w;
  canvas.height = h;

  // Mock hourly distribution
  const hours = Array(24).fill(0);
  const total = summary.blockedToday;
  if (total > 0) {
    [9,10,11,14,15,16,17,19,20,21].forEach(hr => {
      hours[hr] = Math.floor(total / 10) + Math.floor(Math.random() * 3);
    });
  }
  const max = Math.max(...hours, 1);
  const barW = (w - 24) / 24;
  const gap = 2;

  // Store for tooltip
  _chartHours = hours;
  _chartBarW = barW;

  // Y-axis max label
  const yMax = el('chartYMax');
  if (yMax) yMax.textContent = max + ' max';

  ctx.clearRect(0, 0, w, h);
  hours.forEach((val, i) => {
    const barH = (val / max) * (h - 8);
    const x = 4 + i * barW;
    const y = h - 4 - barH;
    ctx.fillStyle = val > 0
      ? (isDarkTheme() ? 'rgba(239,68,68,0.6)' : 'rgba(220,38,38,0.5)')
      : (isDarkTheme() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)');
    ctx.beginPath();
    ctx.roundRect(x + gap/2, y, barW - gap, barH, 2);
    ctx.fill();
  });

  // Tooltip on hover
  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const hourIdx = Math.floor((mx - 4) / barW);
    const tip = el('chartTooltip');
    if (!tip) return;
    if (hourIdx >= 0 && hourIdx < 24) {
      const hr12 = hourIdx === 0 ? '12am' : hourIdx < 12 ? hourIdx + 'am' : hourIdx === 12 ? '12pm' : (hourIdx - 12) + 'pm';
      const val = _chartHours[hourIdx];
      tip.textContent = hr12 + ': ' + val + ' block' + (val !== 1 ? 's' : '');
      tip.style.opacity = '1';
      // Position tooltip centered above the bar
      const tipX = 4 + hourIdx * barW + barW / 2;
      tip.style.left = tipX + 'px';
    } else {
      tip.style.opacity = '0';
    }
  };
  canvas.onmouseleave = () => {
    const tip = el('chartTooltip');
    if (tip) tip.style.opacity = '0';
  };
}

function goToMonitorTab(tab, filter) {
  currentMonitorTab = tab;
  if (filter) {
    if (tab === 'activity') activityFilter = filter;
    else if (tab === 'web-history') webHistoryFilter = filter;
  }
  switchFsView('monitor');
  // Update the monitor tab buttons to reflect the selected tab
  qsa('.mon-tab').forEach(b => b.classList.toggle('active', b.dataset.montab === tab));
  renderMonitorTimeRange();
  renderMonitorContent();
}

function scrollToAlerts() {
  const card = el('card-notifications');
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Brief highlight flash
    card.style.outline = '2px solid var(--accent-cyan)';
    card.style.outlineOffset = '2px';
    setTimeout(() => {
      card.style.outline = '';
      card.style.outlineOffset = '';
    }, 1500);
  }
}

function renderAlerts(alerts) {
  const container = el('alertsContent');
  if (!alerts || !alerts.length) {
    container.innerHTML = '<div class="empty-state">No alerts</div>';
    return;
  }
  container.innerHTML = alerts.map(a => `
    <div class="alert-row">
      <div class="alert-dot ${a.type}"></div>
      <span style="flex:1">${esc(a.text)}</span>
      <span style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted)">${a.time}</span>
    </div>`).join('');
}

function renderTopBlocked(summary) {
  const container = el('topBlockedContent');
  const domains = summary.topBlockedDomains.slice(0, 8);
  const cats = summary.topBlockedCategories.slice(0, 8);

  container.innerHTML = `
    <div class="top-blocked-col">
      <div class="top-blocked-title">Domains</div>
      ${domains.map(([d, c]) => `
        <div class="top-blocked-item">
          <span class="top-blocked-domain">${esc(d)}</span>
          <span class="top-blocked-count">${c}</span>
        </div>`).join('') || '<div class="empty-state">None</div>'}
    </div>
    <div class="top-blocked-col">
      <div class="top-blocked-title">Categories</div>
      ${cats.map(([d, c]) => `
        <div class="top-blocked-item">
          <span class="top-blocked-domain">${esc(d)}</span>
          <span class="top-blocked-count">${c}</span>
        </div>`).join('') || '<div class="empty-state">None</div>'}
    </div>`;
}

// ═══════════════════════════════════════════════════════
//  PROFILES VIEW
// ═══════════════════════════════════════════════════════

function renderProfiles() {
  renderProfileStrip();
  renderProfileEditor();
}

function selectProfile(id) {
  selectedProfileId = id;
  renderProfiles();
}

function renderProfileStrip() {
  const strip = el('profileStrip');
  const pills = allProfiles.map(p => {
    const sel = p.id === selectedProfileId ? 'selected' : '';
    const dotCls = p.status === 'Active' ? 'active' : 'paused';
    const devCount = allDevices.filter(d => d.profile === p.name).length;
    return `
      <button class="profile-pill ${sel}" onclick="selectProfile('${p.id}')">
        <span class="pill-dot ${dotCls}"></span>
        ${esc(p.name)}
        <span class="pill-devices">${devCount}</span>
      </button>`;
  }).join('');

  strip.innerHTML = pills + `
    <div class="profile-strip-actions">
      <button class="btn-icon" title="Add profile" onclick="addProfile()"><i class="ph-bold ph-plus"></i></button>
      <button class="btn-icon danger" title="Delete profile" onclick="deleteCurrentProfile()" ${allProfiles.length <= 1 ? 'disabled style="opacity:0.3;pointer-events:none"' : ''}>
        <i class="ph-bold ph-trash"></i>
      </button>
    </div>`;
}

function renderProfileEditor() {
  const profile = allProfiles.find(p => p.id === selectedProfileId);
  if (!profile) {
    el('profileEditorHeader').innerHTML = '<div class="empty-state">Select a profile</div>';
    el('profileTabs').innerHTML = '';
    el('profileTabContent').innerHTML = '';
    return;
  }

  const statusCls = profile.status === 'Active' ? 'active' : 'paused';
  el('profileEditorHeader').innerHTML = `
    <span class="profile-editor-name">${esc(profile.name)}</span>
    <button class="profile-status-btn ${statusCls}" onclick="toggleProfileStatus('${profile.id}')">
      ${profile.status === 'Active' ? '<i class="ph-bold ph-play"></i> Profile Active' : '<i class="ph-bold ph-pause"></i> Profile Paused'}
    </button>`;

  // Tabs
  const tabs = [
    { id: 'schedule', label: 'Schedule' },
    { id: 'limits', label: 'Limits' },
    { id: 'web', label: 'Web' },
    { id: 'apps', label: 'Apps', techOnly: true },
    { id: 'protocols', label: 'Protocols', techOnly: true },
    { id: 'devices', label: 'Devices' },
    { id: 'alerts', label: 'Alerts', techOnly: true },
  ];

  el('profileTabs').innerHTML = tabs.map(t =>
    `<button class="profile-tab ${t.id === activeProfileTab ? 'active' : ''} ${t.techOnly ? 'tech-only' : ''}" data-ptab="${t.id}" onclick="switchProfileTab('${t.id}')">${t.label}</button>`
  ).join('');

  renderProfileTabContent(profile);
}

function switchProfileTab(tabId) {
  activeProfileTab = tabId;
  qsa('.profile-tab').forEach(t => t.classList.toggle('active', t.dataset.ptab === tabId));
  const profile = allProfiles.find(p => p.id === selectedProfileId);
  if (profile) renderProfileTabContent(profile);
}

function renderProfileTabContent(profile) {
  const c = el('profileTabContent');
  switch (activeProfileTab) {
    case 'schedule': c.innerHTML = renderScheduleTab(profile); break;
    case 'limits': c.innerHTML = renderLimitsTab(profile); break;
    case 'web': c.innerHTML = renderWebTab(profile); break;
    case 'apps': c.innerHTML = renderAppsTab(profile); break;
    case 'protocols': c.innerHTML = renderProtocolsTab(profile); break;
    case 'devices': c.innerHTML = renderDevicesTab(profile); break;
    case 'alerts': c.innerHTML = renderAlertsTab(profile); break;
    default: c.innerHTML = '';
  }
}

// ── Shared day constants ──
const DAYS = [
  { key: 'Mon', label: 'M' }, { key: 'Tue', label: 'T' }, { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'Th' }, { key: 'Fri', label: 'F' }, { key: 'Sat', label: 'Sa' }, { key: 'Sun', label: 'Su' }
];

// ── Schedule Tab (Feature Card) ──
function renderScheduleTab(p) {
  const sched = p.schedule || { enabled: false, windows: [{ start: '15:00', end: '17:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] }] };

  let html = `<div class="fc ${sched.enabled ? 'active' : ''}">
    <div class="fc-header" onclick="toggleScheduleEnabled('${p.id}')">
      <div class="fc-icon"><i class="ph-duotone ph-calendar-check"></i></div>
      <div class="fc-info">
        <div class="fc-title">Internet Access Schedule</div>
        <div class="fc-desc">Allow internet only during scheduled time windows</div>
      </div>
      <span class="fc-status ${sched.enabled ? 'on' : 'off'}">${sched.enabled ? 'ON' : 'OFF'}</span>
      <div class="fs-switch ${sched.enabled ? 'on' : ''}"><div class="fs-switch-thumb"></div></div>
    </div>`;

  if (sched.enabled) {
    html += `<div class="fc-body"><div class="fc-body-inner">`;
    sched.windows.forEach((win, idx) => {
      html += `<div class="fc-window-label">Window ${idx + 1}${sched.windows.length > 1 ? `<button class="btn-remove-window" onclick="removeScheduleWindow('${p.id}',${idx})" title="Remove window"><i class="ph-bold ph-x"></i></button>` : ''}</div>
        <div class="day-selector">
          ${DAYS.map(d => `<button class="day-btn ${win.days.includes(d.key) ? 'selected' : ''}" onclick="toggleScheduleDay('${p.id}',${idx},'${d.key}')">${d.label}</button>`).join('')}
        </div>
        <div class="time-range-row">
          <input type="time" class="fs-input" value="${win.start}" onchange="updateScheduleTime('${p.id}',${idx},'start',this.value)">
          <span class="time-range-sep">to</span>
          <input type="time" class="fs-input" value="${win.end}" onchange="updateScheduleTime('${p.id}',${idx},'end',this.value)">
        </div>`;
    });
    html += `<button class="btn-add" onclick="addScheduleWindow('${p.id}')"><i class="ph-bold ph-plus"></i> Add Window</button>`;
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

function toggleScheduleDay(profileId, winIdx, dayKey) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.schedule) return;
  const win = p.schedule.windows[winIdx];
  if (!win) return;
  const i = win.days.indexOf(dayKey);
  if (i >= 0) win.days.splice(i, 1);
  else win.days.push(dayKey);
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function updateScheduleTime(profileId, winIdx, field, value) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.schedule) return;
  const win = p.schedule.windows[winIdx];
  if (!win) return;
  win[field] = value;
  FS_DATA.updateProfile(profileId, p);
}

function addScheduleWindow(profileId) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.schedule) return;
  p.schedule.windows.push({ start: '08:00', end: '12:00', days: ['Mon','Tue','Wed','Thu','Fri'] });
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function removeScheduleWindow(profileId, winIdx) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.schedule || p.schedule.windows.length <= 1) return;
  p.schedule.windows.splice(winIdx, 1);
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

// ── Limits Tab (Feature Card) ──
function renderLimitsTab(p) {
  const lim = p.dailyLimits || { enabled: false, entries: [{ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], duration: '01:00' }] };

  let html = `<div class="fc ${lim.enabled ? 'active' : ''}">
    <div class="fc-header" onclick="toggleLimitsEnabled('${p.id}')">
      <div class="fc-icon"><i class="ph-duotone ph-hourglass-medium"></i></div>
      <div class="fc-info">
        <div class="fc-title">Daily Usage Limits</div>
        <div class="fc-desc">Restrict total daily screen time per day group</div>
      </div>
      <span class="fc-status ${lim.enabled ? 'on' : 'off'}">${lim.enabled ? 'ON' : 'OFF'}</span>
      <div class="fs-switch ${lim.enabled ? 'on' : ''}"><div class="fs-switch-thumb"></div></div>
    </div>`;

  if (lim.enabled) {
    html += `<div class="fc-body"><div class="fc-body-inner">`;
    lim.entries.forEach((entry, idx) => {
      html += `<div class="fc-window-label">Limit ${idx + 1}${lim.entries.length > 1 ? `<button class="btn-remove-window" onclick="removeLimitEntry('${p.id}',${idx})" title="Remove limit"><i class="ph-bold ph-x"></i></button>` : ''}</div>
        <div class="day-selector">
          ${DAYS.map(d => `<button class="day-btn ${entry.days.includes(d.key) ? 'selected' : ''}" onclick="toggleLimitDay('${p.id}',${idx},'${d.key}')">${d.label}</button>`).join('')}
        </div>
        <div class="duration-row">
          <span class="rl-label">Duration</span>
          <div class="duration-stepper">
            <button class="duration-stepper-btn" onclick="stepDuration('${p.id}',${idx},'h',-1)"><i class="ph-bold ph-minus"></i></button>
            <span class="duration-stepper-val">${parseDuration(entry.duration).h}</span>
            <button class="duration-stepper-btn" onclick="stepDuration('${p.id}',${idx},'h',1)"><i class="ph-bold ph-plus"></i></button>
          </div>
          <span class="duration-unit">hr</span>
          <div class="duration-stepper">
            <button class="duration-stepper-btn" onclick="stepDuration('${p.id}',${idx},'m',-15)"><i class="ph-bold ph-minus"></i></button>
            <span class="duration-stepper-val">${parseDuration(entry.duration).m}</span>
            <button class="duration-stepper-btn" onclick="stepDuration('${p.id}',${idx},'m',15)"><i class="ph-bold ph-plus"></i></button>
          </div>
          <span class="duration-unit">min</span>
        </div>`;
    });
    html += `<button class="btn-add" onclick="addLimitEntry('${p.id}')"><i class="ph-bold ph-plus"></i> Add Limit</button>`;
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

function toggleLimitDay(profileId, entryIdx, dayKey) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.dailyLimits) return;
  const entry = p.dailyLimits.entries[entryIdx];
  if (!entry) return;
  const i = entry.days.indexOf(dayKey);
  if (i >= 0) entry.days.splice(i, 1);
  else entry.days.push(dayKey);
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function parseDuration(str) {
  const parts = (str || '01:00').split(':');
  return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
}

function stepDuration(profileId, entryIdx, unit, delta) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.dailyLimits) return;
  const entry = p.dailyLimits.entries[entryIdx];
  if (!entry) return;
  const cur = parseDuration(entry.duration);
  if (unit === 'h') {
    cur.h = Math.max(0, Math.min(23, cur.h + delta));
  } else {
    cur.m = cur.m + delta;
    if (cur.m >= 60) { cur.m = 0; cur.h = Math.min(23, cur.h + 1); }
    if (cur.m < 0) { cur.m = 45; cur.h = Math.max(0, cur.h - 1); }
  }
  // Don't allow 0h 0m
  if (cur.h === 0 && cur.m === 0) cur.m = 15;
  entry.duration = String(cur.h).padStart(2,'0') + ':' + String(cur.m).padStart(2,'0');
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function addLimitEntry(profileId) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.dailyLimits) return;
  p.dailyLimits.entries.push({ days: ['Mon','Tue','Wed','Thu','Fri'], duration: '02:00' });
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function removeLimitEntry(profileId, entryIdx) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.dailyLimits || p.dailyLimits.entries.length <= 1) return;
  p.dailyLimits.entries.splice(entryIdx, 1);
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

// ── Web Tab (Grid Cards) ──
// Card modes: 'block' = Blocked/Allowed, 'enforce' = Enforced/Off, 'feature' = Enabled/Off, 'intercept' = Active/Off
function renderWebTab(p) {
  const w = p.web || {};
  // [key, name, desc, icon, mode]
  const cards = [
    ['blockMalware', 'Malware Protection', 'Block known malware domains', 'ph-duotone ph-bug', 'block'],
    ['safeSearch', 'Safe Search', 'Force safe search on Google, Bing', 'ph-duotone ph-magnifying-glass', 'enforce'],
    ['safeYoutube', 'Safe YouTube', 'Restrict YouTube to safe mode', 'ph-duotone ph-youtube-logo', 'enforce'],
    ['blockWebSearch', 'Block Web Search', 'Prevent use of search engines', 'ph-duotone ph-globe-simple', 'block'],
    ['blockProxies', 'Block Proxies', 'Block proxy and anonymizer sites', 'ph-duotone ph-mask-happy', 'block'],
    ['blockAi', 'Block AI Services', 'ChatGPT, Claude, Gemini, etc.', 'ph-duotone ph-robot', 'block'],
    ['blockAdult', 'Adult Content', 'Block adult and explicit websites', 'ph-duotone ph-eye-slash', 'block'],
    ['blockGambling', 'Gambling', 'Block gambling and betting sites', 'ph-duotone ph-coin', 'block'],
    ['blockAds', 'Block Ads', 'Block advertising networks', 'ph-duotone ph-megaphone-simple', 'block'],
    ['storeHistory', 'Store History', 'Log browsing history for this profile', 'ph-duotone ph-clock-counter-clockwise', 'feature'],
  ];

  let html = `<div class="tab-section-title">Web Content Filtering</div>`;
  html += `<div class="gc-grid">`;
  cards.forEach(([key, name, desc, icon, mode]) => {
    html += renderGridCard(p.id, 'web', key, name, desc, icon, !!w[key], mode);
  });
  html += `</div>`;

  html += `<div class="textarea-label">Always Allow (comma-separated domains)</div>
    <textarea class="fs-textarea" placeholder="e.g. khanacademy.org, wikipedia.org">${(w.alwaysAllow || []).join(', ')}</textarea>`;
  html += `<div class="textarea-label">Always Block (comma-separated domains)</div>
    <textarea class="fs-textarea" placeholder="e.g. tiktok.com, reddit.com">${(w.alwaysBlock || []).join(', ')}</textarea>`;

  return html;
}

// ── Apps Tab (Grid Cards) ──
function renderAppsTab(p) {
  const a = p.apps || {};
  const cards = [
    ['social', 'Social Media', 'TikTok, Instagram, Snapchat, BeReal', 'ph-duotone ph-chats-circle'],
    ['gaming', 'Gaming', 'Roblox, Minecraft, Xbox Cloud, Steam', 'ph-duotone ph-game-controller'],
    ['video', 'Streaming Video', 'YouTube, Netflix, Disney+', 'ph-duotone ph-youtube-logo'],
    ['education', 'Education', 'Khan Academy, Duolingo, Quizlet', 'ph-duotone ph-graduation-cap'],
    ['messaging', 'Messaging', 'WhatsApp, iMessage, Discord, Signal', 'ph-duotone ph-chat-dots'],
    ['creative', 'Creative Tools', 'Procreate, GarageBand, Adobe Express', 'ph-duotone ph-paint-brush'],
    ['p2pMessaging', 'P2P Messaging', 'Briar, Session, Jami, Tox', 'ph-duotone ph-arrows-left-right'],
    ['gameDistribution', 'Game Distribution', 'Steam P2P, Epic Games Launcher', 'ph-duotone ph-download-simple'],
    ['conferencing', 'Conferencing', 'Zoom, Teams, FaceTime', 'ph-duotone ph-video-camera'],
    ['desktopSharing', 'Desktop Sharing', 'RDP, VNC, remote control', 'ph-duotone ph-monitor'],
  ];

  let html = `<div class="tab-section-title">App Category Blocking</div>`;
  html += `<div class="gc-grid">`;
  cards.forEach(([key, name, desc, icon]) => {
    html += renderGridCard(p.id, 'apps', key, name, desc, icon, !!a[key], 'block');
  });
  html += `</div>`;
  return html;
}

// ── Protocols Tab (Grid Cards) ──
function renderProtocolsTab(p) {
  const pr = p.protocols || {};
  // [key, name, desc, icon, mode]
  const cards = [
    ['p2p', 'Peer-to-Peer', 'BitTorrent, decentralized file sharing', 'ph-duotone ph-share-network', 'block'],
    ['vpn', 'VPN Tunneling', 'OpenVPN, WireGuard, IPsec', 'ph-duotone ph-shield-chevron', 'block'],
    ['tor', 'Tor', 'Anonymous routing through Tor', 'ph-duotone ph-detective', 'block'],
    ['ssh', 'SSH / SFTP', 'Terminal access and file transfers', 'ph-duotone ph-terminal-window', 'block'],
    ['interceptDns', 'Intercept DNS', 'Force DNS through Classifi resolvers', 'ph-duotone ph-dns', 'intercept'],
    ['blockSecureDns', 'Block Secure DNS', 'Disable DoH/DoT for filtering', 'ph-duotone ph-lock-simple-open', 'block'],
  ];

  let html = `<div class="tab-section-title">Protocol Blocking</div>`;
  html += `<div class="gc-grid">`;
  cards.forEach(([key, name, desc, icon, mode]) => {
    html += renderGridCard(p.id, 'protocols', key, name, desc, icon, !!pr[key], mode);
  });
  html += `</div>`;
  return html;
}

// ── Shared Grid Card Renderer ──
// mode: 'block' = Blocked/Allowed, 'enforce' = Enforced/Off, 'feature' = Enabled/Off, 'intercept' = Active/Off
function renderGridCard(profileId, section, key, name, desc, icon, isOn, mode) {
  // Determine badge text and CSS class based on mode
  const MODES = {
    block:     { onText: 'Blocked',  offText: 'Allowed', onClass: 'blocked',  offClass: '' },
    enforce:   { onText: 'Enforced', offText: 'Off',     onClass: 'enforced', offClass: '' },
    feature:   { onText: 'Enabled',  offText: 'Off',     onClass: 'enabled',  offClass: '' },
    intercept: { onText: 'Active',   offText: 'Off',     onClass: 'active-on', offClass: '' },
  };
  const m = MODES[mode] || MODES.block;
  const cls = isOn ? m.onClass : m.offClass;
  const badgeText = isOn ? m.onText : m.offText;

  return `
    <div class="gc-card ${cls}" data-profile="${profileId}" data-field="${section}.${key}" onclick="toggleGridCard(this)">
      <div class="gc-top">
        <i class="${icon} gc-icon"></i>
        <span class="gc-badge">${badgeText}</span>
      </div>
      <div class="gc-name">${name}</div>
      <div class="gc-desc">${desc}</div>
    </div>`;
}

function toggleGridCard(el) {
  const pid = el.dataset.profile;
  const field = el.dataset.field;
  const p = allProfiles.find(pr => pr.id === pid);
  if (!p || !field) return;

  const parts = field.split('.');
  if (parts.length === 2) {
    p[parts[0]][parts[1]] = !p[parts[0]][parts[1]];
    FS_DATA.updateProfile(pid, p);
    renderProfileTabContent(p);
  }
}

// ── Devices Tab (Option B: Card Grid with Profile Selector) ──
function renderDevicesTab(p) {
  const profile = p;
  const profileOptions = allProfiles.map(pr => pr.name);

  let html = `<div class="tab-section-title">Device Assignment</div>`;
  html += `<div class="tab-section-desc">Select a profile for each device on the network</div>`;
  html += `<div class="dev-cards-grid">`;

  allDevices.forEach(d => {
    const isMine = d.profile === profile.name;
    const icon = deviceIcon(d.type);
    const stCls = d.status.state === 'Active' ? 'active' : 'blocked';

    html += `
      <div class="dev-card ${isMine ? 'mine' : ''}">
        <div class="dev-card-top">
          <span class="dev-card-icon">${icon}</span>
          <div class="dev-card-info">
            <div class="dev-card-name">${esc(d.name)}</div>
            <div class="dev-card-type">${esc(d.type)}</div>
          </div>
          <span class="dev-card-status ${stCls}">${d.status.state}</span>
        </div>
        <div class="dev-card-mac">${d.mac} &middot; ${d.ip}</div>
        <div class="dev-card-select-wrap">
          <span class="dev-card-label">Profile</span>
          <select class="dev-card-select" data-mac="${d.mac}" onchange="changeDeviceProfile(this)">
            ${profileOptions.map(name =>
              `<option value="${esc(name)}" ${d.profile === name ? 'selected' : ''}>${esc(name)}</option>`
            ).join('')}
            <option value="" ${!d.profile || d.profile === 'Unassigned' ? 'selected' : ''}>Unassigned</option>
          </select>
        </div>
      </div>`;
  });

  html += `</div>`;
  return html;
}

// ── Alerts Tab (Feature Cards: Curfew + Notifications) ──
function renderAlertsTab(p) {
  const curfew = p.curfew || { enabled: false, start: '00:00', end: '06:00' };
  const notif = p.notifications || {
    searchTermEnabled: false, searchTerms: [''],
    siteContentEnabled: false, siteContent: { gambling: false, drugs: false, adult: false, violence: false, selfHarm: false }
  };

  // Curfew Detection card
  let html = `<div class="fc ${curfew.enabled ? 'active' : ''}">
    <div class="fc-header" onclick="toggleAlertCurfew('${p.id}')">
      <div class="fc-icon"><i class="ph-duotone ph-moon-stars"></i></div>
      <div class="fc-info">
        <div class="fc-title">Curfew Detection</div>
        <div class="fc-desc">Notify when devices are used outside curfew hours</div>
      </div>
      <span class="fc-status ${curfew.enabled ? 'on' : 'off'}">${curfew.enabled ? 'ON' : 'OFF'}</span>
      <div class="fs-switch ${curfew.enabled ? 'on' : ''}"><div class="fs-switch-thumb"></div></div>
    </div>`;
  if (curfew.enabled) {
    html += `<div class="fc-body"><div class="fc-body-inner">
      <div class="time-range-row">
        <span class="rl-label">From</span>
        <input type="time" class="fs-input" value="${curfew.start}">
        <span class="time-range-sep">to</span>
        <input type="time" class="fs-input" value="${curfew.end}">
      </div>
    </div></div>`;
  }
  html += `</div>`;

  // Search Term Notifications card
  html += `<div class="fc ${notif.searchTermEnabled ? 'active' : ''}">
    <div class="fc-header" onclick="toggleAlertSearchTerm('${p.id}')">
      <div class="fc-icon"><i class="ph-duotone ph-magnifying-glass"></i></div>
      <div class="fc-info">
        <div class="fc-title">Search Term Alerts</div>
        <div class="fc-desc">Get notified when specific search terms are used</div>
      </div>
      <span class="fc-status ${notif.searchTermEnabled ? 'on' : 'off'}">${notif.searchTermEnabled ? 'ON' : 'OFF'}</span>
      <div class="fs-switch ${notif.searchTermEnabled ? 'on' : ''}"><div class="fs-switch-thumb"></div></div>
    </div>`;
  if (notif.searchTermEnabled) {
    const terms = (notif.searchTerms || []).filter(t => t.trim());
    html += `<div class="fc-body"><div class="fc-body-inner">
      <div class="fc-window-label">Monitored Terms</div>
      <div class="chip-input-wrap" id="searchTermChips">
        ${terms.map((t, i) => `<span class="chip">${esc(t)}<button class="chip-x" onclick="removeSearchTerm('${p.id}',${i})"><i class="ph-bold ph-x"></i></button></span>`).join('')}
        <input class="chip-input" id="searchTermInput" placeholder="${terms.length ? 'Add term...' : 'Type a term and press Enter'}" onkeydown="handleSearchTermKey(event,'${p.id}')">
      </div>
    </div></div>`;
  }
  html += `</div>`;

  // Site Content Notifications card
  html += `<div class="fc ${notif.siteContentEnabled ? 'active' : ''}">
    <div class="fc-header" onclick="toggleAlertSiteContent('${p.id}')">
      <div class="fc-icon"><i class="ph-duotone ph-warning-circle"></i></div>
      <div class="fc-info">
        <div class="fc-title">Content Category Alerts</div>
        <div class="fc-desc">Notify when flagged content categories are accessed</div>
      </div>
      <span class="fc-status ${notif.siteContentEnabled ? 'on' : 'off'}">${notif.siteContentEnabled ? 'ON' : 'OFF'}</span>
      <div class="fs-switch ${notif.siteContentEnabled ? 'on' : ''}"><div class="fs-switch-thumb"></div></div>
    </div>`;
  if (notif.siteContentEnabled) {
    const cats = notif.siteContent || {};
    const catList = [
      ['gambling', 'Gambling', 'ph-duotone ph-coin'],
      ['drugs', 'Drugs & Substances', 'ph-duotone ph-pill'],
      ['adult', 'Adult Content', 'ph-duotone ph-eye-slash'],
      ['violence', 'Violence', 'ph-duotone ph-sword'],
      ['selfHarm', 'Self-Harm', 'ph-duotone ph-heart-break'],
    ];
    html += `<div class="fc-body"><div class="fc-body-inner">
      <div class="fc-window-label">Tap to toggle categories</div>
      <div class="chip-toggle-wrap">
        ${catList.map(([key, label, icon]) => `
          <button class="chip-toggle ${cats[key] ? 'active' : ''}" onclick="toggleAlertCategory('${p.id}','${key}')">
            <i class="${icon}"></i> ${label}
          </button>`).join('')}
      </div>
    </div></div>`;
  }
  html += `</div>`;

  return html;
}

// ═══════════════════════════════════════════════════════
//  MONITOR VIEW
// ═══════════════════════════════════════════════════════

function renderMonitor() {
  renderDevicePicker();
  renderMonitorTimeRange();
  renderMonitorContent();
}

function renderDevicePicker() {
  const container = el('devicePicker');
  const dev = allDevices.find(d => d.mac === selectedDeviceMac);
  if (!dev) {
    container.innerHTML = '<div class="empty-state">No devices</div>';
    return;
  }

  const icon = deviceIcon(dev.type);
  container.innerHTML = `
    <div class="device-picker-btn" onclick="toggleDeviceDropdown()">
      <span class="device-picker-icon">${icon}</span>
      <div>
        <div class="device-picker-name">${esc(dev.name)}</div>
        <div class="device-picker-profile">${esc(dev.profile)}</div>
      </div>
      <i class="ph-bold ph-caret-down device-picker-caret"></i>
    </div>
    <div class="device-picker-dropdown" id="deviceDropdown">
      ${allDevices.map(d => {
        const sel = d.mac === selectedDeviceMac ? 'selected' : '';
        const stCls = d.status.state === 'Active' ? 'active' : 'blocked';
        return `
          <div class="device-option ${sel}" onclick="selectDevice('${d.mac}')">
            <span class="device-option-icon">${deviceIcon(d.type)}</span>
            <div class="device-option-info">
              <div class="device-option-name">${esc(d.name)}</div>
              <div class="device-option-meta">${d.mac} &middot; ${esc(d.profile)}</div>
            </div>
            <span class="device-option-status ${stCls}">${d.status.state}</span>
          </div>`;
      }).join('')}
      <div class="device-profile-reassign">
        Profile: <strong style="margin:0 4px">${esc(dev.profile)}</strong>
        <a onclick="reassignDevice('${dev.mac}')">change</a>
      </div>
    </div>`;
}

function toggleDeviceDropdown() {
  const dd = el('deviceDropdown');
  dd.classList.toggle('open');
  // Close on outside click
  if (dd.classList.contains('open')) {
    setTimeout(() => {
      const handler = (e) => {
        if (!dd.contains(e.target) && !dd.previousElementSibling.contains(e.target)) {
          dd.classList.remove('open');
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 10);
  }
}

function selectDevice(mac) {
  selectedDeviceMac = mac;
  el('deviceDropdown').classList.remove('open');
  renderDevicePicker();
  renderMonitorContent();
}

function reassignDevice(mac) {
  // Navigate to profiles view, devices tab
  const dev = allDevices.find(d => d.mac === mac);
  if (dev) {
    const prof = allProfiles.find(p => p.name === dev.profile);
    if (prof) selectedProfileId = prof.id;
  }
  activeProfileTab = 'devices';
  switchFsView('profiles');
}

function renderMonitorTimeRange() {
  const container = el('monitorTimeRange');
  let ranges;
  if (currentMonitorTab === 'activity') {
    ranges = [
      { label: '1h', value: 60 },
      { label: '1d', value: 1440 },
      { label: '1w', value: 10080 },
    ];
  } else if (currentMonitorTab === 'usage') {
    ranges = [
      { label: '1h', value: '1h' },
      { label: '4h', value: '4h' },
      { label: '1d', value: '1d' },
      { label: '1w', value: '1w' },
      { label: '1m', value: '1m' },
    ];
  } else {
    ranges = [
      { label: '1d', value: 1 },
      { label: '1w', value: 7 },
      { label: '1m', value: 30 },
      { label: '3m', value: 90 },
    ];
  }

  const currentVal = currentTimeRange[currentMonitorTab];
  container.innerHTML = ranges.map(r =>
    `<button class="time-btn ${r.value == currentVal ? 'active' : ''}" onclick="setTimeRange('${currentMonitorTab}','${r.value}')">${r.label}</button>`
  ).join('');
}

function setTimeRange(tab, value) {
  currentTimeRange[tab] = isNaN(value) ? value : Number(value);
  renderMonitorTimeRange();
  renderMonitorContent();
}

async function renderMonitorContent() {
  const container = el('monitorContent');
  if (!selectedDeviceMac) {
    container.innerHTML = '<div class="empty-state">Select a device</div>';
    return;
  }

  container.innerHTML = '<div class="empty-state">Loading...</div>';

  if (currentMonitorTab === 'activity') {
    await renderActivityTable(container);
  } else if (currentMonitorTab === 'usage') {
    await renderUsageView(container);
  } else {
    await renderWebHistoryView(container);
  }
}

// ── Activity Table ──
async function renderActivityTable(container) {
  const data = await FS_DATA.getActivity(selectedDeviceMac, currentTimeRange.activity);

  if (!data.length) {
    container.innerHTML = '<div class="empty-state">No activity for this time range</div>';
    return;
  }

  const allowed = data.filter(e => e.status !== 'Blocked');
  const blocked = data.filter(e => e.status === 'Blocked');
  const filtered = activityFilter === 'allowed' ? allowed : activityFilter === 'blocked' ? blocked : data;

  // Get current device's profile for block actions
  const dev = allDevices.find(d => d.mac === selectedDeviceMac);
  const profileName = dev ? dev.profile : null;

  let html = `<div class="activity-stats-row">
    <div class="wh-stat-card filter-all ${activityFilter === 'all' ? 'active' : ''}" onclick="setActivityFilter('all')">
      <div class="wh-stat-val">${data.length}</div>
      <div class="wh-stat-label">All Activity</div>
    </div>
    <div class="wh-stat-card filter-allowed ${activityFilter === 'allowed' ? 'active' : ''}" onclick="setActivityFilter('allowed')">
      <div class="wh-stat-val" style="color:var(--accent-green)">${allowed.length}</div>
      <div class="wh-stat-label">Allowed</div>
    </div>
    <div class="wh-stat-card filter-blocked ${activityFilter === 'blocked' ? 'active' : ''}" onclick="setActivityFilter('blocked')">
      <div class="wh-stat-val" style="color:var(--accent-red)">${blocked.length}</div>
      <div class="wh-stat-label">Blocked</div>
    </div>
  </div>`;

  if (!filtered.length) {
    html += '<div class="empty-state">No matching activity</div>';
    container.innerHTML = html;
    return;
  }

  html += `<div class="table-wrap"><table class="fs-table">
    <thead><tr>
      <th>Time</th>
      <th>Duration</th>
      <th>Category</th>
      <th>App</th>
      <th>Destination</th>
      <th>Status</th>
      <th class="col-actions">Actions</th>
    </tr></thead><tbody>`;

  filtered.slice(0, 100).forEach(e => {
    const rowCls = e.status === 'Blocked' ? 'row-blocked' : 'row-allowed';
    const statusCls = e.status === 'Blocked' ? 'blocked' : 'allowed';
    const timeStr = formatTimeAgo(e.minutesAgo);
    const durStr = e.duration ? formatDuration(e.duration) : '-';
    const isBlocked = e.status === 'Blocked';

    html += `<tr class="${rowCls}">
      <td class="col-mono">${timeStr}</td>
      <td class="col-mono">${durStr}</td>
      <td>${esc(e.category)}</td>
      <td>${esc(e.application)}</td>
      <td class="col-dest" title="${esc(e.destination)}">${esc(e.destination)}</td>
      <td class="col-status">
        <span class="status-badge ${statusCls}">${e.status}</span>
        ${e.blockReason ? `<span class="block-reason">${esc(e.blockReason)}</span>` : ''}
      </td>
      <td class="col-actions">
        ${isBlocked ? `
          <button class="row-act-pill allow" onclick="quickAllow('${esc(e.destination)}','${profileName}',this)">
            <i class="ph-bold ph-check-circle"></i> Allow
          </button>
        ` : `
          <button class="row-act-pill block" onclick="quickBlock('${esc(e.destination)}','${profileName}',this)">
            <i class="ph-bold ph-prohibit"></i> Block
          </button>
        `}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  if (filtered.length > 100) {
    html += `<div style="text-align:center;padding:8px;color:var(--text-muted);font-size:11px">Showing 100 of ${filtered.length} entries</div>`;
  }
  container.innerHTML = html;
}

// ── Usage View ──
async function renderUsageView(container) {
  const data = await FS_DATA.getUsage(selectedDeviceMac, currentTimeRange.usage);

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">No usage data for this range</div>';
    return;
  }

  // Compute stats
  let totalTime = 0, totalBytes = 0;
  let topCat = { name: '-', time: 0 };
  let allApps = [];

  const CATEGORY_COLORS = {
    Gaming: '#22d3ee', Video: '#a78bfa', Streaming: '#f59e0b',
    SocialNetwork: '#ef4444', Network: '#34d399', System: '#3b82f6', SoftwareUpdate: '#6b7280'
  };
  const catDisplay = (c) => c === 'SocialNetwork' ? 'Social' : c === 'SoftwareUpdate' ? 'Updates' : c;

  data.forEach(cat => {
    totalTime += cat.totalTime;
    totalBytes += cat.totalBytes;
    if (cat.totalTime > topCat.time) topCat = { name: cat.category, time: cat.totalTime };
    cat.applications.forEach(app => allApps.push({ ...app, category: cat.category }));
  });

  allApps.sort((a, b) => b.timeMinutes - a.timeMinutes);
  const topApps = allApps.slice(0, 5);
  const maxTime = Math.max(...data.map(d => d.totalTime), 1);

  let html = `<div class="usage-stats-row">
    <div class="usage-stat-card"><div class="usage-stat-val">${formatDuration(totalTime)}</div><div class="usage-stat-label">Total Time</div></div>
    <div class="usage-stat-card"><div class="usage-stat-val">${formatBytes(totalBytes)}</div><div class="usage-stat-label">Data Used</div></div>
    <div class="usage-stat-card"><div class="usage-stat-val">${catDisplay(topCat.name)}</div><div class="usage-stat-label">Top Category</div></div>
  </div>`;

  html += `<div class="usage-charts-row">
    <div class="usage-bar-chart">
      <div class="card-label">Usage by Category</div>
      ${data.map(cat => {
        const pct = (cat.totalTime / maxTime) * 100;
        const color = CATEGORY_COLORS[cat.category] || '#6b7280';
        return `<div class="usage-bar-row">
          <span class="usage-bar-name">${catDisplay(cat.category)}</span>
          <div class="usage-bar-track"><div class="usage-bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <span class="usage-bar-val">${formatDuration(cat.totalTime)}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="usage-top-apps">
      <div class="card-label">Top Applications</div>
      ${topApps.map(app => {
        const color = CATEGORY_COLORS[app.category] || '#6b7280';
        return `<div class="top-app-item">
          <span class="top-app-dot" style="background:${color}"></span>
          <span class="top-app-name">${esc(app.name)}</span>
          <span class="top-app-time">${formatDuration(app.timeMinutes)}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;

  container.innerHTML = html;
}

// ── Web History View ──
async function renderWebHistoryView(container) {
  const data = await FS_DATA.getWebHistory(selectedDeviceMac, currentTimeRange.webhistory);

  if (!data || !data.length) {
    container.innerHTML = '<div class="empty-state">No web history for this range</div>';
    return;
  }

  const allowed = data.filter(e => e.status === 'Allowed');
  const blocked = data.filter(e => e.status === 'Blocked');
  const filtered = webHistoryFilter === 'allowed' ? allowed : webHistoryFilter === 'blocked' ? blocked : data;

  let html = `<div class="webhistory-stats-row">
    <div class="wh-stat-card filter-all ${webHistoryFilter === 'all' ? 'active' : ''}" onclick="setWhFilter('all')">
      <div class="wh-stat-val">${data.length}</div>
      <div class="wh-stat-label">Total Sites</div>
    </div>
    <div class="wh-stat-card filter-allowed ${webHistoryFilter === 'allowed' ? 'active' : ''}" onclick="setWhFilter('allowed')">
      <div class="wh-stat-val" style="color:var(--accent-green)">${allowed.length}</div>
      <div class="wh-stat-label">Allowed</div>
    </div>
    <div class="wh-stat-card filter-blocked ${webHistoryFilter === 'blocked' ? 'active' : ''}" onclick="setWhFilter('blocked')">
      <div class="wh-stat-val" style="color:var(--accent-red)">${blocked.length}</div>
      <div class="wh-stat-label">Blocked</div>
    </div>
  </div>`;

  const whDev = allDevices.find(d => d.mac === selectedDeviceMac);
  const whProfile = whDev ? whDev.profile : null;

  html += `<div class="table-wrap"><table class="fs-table">
    <thead><tr>
      <th>Time</th>
      <th>Site</th>
      <th>Title</th>
      <th>Status</th>
      <th class="col-actions">Actions</th>
    </tr></thead><tbody>`;

  filtered.slice(0, 100).forEach(e => {
    const rowCls = e.status === 'Blocked' ? 'row-blocked' : 'row-allowed';
    const statusCls = e.status === 'Blocked' ? 'blocked' : 'allowed';
    const time = new Date(e.timestamp).toLocaleString();
    const isBlocked = e.status === 'Blocked';
    html += `<tr class="${rowCls}">
      <td class="col-mono" style="font-size:10px">${time}</td>
      <td class="col-dest" title="${esc(e.site)}">${esc(e.site)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(e.title)}</td>
      <td class="col-status">
        <span class="status-badge ${statusCls}">${e.status}</span>
        ${e.blockReason ? `<span class="block-reason">${esc(e.blockReason)}</span>` : ''}
      </td>
      <td class="col-actions">
        ${isBlocked ? `
          <button class="row-act-pill allow" onclick="quickAllow('${esc(e.site)}','${whProfile}',this)">
            <i class="ph-bold ph-check-circle"></i> Allow
          </button>
        ` : `
          <button class="row-act-pill block" onclick="quickBlock('${esc(e.site)}','${whProfile}',this)">
            <i class="ph-bold ph-prohibit"></i> Block
          </button>
        `}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function setWhFilter(filter) {
  webHistoryFilter = filter;
  renderMonitorContent();
}

function setActivityFilter(filter) {
  activityFilter = filter;
  renderMonitorContent();
}

// ── Quick Block/Allow from Monitor ──
function quickBlock(domain, profileName, btn) {
  const profile = allProfiles.find(p => p.name === profileName);
  if (!profile) { showToast('No profile found for this device', 'warn'); return; }
  if (!profile.web) profile.web = {};
  if (!profile.web.alwaysBlock) profile.web.alwaysBlock = [];
  if (!profile.web.alwaysBlock.includes(domain)) {
    profile.web.alwaysBlock.push(domain);
  }
  // Remove from allow list if present
  if (profile.web.alwaysAllow) {
    profile.web.alwaysAllow = profile.web.alwaysAllow.filter(d => d !== domain);
  }
  FS_DATA.updateProfile(profile.id, profile);
  showToast(`Blocked ${domain} on ${profileName}`, 'block');
  // Update row in-place
  if (btn) updateRowStatus(btn, 'blocked', domain, profileName);
}

function quickAllow(domain, profileName, btn) {
  const profile = allProfiles.find(p => p.name === profileName);
  if (!profile) { showToast('No profile found for this device', 'warn'); return; }
  if (!profile.web) profile.web = {};
  if (!profile.web.alwaysAllow) profile.web.alwaysAllow = [];
  if (!profile.web.alwaysAllow.includes(domain)) {
    profile.web.alwaysAllow.push(domain);
  }
  // Remove from block list if present
  if (profile.web.alwaysBlock) {
    profile.web.alwaysBlock = profile.web.alwaysBlock.filter(d => d !== domain);
  }
  FS_DATA.updateProfile(profile.id, profile);
  showToast(`Allowed ${domain} on ${profileName}`, 'allow');
  // Update row in-place
  if (btn) updateRowStatus(btn, 'allowed', domain, profileName);
}

function updateRowStatus(btn, newStatus, domain, profileName) {
  const tr = btn.closest('tr');
  if (!tr) return;
  const esc = s => s.replace(/'/g, "\\'");

  // Update row class
  tr.classList.remove('row-allowed', 'row-blocked');
  tr.classList.add(newStatus === 'allowed' ? 'row-allowed' : 'row-blocked');

  // Update status badge
  const statusTd = tr.querySelector('.col-status');
  if (statusTd) {
    const badge = statusTd.querySelector('.status-badge');
    const reason = statusTd.querySelector('.block-reason');
    if (badge) {
      badge.className = 'status-badge ' + (newStatus === 'allowed' ? 'allowed' : 'blocked');
      badge.textContent = newStatus === 'allowed' ? 'ALLOWED' : 'BLOCKED';
    }
    if (reason) {
      reason.textContent = newStatus === 'allowed' ? '' : 'User Override';
    }
  }

  // Swap the action pill
  const actionTd = tr.querySelector('.col-actions');
  if (actionTd) {
    if (newStatus === 'allowed') {
      actionTd.innerHTML = `<button class="row-act-pill block" onclick="quickBlock('${esc(domain)}','${esc(profileName)}',this)">
        <i class="ph-bold ph-prohibit"></i> Block</button>`;
    } else {
      actionTd.innerHTML = `<button class="row-act-pill allow" onclick="quickAllow('${esc(domain)}','${esc(profileName)}',this)">
        <i class="ph-bold ph-check-circle"></i> Allow</button>`;
    }
  }
}

function quickBlockCategory(category, profileName) {
  const profile = allProfiles.find(p => p.name === profileName);
  if (!profile) { showToast('No profile found for this device', 'warn'); return; }
  // Map common flow categories to app block keys
  const catMap = { Gaming: 'gaming', Video: 'video', Streaming: 'video', SocialNetwork: 'social', Social: 'social' };
  const appKey = catMap[category];
  if (appKey && profile.apps) {
    profile.apps[appKey] = true; // true = blocked
    FS_DATA.updateProfile(profile.id, profile);
    showToast(`Blocked ${category} category on ${profileName}`, 'block');
  } else {
    showToast(`Added ${category} to block list on ${profileName}`, 'block');
  }
  renderMonitorContent();
}

function showToast(message, type) {
  // Remove existing toast
  const old = document.getElementById('fsToast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'fsToast';
  toast.className = 'fs-toast ' + (type || '');
  const iconMap = { block: 'ph-prohibit', allow: 'ph-check-circle', warn: 'ph-warning' };
  const icon = iconMap[type] || 'ph-info';
  toast.innerHTML = `<i class="ph-bold ${icon}"></i> ${message}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════════

function toggleProfileStatus(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (p) {
    p.status = p.status === 'Active' ? 'Paused' : 'Active';
    FS_DATA.updateProfile(id, p);
    renderProfileEditor();
    renderProfileStrip();
  }
}

function toggleScheduleEnabled(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (p && p.schedule) {
    p.schedule.enabled = !p.schedule.enabled;
    FS_DATA.updateProfile(id, p);
    renderProfileTabContent(p);
  }
}

function toggleLimitsEnabled(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (p && p.dailyLimits) {
    p.dailyLimits.enabled = !p.dailyLimits.enabled;
    FS_DATA.updateProfile(id, p);
    renderProfileTabContent(p);
  }
}

function toggleAlertCurfew(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (!p) return;
  if (!p.curfew) p.curfew = { enabled: false, start: '00:00', end: '06:00' };
  p.curfew.enabled = !p.curfew.enabled;
  FS_DATA.updateProfile(id, p);
  renderProfileTabContent(p);
}

function toggleAlertSearchTerm(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (!p) return;
  if (!p.notifications) p.notifications = { searchTermEnabled: false, searchTerms: [], siteContentEnabled: false, siteContent: {} };
  p.notifications.searchTermEnabled = !p.notifications.searchTermEnabled;
  FS_DATA.updateProfile(id, p);
  renderProfileTabContent(p);
}

function toggleAlertSiteContent(id) {
  const p = allProfiles.find(pr => pr.id === id);
  if (!p) return;
  if (!p.notifications) p.notifications = { searchTermEnabled: false, searchTerms: [], siteContentEnabled: false, siteContent: {} };
  p.notifications.siteContentEnabled = !p.notifications.siteContentEnabled;
  FS_DATA.updateProfile(id, p);
  renderProfileTabContent(p);
}

function handleSearchTermKey(e, profileId) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const input = e.target;
    const term = input.value.replace(/,/g, '').trim();
    if (!term) return;
    const p = allProfiles.find(pr => pr.id === profileId);
    if (!p || !p.notifications) return;
    if (!p.notifications.searchTerms) p.notifications.searchTerms = [];
    if (!p.notifications.searchTerms.includes(term)) {
      p.notifications.searchTerms.push(term);
      FS_DATA.updateProfile(profileId, p);
      renderProfileTabContent(p);
      // Re-focus the input after re-render
      setTimeout(() => { const inp = document.getElementById('searchTermInput'); if (inp) inp.focus(); }, 50);
    } else {
      input.value = '';
    }
  }
  if (e.key === 'Backspace' && e.target.value === '') {
    const p = allProfiles.find(pr => pr.id === profileId);
    if (!p || !p.notifications || !p.notifications.searchTerms || !p.notifications.searchTerms.length) return;
    p.notifications.searchTerms.pop();
    FS_DATA.updateProfile(profileId, p);
    renderProfileTabContent(p);
    setTimeout(() => { const inp = document.getElementById('searchTermInput'); if (inp) inp.focus(); }, 50);
  }
}

function removeSearchTerm(profileId, idx) {
  const p = allProfiles.find(pr => pr.id === profileId);
  if (!p || !p.notifications || !p.notifications.searchTerms) return;
  p.notifications.searchTerms.splice(idx, 1);
  FS_DATA.updateProfile(profileId, p);
  renderProfileTabContent(p);
}

function toggleAlertCategory(id, key) {
  const p = allProfiles.find(pr => pr.id === id);
  if (!p || !p.notifications || !p.notifications.siteContent) return;
  p.notifications.siteContent[key] = !p.notifications.siteContent[key];
  FS_DATA.updateProfile(id, p);
  renderProfileTabContent(p);
}

function toggleProfileField(el) {
  const pid = el.dataset.profile;
  const field = el.dataset.field;
  const p = allProfiles.find(pr => pr.id === pid);
  if (!p || !field) return;

  const parts = field.split('.');
  if (parts.length === 2) {
    p[parts[0]][parts[1]] = !p[parts[0]][parts[1]];
    el.classList.toggle('on');
    FS_DATA.updateProfile(pid, p);
  }
}

function changeDeviceProfile(selectEl) {
  const mac = selectEl.dataset.mac;
  const newProfile = selectEl.value;
  const dev = allDevices.find(d => d.mac === mac);
  if (!dev) return;

  dev.profile = newProfile || 'Unassigned';
  FS_DATA.assignDevice(mac, dev.profile);

  // Re-render the devices tab to update .mine highlights
  const profile = allProfiles.find(p => p.id === selectedProfileId);
  if (profile) {
    const c = document.getElementById('profile-tab-content');
    if (c) c.innerHTML = renderDevicesTab(profile);
  }
}

function addProfile() {
  const name = prompt('Profile name:');
  if (!name) return;
  const ageGroup = prompt('Age group (elementary, middleSchool, highSchool, adult):') || 'adult';
  const preset = FS_DATA.getAgePreset(ageGroup);

  const newProfile = {
    id: 'profile-' + Date.now(),
    name: name,
    status: 'Active',
    notes: '',
    groups: [],
    schedule: { enabled: false, windows: [{ start: '15:00', end: '17:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] }] },
    dailyLimits: { enabled: false, entries: [{ days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], duration: '01:00' }] },
    web: preset ? preset.web : { blockMalware: true, blockAds: true },
    apps: preset ? preset.apps : {},
    protocols: preset ? preset.protocols : {},
  };

  allProfiles.push(newProfile);
  selectedProfileId = newProfile.id;
  renderProfiles();
}

function deleteCurrentProfile() {
  if (allProfiles.length <= 1) return;
  const idx = allProfiles.findIndex(p => p.id === selectedProfileId);
  if (idx >= 0) {
    FS_DATA.deleteProfile(allProfiles[idx].id);
    allProfiles.splice(idx, 1);
    selectedProfileId = allProfiles[0].id;
    renderProfiles();
  }
}

// ═══════════════════════════════════════════════════════
//  SWITCH HELPERS
// ═══════════════════════════════════════════════════════

function setSwitch(id, on) {
  const sw = el(id);
  if (sw) sw.classList.toggle('on', !!on);
}

function bindSwitch(id, callback) {
  const sw = el(id);
  if (!sw) return;
  // Remove old listeners by cloning
  const newSw = sw.cloneNode(true);
  sw.parentNode.replaceChild(newSw, sw);
  newSw.id = id;
  newSw.addEventListener('click', () => {
    const isOn = !newSw.classList.contains('on');
    newSw.classList.toggle('on', isOn);
    callback(isOn);
  });
}

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════

function isDarkTheme() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatTimeAgo(minutes) {
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h ago';
  return Math.floor(minutes / 1440) + 'd ago';
}

function formatDuration(minutes) {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return Math.round(minutes) + 'm';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

function deviceIcon(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('xbox') || t.includes('playstation') || t.includes('console') || t.includes('game')) return '<i class="ph-duotone ph-game-controller" style="color:var(--accent-purple)"></i>';
  if (t.includes('laptop')) return '<i class="ph-duotone ph-laptop" style="color:var(--accent-cyan)"></i>';
  if (t.includes('phone') || t.includes('smartphone')) return '<i class="ph-duotone ph-device-mobile" style="color:var(--accent-green)"></i>';
  if (t.includes('ipad') || t.includes('tablet')) return '<i class="ph-duotone ph-device-tablet-speaker" style="color:var(--accent-amber)"></i>';
  if (t.includes('tv') || t.includes('smart tv')) return '<i class="ph-duotone ph-television" style="color:var(--accent-blue)"></i>';
  if (t.includes('pc') || t.includes('desktop') || t.includes('windows')) return '<i class="ph-duotone ph-desktop" style="color:var(--accent-cyan)"></i>';
  return '<i class="ph-duotone ph-desktop" style="color:var(--accent-grey)"></i>';
}
