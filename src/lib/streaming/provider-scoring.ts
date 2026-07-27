const STORAGE_KEY = 'streamium_provider_scores';

interface ProviderScore {
  successCount: number;
  failCount: number;
  totalLatency: number;
  lastTested: number;
}

type ProviderScores = Record<string, ProviderScore>;

function loadScores(): ProviderScores {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveScores(scores: ProviderScores) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch { /* noop */ }
}

export const providerScoring = {
  recordSuccess(providerId: string, latencyMs: number) {
    const scores = loadScores();
    const entry = scores[providerId] || { successCount: 0, failCount: 0, totalLatency: 0, lastTested: 0 };
    entry.successCount++;
    entry.totalLatency += latencyMs;
    entry.lastTested = Date.now();
    scores[providerId] = entry;
    saveScores(scores);
  },

  recordFailure(providerId: string) {
    const scores = loadScores();
    const entry = scores[providerId] || { successCount: 0, failCount: 0, totalLatency: 0, lastTested: 0 };
    entry.failCount++;
    entry.lastTested = Date.now();
    scores[providerId] = entry;
    saveScores(scores);
  },

  getScore(providerId: string): number {
    const scores = loadScores();
    const entry = scores[providerId];
    if (!entry) return 0.5;
    const total = entry.successCount + entry.failCount;
    if (total === 0) return 0.5;
    const successRate = entry.successCount / total;
    const avgLatency = entry.totalLatency / entry.successCount || 3000;
    const latencyFactor = Math.max(0, 1 - avgLatency / 10000);
    return Math.round((successRate * 0.7 + latencyFactor * 0.3) * 100) / 100;
  },

  getOrderedProviders(providerIds: string[]): string[] {
    return [...providerIds].sort((a, b) => {
      return providerScoring.getScore(b) - providerScoring.getScore(a);
    });
  },

  getAllScores(): { providerId: string; score: number; successes: number; failures: number }[] {
    const scores = loadScores();
    return Object.entries(scores).map(([providerId, s]) => ({
      providerId,
      score: providerScoring.getScore(providerId),
      successes: s.successCount,
      failures: s.failCount
    }));
  }
};
