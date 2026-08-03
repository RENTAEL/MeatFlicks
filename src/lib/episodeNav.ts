export interface NextEpisodeLike {
	season_number: number;
	episode_number: number;
	name: string;
	air_date: string | null;
	still_path: string | null;
}

interface SeasonMeta {
	season_number: number;
	episode_count: number;
	air_date: string | null;
}

interface EpisodeMeta {
	season_number: number;
	episode_number: number;
	name: string;
	air_date: string | null;
	still_path: string | null;
}

export function resolveNextEpisode(
	seasons: SeasonMeta[],
	seasonEpisodes: EpisodeMeta[],
	currentSeason: number,
	currentEpisode: number
): NextEpisodeLike | null {
	const idx = seasonEpisodes.findIndex(
		(e) => e.season_number === currentSeason && e.episode_number === currentEpisode
	);

	if (idx >= 0 && idx < seasonEpisodes.length - 1) {
		const ep = seasonEpisodes[idx + 1];
		return {
			season_number: ep.season_number,
			episode_number: ep.episode_number,
			name: ep.name,
			air_date: ep.air_date ?? null,
			still_path: ep.still_path ?? null
		};
	}

	const nextSeason = seasons
		.filter((s) => s.season_number > currentSeason && s.season_number !== 0 && s.episode_count > 0)
		.sort((a, b) => a.season_number - b.season_number)[0];

	if (nextSeason) {
		return {
			season_number: nextSeason.season_number,
			episode_number: 1,
			name: 'Episode 1',
			air_date: nextSeason.air_date ?? null,
			still_path: null
		};
	}

	return null;
}
