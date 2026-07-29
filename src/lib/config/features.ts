export const FEATURES = {
  DISCOVERY_ENGINE: false,
  WATCH_TRACKING: false,
  AUTO_SUBTITLES: false,
  RATING_AGGREGATOR: false,
  CONTENT_CALENDAR: false,
  ADVANCED_SEARCH: false,
  SIMILAR_TITLES: false,
  TRENDING_FEED: false,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isEnabled(feature: FeatureName): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('features') === 'revert') return false;
    if (params.get('features') === 'all') return true;
    if (params.get('feature') === feature) return true;
  }
  return FEATURES[feature];
}

export function activeFeatures(): FeatureName[] {
  return (Object.keys(FEATURES) as FeatureName[]).filter(isEnabled);
}
