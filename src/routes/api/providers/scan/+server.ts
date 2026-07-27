import { json } from '@sveltejs/kit';
import { PROVIDERS } from '$lib/providers';
import type { RequestHandler } from './$types';

interface ScanResult {
  id: string;
  name: string;
  movieUrl: string;
  tvUrl: string | null;
  status: 'working' | 'blocked' | 'dead';
  requiresNoRestrictions: boolean;
}

const RESTRICTION_FREE_PROVIDERS = new Set([
  'vidlink', 'vidsrc', 'vidbinge', 'superembed', 'vidsrc-rip',
  'vidsrc-me', 'vidsrc-icu', 'embed-su', 'filmxy', 'vidstream'
]);

export const GET: RequestHandler = async ({ url, fetch }) => {
  const tmdbId = parseInt(url.searchParams.get('tmdbId') || '');
  const type = (url.searchParams.get('type') || 'movie') as 'movie' | 'tv';
  const season = parseInt(url.searchParams.get('season') || '1');
  const episode = parseInt(url.searchParams.get('episode') || '1');

  if (!tmdbId || isNaN(tmdbId)) {
    return json({ error: 'Missing tmdbId' }, { status: 400 });
  }

  const results: ScanResult[] = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const embedUrl = type === 'movie'
        ? provider.getMovieUrl(tmdbId)
        : provider.getTVUrl(tmdbId, season, episode);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const res = await fetch(embedUrl, {
          method: 'HEAD',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          redirect: 'follow',
        });

        clearTimeout(timeout);

        if (res.ok || res.status === 403 || res.status === 401) {
          return {
            id: provider.id,
            name: provider.name,
            movieUrl: type === 'movie' ? embedUrl : provider.getMovieUrl(tmdbId),
            tvUrl: type === 'tv' ? embedUrl : (provider.getTVUrl(tmdbId, 1, 1) || null),
            status: res.ok ? ('working' as const) : ('blocked' as const),
            requiresNoRestrictions: RESTRICTION_FREE_PROVIDERS.has(provider.id),
          };
        }

        return { id: provider.id, name: provider.name, movieUrl: embedUrl, tvUrl: null, status: 'dead' as const, requiresNoRestrictions: RESTRICTION_FREE_PROVIDERS.has(provider.id) };
      } catch {
        return { id: provider.id, name: provider.name, movieUrl: embedUrl, tvUrl: null, status: 'dead' as const, requiresNoRestrictions: RESTRICTION_FREE_PROVIDERS.has(provider.id) };
      }
    })
  );

  const working = results.filter(r => r.status === 'working' || r.status === 'blocked');
  const dead = results.filter(r => r.status === 'dead');

  return json({
    tmdbId, type,
    total: results.length,
    workingCount: working.length,
    deadCount: dead.length,
    working, dead,
    all: [...working, ...dead],
  });
};
