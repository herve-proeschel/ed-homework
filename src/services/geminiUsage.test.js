import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearGeminiUsage,
  clearQuotaLock,
  formatTimeDisplay,
  getGeminiUsageStats,
  getQuotaUnlockInfo,
  recordGeminiRequest,
  recordQuotaExceeded,
} from './geminiUsage';

describe('geminiUsage tracking and quota management', () => {
  const store = new Map();

  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    };
  });

  it('records requests and computes usage stats for minute and day', () => {
    const baseNow = new Date('2026-10-11T14:30:00Z').getTime();

    // 2 requests 30s and 10s ago
    recordGeminiRequest(baseNow - 30 * 1000);
    recordGeminiRequest(baseNow - 10 * 1000);

    // 1 request 2 hours ago (still today)
    recordGeminiRequest(baseNow - 2 * 60 * 60 * 1000);

    const stats = getGeminiUsageStats(baseNow);
    expect(stats.requestsLastMinute).toBe(2);
    expect(stats.requestsToday).toBe(3);
    expect(stats.indicativeRpmLimit).toBe(15);
    expect(stats.indicativeRpdLimit).toBe(1500);
    expect(stats.estimatedResetSeconds).toBe(30); // 60s - 30s
  });

  it('records quota lock and returns remaining cooldown seconds', () => {
    const baseNow = 1000000;
    recordQuotaExceeded(45, baseNow);

    const info = getQuotaUnlockInfo(baseNow);
    expect(info.isLocked).toBe(true);
    expect(info.unlockAt).toBe(baseNow + 45 * 1000);
    expect(info.secondsRemaining).toBe(45);

    // After 20 seconds
    const info20sLater = getQuotaUnlockInfo(baseNow + 20 * 1000);
    expect(info20sLater.isLocked).toBe(true);
    expect(info20sLater.secondsRemaining).toBe(25);

    // After 46 seconds (expired)
    const infoAfter = getQuotaUnlockInfo(baseNow + 46 * 1000);
    expect(infoAfter.isLocked).toBe(false);
    expect(infoAfter.secondsRemaining).toBe(0);
  });

  it('clears quota lock and usage history', () => {
    recordGeminiRequest();
    recordQuotaExceeded(60);

    clearQuotaLock();
    expect(getQuotaUnlockInfo().isLocked).toBe(false);

    clearGeminiUsage();
    expect(getGeminiUsageStats().requestsToday).toBe(0);
  });

  it('formats time display cleanly', () => {
    const timestamp = new Date('2026-10-11T15:04:05').getTime();
    const formatted = formatTimeDisplay(timestamp);
    expect(formatted).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

