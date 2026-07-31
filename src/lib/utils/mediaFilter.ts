const MIN_VOTE_COUNT = 50;

export interface MediaDateFields {
	release_date?: string | null;
	first_air_date?: string | null;
}

export function isReleasedMedia(item: MediaDateFields, now: Date = new Date()): boolean {
	const dateStr = item.release_date || item.first_air_date;
	if (!dateStr) return true;

	const [year, month = '1', day = '1'] = dateStr.split('-');
	if (!year) return true;

	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return date.getTime() <= now.getTime();
}

export function isEligibleMedia(
	item: MediaDateFields & { vote_count?: number | null },
	options: { minVoteCount?: number } = {}
): boolean {
	const { minVoteCount = MIN_VOTE_COUNT } = options;
	if (typeof item.vote_count === 'number' && item.vote_count < minVoteCount) return false;
	return isReleasedMedia(item);
}

export function todayParam(): string {
	const now = new Date();
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, '0');
	const d = String(now.getUTCDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}
