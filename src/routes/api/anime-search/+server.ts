import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) {
		return json({ results: [], query: q || '' });
	}

	const errors: string[] = [];

	try {
		const res = await fetch(
			`https://api.consumet.org/anime/gogoanime/${encodeURIComponent(q)}`
		);
		if (res.ok) {
			const data = await res.json();
			if (data.results?.length > 0) {
				return json({
					results: data.results.slice(0, 20).map((item: any) => ({
						id: item.id,
						title: item.title?.romaji || item.title?.english || item.title,
						poster: item.image,
						genres: item.genres || [],
						episodes: item.totalEpisodes || item.episodes || null,
						source: 'consumet',
					})),
					query: q,
				});
			}
		} else {
			errors.push(`Consumet: ${res.status}`);
		}
	} catch (e: any) {
		errors.push(`Consumet: ${e.message}`);
	}

	try {
		const res = await fetch('https://graphql.anilist.co', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `
					query ($search: String) {
						Page(perPage: 20) {
							media(search: $search, type: ANIME) {
								id
								title { romaji english }
								coverImage { large }
								averageScore
								seasonYear
								episodes
								genres
							}
						}
					}
				`,
				variables: { search: q },
			}),
		});
		if (res.ok) {
			const jsonData = await res.json();
			const media = jsonData?.data?.Page?.media;
			if (media?.length > 0) {
				return json({
					results: media.map((item: any) => ({
						id: String(item.id),
						title: item.title?.romaji || item.title?.english,
						poster: item.coverImage?.large,
						genres: item.genres || [],
						episodes: item.episodes,
						source: 'anilist',
					})),
					query: q,
				});
			}
		} else {
			errors.push(`AniList: ${res.status}`);
		}
	} catch (e: any) {
		errors.push(`AniList: ${e.message}`);
	}

	try {
		const res = await fetch(
			`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=20`
		);
		if (res.ok) {
			const jsonData = await res.json();
			if (jsonData.data?.length > 0) {
				return json({
					results: jsonData.data.map((item: any) => ({
						id: String(item.mal_id),
						title: item.title,
						poster: item.images?.jpg?.large_image_url,
						genres: item.genres?.map((g: any) => g.name) || [],
						episodes: item.episodes,
						source: 'jikan',
					})),
					query: q,
				});
			}
		} else {
			errors.push(`Jikan: ${res.status}`);
		}
	} catch (e: any) {
		errors.push(`Jikan: ${e.message}`);
	}

	return json({
		results: [],
		query: q,
		error: 'All anime search APIs are currently unavailable. Try again later.',
		debug: errors,
	}, { status: 502 });
};
