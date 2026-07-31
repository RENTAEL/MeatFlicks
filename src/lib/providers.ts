export interface Provider {
  id: string;
  name: string;
  getMovieUrl: (tmdbId: number, imdbId?: string) => string;
  getTVUrl: (tmdbId: number, season: number, episode: number, imdbId?: string) => string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'vidlink',
    name: 'VidLink.pro',
    getMovieUrl: (id) => `https://vidlink.pro/movie/${id}?autoplay=true`,
    getTVUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc.to',
    getMovieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidbinge',
    name: 'VidBinge',
    getMovieUrl: (id) => `https://vidbinge.dev/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidbinge.dev/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: '2embed-skin',
    name: '2Embed.skin',
    getMovieUrl: (id, imdbId) => `https://www.2embed.skin/embed/${imdbId || id}`,
    getTVUrl: (id, s, e, imdbId) => `https://www.2embed.skin/embedtv/${imdbId || id}&s=${s}&e=${e}`,
  },
  {
    id: '2embed',
    name: '2Embed.cc',
    getMovieUrl: (id, imdbId) => `https://www.2embed.cc/embed/${imdbId || id}`,
    getTVUrl: (id, s, e, imdbId) => `https://www.2embed.cc/embedtv/${imdbId || id}&s=${s}&e=${e}`,
  },
  {
    id: '2embed-org',
    name: '2Embed.org',
    getMovieUrl: (id, imdbId) => `https://2embed.org/embed/${imdbId || id}`,
    getTVUrl: (id, s, e, imdbId) => `https://2embed.org/embedtv/${imdbId || id}&s=${s}&e=${e}`,
  },
  {
    id: 'autoembed',
    name: 'AutoEmbed',
    getMovieUrl: (id) => `https://player.autoembed.co/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://player.autoembed.co/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'superembed',
    name: 'SuperEmbed',
    getMovieUrl: (id) => `https://www.superembed.stream/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://www.superembed.stream/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidcore',
    name: 'VidCore',
    getMovieUrl: (id) => `https://www.vidcore.org/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://www.vidcore.org/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'smashystream',
    name: 'SmashyStream',
    getMovieUrl: (id) => `https://embed.smashystream.com/playere.php?tmdb=${id}`,
    getTVUrl: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id: 'vidjoy',
    name: 'VidJoy',
    getMovieUrl: (id) => `https://vidjoy.pro/embed/${id}`,
    getTVUrl: (id, s, e) => `https://vidjoy.pro/embed/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc-rip',
    name: 'VidSrc.rip',
    getMovieUrl: (id) => `https://vidsrc.rip/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.rip/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc-me',
    name: 'VidSrc.me',
    getMovieUrl: (id) => `https://vidsrc.me/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.me/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc-icu',
    name: 'VidSrc.icu',
    getMovieUrl: (id) => `https://vidsrc.icu/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'embed-su',
    name: 'Embed.su',
    getMovieUrl: (id) => `https://embed.su/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'multiembed',
    name: 'MultiEmbed',
    getMovieUrl: (id) => `https://multiembed.mov/direct?video_id=${id}&tmdb=1`,
    getTVUrl: (id, s, e) => `https://multiembed.mov/direct?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
  {
    id: 'vidcloud',
    name: 'VidCloud',
    getMovieUrl: (id) => `https://vidcloud.xyz/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidcloud.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'go-movie',
    name: 'GoMovie',
    getMovieUrl: (id) => `https://gomovie.xyz/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://gomovie.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'hdtoday',
    name: 'HDToday',
    getMovieUrl: (id) => `https://hdtoday.tv/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://hdtoday.tv/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'moviee',
    name: 'Moviee.tv',
    getMovieUrl: (id) => `https://moviee.tv/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://moviee.tv/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'upcloud',
    name: 'UpCloud',
    getMovieUrl: (id) => `https://upcloud.to/embed/${id}`,
    getTVUrl: (id, s, e) => `https://upcloud.to/embed/${id}/${s}/${e}`,
  },
  {
    id: 'nontongo',
    name: 'NontonGo',
    getMovieUrl: (id) => `https://nontongo.xyz/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://nontongo.xyz/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'databasegdrive',
    name: 'DBGDrive',
    getMovieUrl: (id) => `https://databasegdriveplayer.xyz/player.php?tmdb=${id}`,
    getTVUrl: (id, s, e) => `https://databasegdriveplayer.xyz/player.php?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id: 'filmxy',
    name: 'FilmXY',
    getMovieUrl: (id, imdbId) => `https://filmxy.live/embed/${imdbId || id}`,
    getTVUrl: (id, s, e, imdbId) => `https://filmxy.live/embed/${imdbId || id}/${s}/${e}`,
  },
  {
    id: 'vidstream',
    name: 'VidStream',
    getMovieUrl: (id) => `https://vidstream.xyz/embed/movie/${id}`,
    getTVUrl: (id, s, e) => `https://vidstream.xyz/embed/tv/${id}/${s}/${e}`,
  },
];
