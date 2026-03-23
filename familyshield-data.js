/* ═══════════════════════════════════════════════════════
   Family Shield — Data Abstraction Layer
   ═══════════════════════════════════════════════════════
   Each function returns a Promise resolving to mock data.
   PRODUCTION: Replace fetch() with $rpc.juci.familyshield.*()
   Backend: Gryphon LCM (SDG-3048, SOL-1359)
   ═══════════════════════════════════════════════════════ */

const FS_DATA = (() => {

  const BASE = 'mock/';

  async function jsonFetch(url) {
    const r = await fetch(BASE + url);
    if (!r.ok) throw new Error('Failed: ' + url);
    return r.json();
  }

  // ── Profiles ──
  // PRODUCTION: $rpc.juci.familyshield.profiles.list()
  async function getProfiles() {
    return jsonFetch('profiles.json');
  }

  // PRODUCTION: $rpc.juci.familyshield.profiles.get({ id })
  async function getProfile(id) {
    const all = await getProfiles();
    return all.find(p => p.id === id) || null;
  }

  // PRODUCTION: $rpc.juci.familyshield.profiles.create({ data })
  async function createProfile(data) {
    // Mock: return data with generated ID
    return { ...data, id: 'profile-' + Date.now() };
  }

  // PRODUCTION: $rpc.juci.familyshield.profiles.update({ id, data })
  async function updateProfile(id, data) {
    console.log('[FS_DATA] updateProfile', id, data);
  }

  // PRODUCTION: $rpc.juci.familyshield.profiles.delete({ id })
  async function deleteProfile(id) {
    console.log('[FS_DATA] deleteProfile', id);
  }

  // ── Devices ──
  // PRODUCTION: $rpc.juci.familyshield.devices.list()
  async function getDevices() {
    return jsonFetch('devices.json');
  }

  // PRODUCTION: $rpc.juci.familyshield.devices.assign({ mac, profileId })
  async function assignDevice(mac, profileId) {
    console.log('[FS_DATA] assignDevice', mac, profileId);
  }

  // PRODUCTION: $rpc.juci.familyshield.devices.block({ mac, duration })
  // duration: 900 (15m), 1800 (30m), 3600 (1h), 86400 (all day)
  async function blockDevice(mac, duration) {
    console.log('[FS_DATA] blockDevice', mac, duration);
  }

  // PRODUCTION: $rpc.juci.familyshield.devices.unblock({ mac })
  async function unblockDevice(mac) {
    console.log('[FS_DATA] unblockDevice', mac);
  }

  // ── Activity ──
  // PRODUCTION: $rpc.juci.familyshield.activity.get({ mac, minutes })
  // ALT (FlowSight): $rpc.flowstatd.flows({ mac }) for real-time
  async function getActivity(mac, minutes) {
    const safeMac = mac.replace(/:/g, '-');
    try {
      const data = await jsonFetch('activity-' + safeMac + '.json');
      if (minutes) {
        return data.filter(e => e.minutesAgo <= minutes);
      }
      return data;
    } catch (e) {
      return [];
    }
  }

  // ── Usage ──
  // PRODUCTION: $rpc.juci.familyshield.usage.get({ mac, range })
  async function getUsage(mac, range) {
    const safeMac = mac.replace(/:/g, '-');
    try {
      const data = await jsonFetch('usage-' + safeMac + '.json');
      if (range && data.ranges && data.ranges[range]) {
        return data.ranges[range];
      }
      return data.ranges ? data.ranges['1d'] : [];
    } catch (e) {
      return [];
    }
  }

  // ── Web History ──
  // PRODUCTION: $rpc.juci.familyshield.webhistory.get({ mac, days })
  async function getWebHistory(mac, days) {
    const safeMac = mac.replace(/:/g, '-');
    try {
      const data = await jsonFetch('web-history-' + safeMac + '.json');
      if (days) {
        const cutoff = Date.now() - days * 86400000;
        return data.filter(e => new Date(e.timestamp).getTime() >= cutoff);
      }
      return data;
    } catch (e) {
      return [];
    }
  }

  // ── Global Settings ──
  // PRODUCTION: $rpc.juci.familyshield.settings.get()
  async function getGlobalSettings() {
    return jsonFetch('family-shield.json');
  }

  // PRODUCTION: $rpc.juci.familyshield.settings.set({ data })
  async function updateGlobalSettings(data) {
    console.log('[FS_DATA] updateGlobalSettings', data);
  }

  // ── Dashboard Summary ──
  // PRODUCTION: $rpc.juci.familyshield.dashboard.summary()
  // Aggregated from multiple sources
  async function getDashboardSummary() {
    const [profiles, devices] = await Promise.all([getProfiles(), getDevices()]);

    // Count blocked today from first device activity (mock approximation)
    let blockedToday = 0;
    let topCategories = {};
    let topDomains = {};
    try {
      const activity = await getActivity(devices[0].mac, 1440);
      activity.forEach(e => {
        if (e.status === 'Blocked') {
          blockedToday++;
          topCategories[e.category] = (topCategories[e.category] || 0) + 1;
          topDomains[e.destination] = (topDomains[e.destination] || 0) + 1;
        }
      });
    } catch (e) {}

    const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);

    return {
      profileCount: profiles.length,
      deviceCount: devices.length,
      blockedToday,
      topBlockedCategories: sortObj(topCategories).slice(0, 8),
      topBlockedDomains: sortObj(topDomains).slice(0, 8),
      profiles: [
        ...profiles.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          deviceCount: devices.filter(d => d.profile === p.name).length,
        })),
        { id: 'profile-guest', name: 'Guest', status: 'Active', deviceCount: 0 },
        { id: 'profile-iot', name: 'IoT Devices', status: 'Active', deviceCount: 3 },
        { id: 'profile-work', name: 'Work', status: 'Paused', deviceCount: 1 },
      ],
      alerts: [
        { type: 'warn', text: 'Enzo reached daily limit', time: '2h ago' },
        { type: 'critical', text: 'Adult content access blocked', time: '3h ago' },
        { type: 'info', text: 'Zeke schedule block started', time: '4h ago' },
        { type: 'warn', text: 'Minecraft exceeded 2hr session', time: '5h ago' },
        { type: 'critical', text: 'VPN tunnel attempt blocked', time: '6h ago' },
        { type: 'info', text: 'Elliot profile paused by parent', time: '8h ago' },
        { type: 'warn', text: 'Search term alert: "proxy site"', time: '12h ago' },
        { type: 'info', text: 'New device joined network', time: '1d ago' },
        { type: 'info', text: 'IoT device firmware updated', time: '1d ago' },
        { type: 'warn', text: 'Zeke exceeded bandwidth limit', time: '2d ago' },
      ],
    };
  }

  // ── Age Group Presets ──
  const AGE_PRESETS = {
    elementary: {
      web: { blockMalware:true, safeSearch:true, safeYoutube:true, blockWebSearch:true, blockProxies:true, blockAi:true, blockAdult:true, blockGambling:true, blockAds:true, storeHistory:true },
      apps: { social:true, gaming:true, messaging:true, creative:true, p2pMessaging:true, gameDistribution:true, conferencing:true, desktopSharing:true, video:false, education:false },
      protocols: { p2p:true, vpn:true, tor:true, ssh:true, interceptDns:true, blockSecureDns:true },
    },
    middleSchool: {
      web: { blockMalware:true, safeSearch:true, safeYoutube:true, blockWebSearch:false, blockProxies:true, blockAi:false, blockAdult:true, blockGambling:true, blockAds:true, storeHistory:true },
      apps: { social:true, gaming:false, messaging:true, creative:false, p2pMessaging:true, gameDistribution:false, conferencing:false, desktopSharing:false, video:false, education:false },
      protocols: { p2p:true, vpn:true, tor:true, ssh:true, interceptDns:true, blockSecureDns:true },
    },
    highSchool: {
      web: { blockMalware:true, safeSearch:false, safeYoutube:false, blockWebSearch:false, blockProxies:false, blockAi:false, blockAdult:true, blockGambling:true, blockAds:true, storeHistory:true },
      apps: { social:false, gaming:false, messaging:false, creative:false, p2pMessaging:false, gameDistribution:false, conferencing:false, desktopSharing:false, video:false, education:false },
      protocols: { p2p:true, vpn:true, tor:true, ssh:true, interceptDns:true, blockSecureDns:true },
    },
    adult: {
      web: { blockMalware:true, safeSearch:false, safeYoutube:false, blockWebSearch:false, blockProxies:false, blockAi:false, blockAdult:false, blockGambling:false, blockAds:true, storeHistory:false },
      apps: { social:false, gaming:false, messaging:false, creative:false, p2pMessaging:false, gameDistribution:false, conferencing:false, desktopSharing:false, video:false, education:false },
      protocols: { p2p:false, vpn:false, tor:false, ssh:false, interceptDns:false, blockSecureDns:false },
    },
  };

  function getAgePreset(key) { return AGE_PRESETS[key] || null; }

  // Public API
  return {
    getProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    getDevices,
    assignDevice,
    blockDevice,
    unblockDevice,
    getActivity,
    getUsage,
    getWebHistory,
    getGlobalSettings,
    updateGlobalSettings,
    getDashboardSummary,
    getAgePreset,
  };

})();
