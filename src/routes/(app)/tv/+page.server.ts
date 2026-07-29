import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
  const query = url.searchParams.get('q') || '';
  const page = parseInt(url.searchParams.get('page') || '1');

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));

  const paramStr = params.toString();
  const apiUrl = `/api/stream/tv${paramStr ? `?${paramStr}` : ''}`;

  try {
    const res = await fetch(apiUrl);

    if (!res.ok) {
      return { shows: [], query, page: 1, totalPages: 1 };
    }

    const data = await res.json();

    return {
      shows: data.results ?? [],
      query,
      page: data.page ?? page,
      totalPages: data.total_pages ?? 1,
    };
  } catch (err) {
    console.error('Failed to load TV series:', err);
    return { shows: [], query, page: 1, totalPages: 1 };
  }
};
