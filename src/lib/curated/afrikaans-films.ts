export interface AfrikaansFilm {
	tmdbId: number;
	title: string;
	titleEn?: string;
	year: number;
	director?: string;
	youtubeId?: string;
	poster?: string;
}

export const AFRIKAANS_FILMS: AfrikaansFilm[] = [
	{ tmdbId: 45094, title: 'Paljas', year: 1998, director: 'Katinka Heyns' },
	{ tmdbId: 58762, title: 'Fiela se Kind', year: 1988, director: 'Katinka Heyns' },
	{ tmdbId: 118884, title: 'Die Storie van Klara Viljee', year: 1992 },
	{ tmdbId: 100275, title: 'Poena Is Koning', year: 2007 },
	{ tmdbId: 59033, title: 'Bakgat!', year: 2008 },
	{ tmdbId: 79682, title: 'Bakgat 2', year: 2010 },
	{ tmdbId: 114511, title: 'Bakgat 3', year: 2013 },
	{ tmdbId: 45095, title: 'Vir Altyd', year: 2016 },
	{ tmdbId: 34927, title: 'Pad na Jou Hart', year: 2014 },
	{ tmdbId: 35076, title: 'Liefling: Die Movie', year: 2010 },
	{ tmdbId: 45093, title: 'Jakhalsdans', year: 2010 },
	{ tmdbId: 93066, title: 'Vuil Wasgoed', year: 2017 },
	{ tmdbId: 91206, title: 'Stroomop', year: 2018 },
	{ tmdbId: 51036, title: 'Die Wonderwerker', year: 2012 },
	{ tmdbId: 88155, title: 'Hans Steek die Rubicon Oor', year: 2022 },
	{ tmdbId: 58763, title: 'Kaalgat Karel', year: 2021 },
	{ tmdbId: 96212, title: 'Toorbos', year: 2020 },
	{ tmdbId: 93067, title: 'Die Seemeeu', year: 2018 },
	{ tmdbId: 80876, title: 'Sy Klink Soos Lente', year: 2016 },
	{ tmdbId: 58719, title: 'Klein Karoo', year: 2013 },
	{ tmdbId: 45097, title: 'Knysna', year: 2014 },
	{ tmdbId: 87541, title: 'Moffie', year: 2019, titleEn: 'Moffie' },
	{ tmdbId: 45099, title: 'Dis Ek, Anna', year: 2015 },
	{ tmdbId: 100274, title: 'Platteland', year: 2011 },
	{ tmdbId: 87548, title: 'Kanarie', year: 2018, titleEn: 'Canary' },
	{ tmdbId: 45100, title: 'Verraaiers', year: 2013, titleEn: 'Traitors' },
	{ tmdbId: 45098, title: 'Tess', year: 2016 },
	{ tmdbId: 96545, title: 'Gaia', year: 2021 },
	{ tmdbId: 45101, title: 'Die Laaste Tango', year: 2013 },
	{ tmdbId: 45102, title: 'Kluisenaar', year: 2015, titleEn: 'The Hermit' },
];

export const AFRIKAANS_FILM_MAP = new Map(
	AFRIKAANS_FILMS.map((f) => [f.tmdbId, f])
);
