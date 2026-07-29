import { json } from '@sveltejs/kit';
import { fetchSubtitles } from '$lib/server/subtitles';

export async function GET({ url }) {
  const imdbId = url.searchParams.get('imdbId');
  const lang = url.searchParams.get('lang') || 'en';

  if (!imdbId) {
    return json({ error: 'Missing imdbId' }, { status: 400 });
  }

  const subs = await fetchSubtitles(imdbId, lang);
  return json(subs);
}
