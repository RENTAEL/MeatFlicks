import { json } from '@sveltejs/kit';

const OMDB_BASE = 'https://www.omdbapi.com';

export async function GET({ url }) {
  const imdbId = url.searchParams.get('imdbId');
  if (!imdbId) return json({ error: 'Missing imdbId' }, { status: 400 });

  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return json({ ratings: [] });

  try {
    const res = await fetch(`${OMDB_BASE}/?i=${imdbId}&apikey=${apiKey}`);
    const data = await res.json();

    if (data.Error) return json({ ratings: [] });

    return json({ ratings: data.Ratings || [] });
  } catch {
    return json({ ratings: [] });
  }
}
