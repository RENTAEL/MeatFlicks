const STORAGE_KEY = 'streamium-provider-settings';

export interface ProviderSettings {
  providerOrder: string[];
  disabledProviders: string[];
  autoSelect: boolean;
}

const defaults: ProviderSettings = {
  providerOrder: ['vidsrc', 'streamsrc', '2embed.skin', 'vidlink', '2embed', 'superembed', 'autoembed', 'multiembed'],
  disabledProviders: [],
  autoSelect: true,
};

function load(): ProviderSettings {
  if (typeof localStorage === 'undefined') return { ...defaults };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    const merged = { ...defaults, ...parsed };
    if (defaults.providerOrder.some(id => !merged.providerOrder.includes(id))) {
      const existing = new Set(merged.providerOrder);
      const newProviders = defaults.providerOrder.filter(id => !existing.has(id));
      merged.providerOrder = [...merged.providerOrder, ...newProviders];
    }
    return merged;
  } catch {
    return { ...defaults };
  }
}

function persist(settings: ProviderSettings) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* noop */ }
}

class ProviderSettingsStore {
  settings = $state(load());

  getProviderOrder(): string[] {
    return this.settings.providerOrder.filter(id => !this.settings.disabledProviders.includes(id));
  }

  setProviderOrder(order: string[]) {
    this.settings.providerOrder = order;
    persist(this.settings);
  }

  toggleProvider(id: string) {
    const idx = this.settings.disabledProviders.indexOf(id);
    if (idx >= 0) {
      this.settings.disabledProviders.splice(idx, 1);
    } else {
      this.settings.disabledProviders = [...this.settings.disabledProviders, id];
    }
    persist(this.settings);
  }

  setAutoSelect(val: boolean) {
    this.settings.autoSelect = val;
    persist(this.settings);
  }

  reset() {
    this.settings = { ...defaults };
    persist(this.settings);
  }
}

export const providerSettings = new ProviderSettingsStore();
