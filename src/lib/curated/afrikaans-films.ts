export interface AfrikaansSource {
	label: string;
	url: string;
	type: 'youtube' | 'direct' | 'embed';
	quality?: string;
}

export interface AfrikaansFilm {
	tmdbId: number;
	title: string;
	titleEn?: string;
	year: number;
	director?: string;
	youtubeId?: string;
	youtubeTrailerId?: string;
	/**
	 * Curated YouTube playback IDs — preferred over the TMDb video feed.
	 * Fill these in as full-length uploads are found; titles without any
	 * YouTube source get a clean "no source" state instead of a dead player.
	 */
	youtubeIds?: string[];
	sources?: AfrikaansSource[];
	poster?: string;
}

export const AFRIKAANS_FILMS: AfrikaansFilm[] = [
	{ tmdbId: 103853, title: 'Paljas', year: 1998, director: 'Katinka Heyns' },
	{ tmdbId: 49458, title: 'Fiela se Kind', year: 1988, director: 'Katinka Heyns' },
	{ tmdbId: 190381, title: 'Die Storie van Klara Viljee', year: 1992 },
	{ tmdbId: 20415, title: 'Poena Is Koning', year: 2007 },
	{ tmdbId: 20081, title: 'Bakgat!', year: 2008 },
	{ tmdbId: 65413, title: 'Bakgat 2', year: 2010 },
	{ tmdbId: 211948, title: 'Bakgat 3', year: 2013 },
	{ tmdbId: 397451, title: 'Vir Altyd', year: 2016 },
	{ tmdbId: 273598, title: 'Pad na Jou Hart', year: 2014 },
	{ tmdbId: 60207, title: 'Liefling', year: 2010 },
	{ tmdbId: 122398, title: 'Jakhalsdans', year: 2010 },
	{ tmdbId: 467180, title: 'Vuil Wasgoed', year: 2017 },
	{ tmdbId: 517402, title: 'Stroomop', year: 2018 },
	{ tmdbId: 171931, title: 'Die Wonderwerker', year: 2012 },
	{ tmdbId: 1140790, title: 'Hans Steek die Rubicon Oor', year: 2023 },
	{ tmdbId: 787512, title: 'Kaalgat Karel', year: 2021 },
	{ tmdbId: 751939, title: 'Toorbos', year: 2020 },
	{ tmdbId: 595441, title: 'Die Seemeeu', year: 2019 },
	{ tmdbId: 438326, title: 'Sy Klink Soos Lente', year: 2016 },
	{ tmdbId: 168170, title: 'Klein Karoo', year: 2013 },
	{ tmdbId: 335308, title: 'Knysna', year: 2014 },
	{ tmdbId: 618228, title: 'Moffie', year: 2019, titleEn: 'Moffie' },
	{ tmdbId: 386470, title: 'Dis Ek, Anna', year: 2015 },
	{ tmdbId: 96988, title: 'Platteland', year: 2011 },
	{ tmdbId: 525937, title: 'Kanarie', year: 2018, titleEn: 'Canary' },
	{ tmdbId: 171957, title: 'Verraaiers', year: 2013, titleEn: 'Traitors' },
	{ tmdbId: 426347, title: 'Tess', year: 2016 },
	{ tmdbId: 795853, title: 'Gaia', year: 2021 },
	{ tmdbId: 236788, title: 'Die Laaste Tango', year: 2013 }
];

export const AFRIKAANS_FILM_MAP = new Map(AFRIKAANS_FILMS.map((f) => [f.tmdbId, f]));
