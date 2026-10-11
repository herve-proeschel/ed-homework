export const GEMINI_USAGE_STORAGE_KEY = 'ed_gemini_usage_records';
export const GEMINI_QUOTA_UNLOCK_KEY = 'ed_gemini_quota_unlock_at';

export const INDICATIVE_RPM_LIMIT = 15;
export const INDICATIVE_RPD_LIMIT = 1500;

function getStoredRecords() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(GEMINI_USAGE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredRecords(records) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GEMINI_USAGE_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // ignore local storage errors
  }
}

export function recordGeminiRequest(timestamp = Date.now()) {
  const records = getStoredRecords();
  // Garder seulement les enregistrements des 7 derniers jours
  const cutoff = timestamp - 7 * 24 * 60 * 60 * 1000;
  const filtered = records.filter((t) => typeof t === 'number' && t >= cutoff);
  filtered.push(timestamp);
  saveStoredRecords(filtered);
  return filtered;
}

export function recordQuotaExceeded(retryDelaySeconds = 60, now = Date.now()) {
  const delaySec = Math.max(1, Number(retryDelaySeconds) || 60);
  const unlockAt = now + delaySec * 1000;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GEMINI_QUOTA_UNLOCK_KEY, String(unlockAt));
    }
  } catch {
    // ignore
  }
  return unlockAt;
}

export function getQuotaUnlockInfo(now = Date.now()) {
  try {
    if (typeof localStorage === 'undefined') {
      return { isLocked: false, unlockAt: null, secondsRemaining: 0 };
    }
    const raw = localStorage.getItem(GEMINI_QUOTA_UNLOCK_KEY);
    if (!raw) {
      return { isLocked: false, unlockAt: null, secondsRemaining: 0 };
    }
    const unlockAt = Number(raw);
    if (!unlockAt || isNaN(unlockAt)) {
      return { isLocked: false, unlockAt: null, secondsRemaining: 0 };
    }
    const diffMs = unlockAt - now;
    if (diffMs <= 0) {
      return { isLocked: false, unlockAt, secondsRemaining: 0 };
    }
    return {
      isLocked: true,
      unlockAt,
      secondsRemaining: Math.ceil(diffMs / 1000),
    };
  } catch {
    return { isLocked: false, unlockAt: null, secondsRemaining: 0 };
  }
}

export function clearQuotaLock() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GEMINI_QUOTA_UNLOCK_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearGeminiUsage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GEMINI_USAGE_STORAGE_KEY);
      localStorage.removeItem(GEMINI_QUOTA_UNLOCK_KEY);
    }
  } catch {
    // ignore
  }
}

export function getGeminiUsageStats(now = Date.now()) {
  const records = getStoredRecords();
  const oneMinuteAgo = now - 60 * 1000;

  // Calcul du début de la journée locale
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const requestsLastMinute = records.filter((t) => t >= oneMinuteAgo && t <= now).length;
  const requestsToday = records.filter((t) => t >= startOfDayMs && t <= now).length;

  const recordsInLastMinute = records.filter((t) => t >= oneMinuteAgo && t <= now).sort((a, b) => a - b);
  let estimatedResetSeconds = 0;
  if (requestsLastMinute > 0) {
    const oldest = recordsInLastMinute[0];
    estimatedResetSeconds = Math.max(1, Math.ceil((oldest + 60 * 1000 - now) / 1000));
  }

  const unlockInfo = getQuotaUnlockInfo(now);

  return {
    requestsLastMinute,
    requestsToday,
    indicativeRpmLimit: INDICATIVE_RPM_LIMIT,
    indicativeRpdLimit: INDICATIVE_RPD_LIMIT,
    estimatedResetSeconds,
    isQuotaLocked: unlockInfo.isLocked,
    unlockAt: unlockInfo.unlockAt,
    secondsRemaining: unlockInfo.secondsRemaining,
  };
}

export function formatTimeDisplay(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

