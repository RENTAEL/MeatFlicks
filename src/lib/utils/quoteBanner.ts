import type { DailyQuoteClient } from '$lib/state/stores/dailyQuotes.svelte';
import { QUOTE_CATEGORY_LABELS } from '$lib/state/stores/dailyQuotes.svelte';

export const QUOTE_BANNER_WIDTH = 1080;
export const QUOTE_BANNER_HEIGHT = 1080;

type QuoteBannerQuote = Pick<DailyQuoteClient, 'quote' | 'author' | 'category' | 'day'>;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let line = '';
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && line) {
			lines.push(line);
			line = word;
		} else {
			line = test;
		}
	}
	if (line) lines.push(line);
	return lines;
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

export function drawQuoteBanner(
	ctx: CanvasRenderingContext2D,
	quote: QuoteBannerQuote,
	width: number = QUOTE_BANNER_WIDTH,
	height: number = QUOTE_BANNER_HEIGHT
): void {
	const pad = Math.round(width * 0.09);
	const maxTextWidth = width - pad * 2;

	// background gradient
	const bg = ctx.createLinearGradient(0, 0, width, height);
	bg.addColorStop(0, '#0a0a1a');
	bg.addColorStop(0.55, '#141031');
	bg.addColorStop(1, '#1e1b4b');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, width, height);

	// radial glow
	const glow = ctx.createRadialGradient(
		width / 2,
		height * 0.32,
		40,
		width / 2,
		height * 0.32,
		width * 0.7
	);
	glow.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
	glow.addColorStop(1, 'rgba(99, 102, 241, 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, width, height);

	// decorative oversized quote glyph
	ctx.fillStyle = 'rgba(255,255,255,0.05)';
	ctx.font = `800 ${Math.round(width * 0.62)}px Georgia, serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('“', width / 2, height * 0.42);

	// brand header
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#818cf8';
	ctx.font = `700 ${Math.round(width * 0.045)}px Inter, system-ui, sans-serif`;
	ctx.fillText('◈  STREAMIUM  ◈', width / 2, height * 0.085);
	ctx.fillStyle = '#a5b4fc';
	ctx.font = `600 ${Math.round(width * 0.028)}px Inter, system-ui, sans-serif`;
	ctx.fillText('D A I L Y   Q U O T E S', width / 2, height * 0.135);

	// quote text — shrink to fit
	let fontSize = Math.round(width * 0.062);
	let lines: string[] = [];
	for (; fontSize > Math.round(width * 0.034); fontSize -= 4) {
		ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
		lines = wrapText(ctx, quote.quote, maxTextWidth);
		const total = lines.length * fontSize * 1.42;
		if (total < height * 0.42) break;
	}
	const lineHeight = fontSize * 1.42;
	const quoteTop = height * 0.26;
	ctx.fillStyle = '#ffffff';
	lines.forEach((line, i) => {
		ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
		ctx.fillText(line, width / 2, quoteTop + i * lineHeight);
	});

	// author
	const authorY = quoteTop + lines.length * lineHeight + Math.round(height * 0.045);
	ctx.fillStyle = '#c7d2fe';
	ctx.font = `600 ${Math.round(width * 0.04)}px Inter, system-ui, sans-serif`;
	ctx.fillText(`— ${quote.author}`, width / 2, authorY);

	// category pill
	const category = QUOTE_CATEGORY_LABELS[quote.category] ?? quote.category;
	ctx.font = `600 ${Math.round(width * 0.026)}px Inter, system-ui, sans-serif`;
	const pillText = `${category} · ${quote.day}`;
	const pillW = ctx.measureText(pillText).width + width * 0.05;
	const pillH = Math.round(width * 0.06);
	const pillX = (width - pillW) / 2;
	const pillY = authorY + Math.round(height * 0.05);
	ctx.fillStyle = 'rgba(129, 140, 248, 0.16)';
	ctx.strokeStyle = 'rgba(129, 140, 248, 0.5)';
	ctx.lineWidth = 2;
	roundRect(ctx, pillX, pillY - pillH / 2, pillW, pillH, pillH / 2);
	ctx.fill();
	ctx.stroke();
	ctx.fillStyle = '#a5b4fc';
	ctx.textBaseline = 'middle';
	ctx.fillText(pillText, width / 2, pillY + 2);
	ctx.textBaseline = 'alphabetic';

	// small brand footer — keeps the image signed without cluttering the quote
	ctx.fillStyle = 'rgba(129, 140, 248, 0.75)';
	ctx.font = `600 ${Math.round(width * 0.026)}px Inter, system-ui, sans-serif`;
	ctx.fillText('◈  STREAMIUM  ◈', width / 2, height * 0.945);
}

export async function renderQuoteBanner(quote: QuoteBannerQuote): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = QUOTE_BANNER_WIDTH;
	canvas.height = QUOTE_BANNER_HEIGHT;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas 2D not available');
	drawQuoteBanner(ctx, quote);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
	if (!blob) throw new Error('Banner render failed');
	return blob;
}

export async function quoteBannerFile(quote: QuoteBannerQuote): Promise<File> {
	const blob = await renderQuoteBanner(quote);
	return new File([blob], 'streamium-daily-quote.png', { type: 'image/png' });
}

export function canShareFiles(): boolean {
	return typeof navigator !== 'undefined' && !!navigator.canShare;
}

export async function downloadQuoteBanner(quote: QuoteBannerQuote): Promise<void> {
	const blob = await renderQuoteBanner(quote);
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = 'streamium-daily-quote.png';
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type QuoteBannerShareResult = 'shared' | 'downloaded' | 'failed' | 'cancelled';

export async function shareQuoteBanner(
	quote: QuoteBannerQuote,
	opts: { title: string; text: string; url: string }
): Promise<QuoteBannerShareResult> {
	const file = await quoteBannerFile(quote);
	if (canShareFiles() && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({
				files: [file],
				title: opts.title,
				text: `${opts.text} ${opts.url}`
			});
			return 'shared';
		} catch (error) {
			if ((error as Error).name === 'AbortError') return 'cancelled';
			// fall through to download — the image is still the deliverable
		}
	}
	await downloadQuoteBanner(quote);
	return 'downloaded';
}
