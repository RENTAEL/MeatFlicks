import { logger } from '../logger';

export const QUOTE_CATEGORIES = ['funny', 'deep', 'dark', 'general', 'dating'] as const;
export type QuoteCategory = (typeof QUOTE_CATEGORIES)[number];

export type DailyQuote = {
	quote: string;
	author: string;
	category: QuoteCategory;
	day: string;
	source: 'api' | 'fallback';
};

const QUOTABLE_TAGS: Record<QuoteCategory, string | null> = {
	funny: 'humor',
	deep: 'philosophy',
	dark: 'darkness',
	general: 'inspirational',
	dating: 'love'
};

const FALLBACK_QUOTES: Record<QuoteCategory, { quote: string; author: string }[]> = {
	funny: [
		{ quote: 'I am not a morning person. I am a coffee person.', author: 'Unknown' },
		{ quote: 'Common sense is not so common.', author: 'Voltaire' },
		{ quote: 'I can resist everything except temptation.', author: 'Oscar Wilde' },
		{ quote: 'Behind every great man is a woman rolling her eyes.', author: 'Jim Carrey' },
		{
			quote: 'The road to success is dotted with many tempting parking spaces.',
			author: 'Will Rogers'
		},
		{ quote: 'I’m on a seafood diet. I see food and I eat it.', author: 'Unknown' },
		{ quote: 'I intend to live forever. So far, so good.', author: 'Steven Wright' },
		{
			quote: 'My therapist said I have a preoccupation with vengeance. We’ll see about that.',
			author: 'Unknown'
		}
	],
	deep: [
		{ quote: 'The unexamined life is not worth living.', author: 'Socrates' },
		{ quote: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
		{
			quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
			author: 'Aristotle'
		},
		{ quote: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
		{
			quote: 'The world is a book, and those who do not travel read only one page.',
			author: 'Augustine of Hippo'
		},
		{ quote: 'Life is what happens when you’re busy making other plans.', author: 'John Lennon' },
		{ quote: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates' },
		{
			quote:
				'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
			author: 'Ralph Waldo Emerson'
		}
	],
	dark: [
		{
			quote: 'We are all in the gutter, but some of us are looking at the stars.',
			author: 'Oscar Wilde'
		},
		{ quote: 'The abyss gazes also into you.', author: 'Friedrich Nietzsche' },
		{ quote: 'Every man is guilty of all the good he did not do.', author: 'Voltaire' },
		{
			quote: 'The light at the end of the tunnel is just the headlamp of an oncoming train.',
			author: 'Unknown'
		},
		{ quote: 'All that we see or seem is but a dream within a dream.', author: 'Edgar Allan Poe' },
		{
			quote: 'He who fights monsters should see to it that he himself does not become a monster.',
			author: 'Friedrich Nietzsche'
		},
		{ quote: 'The night is darkest just before the dawn.', author: 'Thomas Fuller' },
		{ quote: 'We’ve all got both light and dark inside us.', author: 'J.K. Rowling' }
	],
	general: [
		{
			quote: 'The best time to plant a tree was twenty years ago. The second best time is now.',
			author: 'Chinese Proverb'
		},
		{
			quote: 'It does not matter how slowly you go as long as you do not stop.',
			author: 'Confucius'
		},
		{ quote: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
		{
			quote: 'Whether you think you can or you think you can’t, you’re right.',
			author: 'Henry Ford'
		},
		{
			quote:
				'Success is not final, failure is not fatal: it is the courage to continue that counts.',
			author: 'Winston Churchill'
		},
		{
			quote: 'Happiness is not something ready made. It comes from your own actions.',
			author: 'Dalai Lama'
		},
		{ quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
		{ quote: 'Believe you can and you’re halfway there.', author: 'Theodore Roosevelt' }
	],
	dating: [
		{ quote: 'We accept the love we think we deserve.', author: 'Stephen Chbosky' },
		{
			quote:
				'Being deeply loved by someone gives you strength, while loving someone deeply gives you courage.',
			author: 'Lao Tzu'
		},
		{ quote: 'Love is composed of a single soul inhabiting two bodies.', author: 'Aristotle' },
		{ quote: 'The best thing to hold onto in life is each other.', author: 'Audrey Hepburn' },
		{
			quote: 'I have decided to stick with love. Hate is too great a burden to bear.',
			author: 'Martin Luther King Jr.'
		},
		{
			quote:
				'A successful marriage requires falling in love many times, always with the same person.',
			author: 'Mignon McLaughlin'
		},
		{
			quote:
				'Love does not consist of gazing at each other, but in looking outward together in the same direction.',
			author: 'Antoine de Saint-Exupéry'
		},
		{
			quote:
				'You know you’re in love when you can’t fall asleep because reality is finally better than your dreams.',
			author: 'Dr. Seuss'
		}
	]
};

const API_TIMEOUT_MS = 2500;
const inMemoryCache = new Map<string, { day: string; quote: DailyQuote }>();

function utcDayKey(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

function seedHash(input: string): number {
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = (hash * 33) ^ input.charCodeAt(i);
	}
	return hash >>> 0;
}

function pickFallback(category: QuoteCategory, day: string): DailyQuote {
	const list = FALLBACK_QUOTES[category];
	const idx = seedHash(`${day}:${category}`) % list.length;
	const entry = list[idx];
	return {
		quote: entry.quote,
		author: entry.author,
		category,
		day,
		source: 'fallback'
	};
}

async function fetchFromApi(category: QuoteCategory): Promise<DailyQuote | null> {
	const tag = QUOTABLE_TAGS[category];
	const url = `https://api.quotable.io/quotes/random?limit=1${tag ? `&tags=${tag}` : ''}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { Accept: 'application/json' }
		});
		if (!response.ok) return null;
		const data = (await response.json()) as
			| { content?: string; author?: string }
			| { content?: string; author?: string }[];
		const item = Array.isArray(data) ? data[0] : data;
		if (!item || typeof item.content !== 'string' || item.content.length < 2) return null;
		return {
			quote: item.content.trim(),
			author:
				typeof item.author === 'string' && item.author.trim() ? item.author.trim() : 'Unknown',
			category,
			day: utcDayKey(),
			source: 'api'
		};
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export async function getDailyQuote(category: QuoteCategory): Promise<DailyQuote> {
	const day = utcDayKey();

	const cached = inMemoryCache.get(category);
	if (cached && cached.day === day) return cached.quote;

	const apiQuote = await fetchFromApi(category);
	const quote = apiQuote ?? pickFallback(category, day);
	inMemoryCache.set(category, { day, quote });

	if (apiQuote) {
		logger.info({ category }, 'Daily quote fetched from API');
	} else {
		logger.info({ category }, 'Quote API unavailable — serving curated fallback');
	}

	return quote;
}

export function isQuoteCategory(value: string): value is QuoteCategory {
	return (QUOTE_CATEGORIES as readonly string[]).includes(value);
}

export { FALLBACK_QUOTES };
