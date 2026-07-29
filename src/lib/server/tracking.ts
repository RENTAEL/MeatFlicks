import { FEATURES } from '$lib/config/features';

interface WatchEvent {
  imdbId: string;
  title: string;
  type: 'movie' | 'episode';
  progress: number;
  season?: number;
  episode?: number;
}

export async function syncToTrakt(
  userId: string,
  event: WatchEvent
): Promise<void> {
  if (!FEATURES.WATCH_TRACKING) return;

  try {
    const accessToken = await getTraktToken(userId);
    if (!accessToken) return;

    const endpoint = 'https://api.trakt.tv/scrobble/start';

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'trakt-api-version': '2',
        'trakt-api-key': process.env.TRAKT_CLIENT_ID!,
      },
      body: JSON.stringify({
        movie: event.type === 'movie'
          ? { ids: { imdb: event.imdbId } }
          : undefined,
        episode: event.type === 'episode'
          ? {
              ids: { imdb: event.imdbId },
              season: event.season,
              number: event.episode,
            }
          : undefined,
        progress: event.progress,
      }),
    });
  } catch (e) {
    console.warn('[Tracking] Trakt sync failed:', e);
  }
}

async function getTraktToken(userId: string): Promise<string | null> {
  return null;
}
