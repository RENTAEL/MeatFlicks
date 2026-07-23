export type SpotlightAnime = {
	rank: number;
	id: string;
	name: string;
	description: string;
	poster: string;
	jname: string;
	episodes: { sub: number; dub: number | null };
	type: string;
	otherInfo: string[];
};

export type TrendCard = {
	rank: number;
	id: string;
	name: string;
	poster: string;
	jname: string;
	episodes: { sub: number; dub: number | null };
	type: string;
};

export type LatestEpisode = {
	id: string;
	name: string;
	jname: string;
	poster: string;
	episode: { sub: number; dub: number | null };
	type: string;
};

export type AniwatchHome = {
	spotLightAnimes: SpotlightAnime[];
	trendingAnimes: TrendCard[];
	latestEpisodes: LatestEpisode[];
	top10Animes: { day: TrendCard[]; week: TrendCard[]; month: TrendCard[] };
	genres: string[];
};

export const fallbackHome: AniwatchHome = {
	spotLightAnimes: [
		{ rank: 1, id: 'one-piece-100', name: 'One Piece', description: 'Follow Monkey D. Luffy and his swashbuckling crew in their search for the ultimate treasure, the One Piece.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/dfe1f8c46e1c24ebcdfd7f5ef1fea27c.jpg', jname: 'One Piece', episodes: { sub: 1100, dub: 1050 }, type: 'TV', otherInfo: ['Ongoing', 'TV', 'Shounen'] },
		{ rank: 2, id: 'attack-on-titan-112', name: 'Attack on Titan', description: 'Humans are nearly exterminated by giant creatures called Titans.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/f56cb0d2cf9a17daa73eb05f7dad1453.jpg', jname: 'Shingeki no Kyojin', episodes: { sub: 98, dub: 98 }, type: 'TV', otherInfo: ['Completed', 'TV', 'Action'] },
		{ rank: 3, id: 'jujutsu-kaisen-114', name: 'Jujutsu Kaisen', description: 'A boy swallows a cursed talisman and becomes involved with the world of curses.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/f91a003b60916c39c9a1d259a5c9d02f.jpg', jname: 'Jujutsu Kaisen', episodes: { sub: 47, dub: 47 }, type: 'TV', otherInfo: ['Ongoing', 'TV', 'Shounen'] },
		{ rank: 4, id: 'demon-slayer-116', name: 'Demon Slayer', description: 'A family is attacked by demons and the two siblings are transformed.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/a153d5f8f5a4e4b9a7e0e8c82ec377c8.jpg', jname: 'Kimetsu no Yaiba', episodes: { sub: 63, dub: 63 }, type: 'TV', otherInfo: ['Completed', 'TV', 'Action'] },
		{ rank: 5, id: 'solo-leveling-118', name: 'Solo Leveling', description: 'In a world where hunters fight monsters, the weakest hunter becomes the strongest.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/9e4a7a5f5c0e0b7e6f8a9b0c1d2e3f4a.jpg', jname: 'Ore dake Level Up na Ken', episodes: { sub: 24, dub: 24 }, type: 'TV', otherInfo: ['Ongoing', 'TV', 'Action'] },
		{ rank: 6, id: 'chainsaw-man-120', name: 'Chainsaw Man', description: 'A young man becomes a devil hunter after merging with his pet devil.', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e.jpg', jname: 'Chainsaw Man', episodes: { sub: 12, dub: 12 }, type: 'TV', otherInfo: ['Completed', 'TV', 'Shounen'] }
	],
	trendingAnimes: [
		{ rank: 1, id: 'one-piece-100', name: 'One Piece', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/dfe1f8c46e1c24ebcdfd7f5ef1fea27c.jpg', jname: 'One Piece', episodes: { sub: 1100, dub: 1050 }, type: 'TV' },
		{ rank: 2, id: 'solo-leveling-118', name: 'Solo Leveling', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/9e4a7a5f5c0e0b7e6f8a9b0c1d2e3f4a.jpg', jname: 'Ore dake Level Up na Ken', episodes: { sub: 24, dub: 24 }, type: 'TV' },
		{ rank: 3, id: 'jujutsu-kaisen-114', name: 'Jujutsu Kaisen', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/f91a003b60916c39c9a1d259a5c9d02f.jpg', jname: 'Jujutsu Kaisen', episodes: { sub: 47, dub: 47 }, type: 'TV' },
		{ rank: 4, id: 'demon-slayer-116', name: 'Demon Slayer', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/a153d5f8f5a4e4b9a7e0e8c82ec377c8.jpg', jname: 'Kimetsu no Yaiba', episodes: { sub: 63, dub: 63 }, type: 'TV' },
		{ rank: 5, id: 'attack-on-titan-112', name: 'Attack on Titan', poster: 'https://cdn.noitatnemucod.net/thumbnail/300x400/100/f56cb0d2cf9a17daa73eb05f7dad1453.jpg', jname: 'Shingeki no Kyojin', episodes: { sub: 98, dub: 98 }, type: 'TV' }
	],
	latestEpisodes: [],
	top10Animes: { day: [], week: [], month: [] },
	genres: ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Shounen', 'Slice of Life', 'Sports', 'Thriller']
};
