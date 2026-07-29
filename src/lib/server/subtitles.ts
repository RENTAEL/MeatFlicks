import { FEATURES } from '$lib/config/features';

interface SubtitleResult {
  url: string;
  language: string;
  label: string;
  downloads: number;
}

export async function fetchSubtitles(
  imdbId: string,
  language: string = 'en'
): Promise<SubtitleResult[]> {
  if (!FEATURES.AUTO_SUBTITLES) return [];

  try {
    const apiKey = process.env.OPENSUBTITLES_API_KEY;
    if (!apiKey) {
      console.warn('[Subtitles] No API key configured');
      return [];
    }

    const res = await fetch(
      `https://api.opensubtitles.com/api/v1/subtitles?imdb_id=${imdbId}&languages=${language}&order_by=downloads`,
      {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    return (data.data || []).slice(0, 5).map((s: any) => ({
      url: s.attributes?.files?.[0]?.file_url || s.attributes?.url,
      language: s.attributes?.language || language,
      label: s.attributes?.release || 'Unknown',
      downloads: s.attributes?.download_count || 0,
    }));
  } catch (e) {
    console.warn('[Subtitles] Fetch failed:', e);
    return [];
  }
}
