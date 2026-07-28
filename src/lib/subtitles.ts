const OS_BASE = 'https://api.opensubtitles.com/api/v1';

export async function getAfrikaansSubtitles(tmdbId: number): Promise<{
	url: string;
	label: string;
} | null> {
	const OS_KEY = process.env.OPENSUBTITLES_API_KEY;
	if (!OS_KEY) return null;

	try {
		const searchRes = await fetch(
			`${OS_BASE}/subtitles?tmdb_id=${tmdbId}&languages=af&order_by=download_count`,
			{ headers: { 'Api-Key': OS_KEY, 'Content-Type': 'application/json' } }
		);
		const searchData = await searchRes.json();
		const subs = searchData.data || [];

		if (subs.length === 0) return null;

		const fileId = subs[0]?.attributes?.files?.[0]?.file_id;
		if (!fileId) return null;

		return {
			url: `${OS_BASE}/download?file_id=${fileId}&sub_format=webvtt`,
			label: 'Afrikaans',
		};
	} catch {
		return null;
	}
}
