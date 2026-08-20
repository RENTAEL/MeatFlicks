<script lang="ts">
	import { page } from '$app/state';
	import { SEOHead } from '$lib/components/seo';
	import ShareButton from '$lib/components/utils/ShareButton.svelte';
	import { Quote, CalendarDays, Home } from '@lucide/svelte';
	import { QUOTE_CATEGORY_LABELS } from '$lib/state/stores/dailyQuotes.svelte';
	import { QUOTE_OG_IMAGE, buildQuoteShareUrl } from '$lib/utils/quoteShare';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const quote = $derived(data.quote);
	const shareUrl = $derived(new URL(buildQuoteShareUrl(quote), page.url.origin).toString());
</script>

<SEOHead
	title={`${QUOTE_CATEGORY_LABELS[quote.category]} Quote of the Day — Streamium`}
	description={`“${quote.quote}” — ${quote.author}`}
	canonical="/quote"
	ogType="website"
	ogImage={QUOTE_OG_IMAGE}
	ogImageAlt="Streamium Daily Quote"
/>

<main
	class="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-16"
>
	<div class="flex items-center gap-2 text-accent">
		<Quote class="size-5" aria-hidden="true" />
		<span class="text-sm font-semibold uppercase tracking-wider">
			{QUOTE_CATEGORY_LABELS[quote.category]} quote of the day
		</span>
	</div>

	<blockquote class="text-center text-2xl leading-relaxed font-medium text-foreground sm:text-3xl">
		“{quote.quote}”
	</blockquote>

	<p class="text-lg font-semibold text-muted-foreground">— {quote.author}</p>

	<div class="flex items-center gap-2 text-xs text-muted-foreground">
		<CalendarDays class="size-3.5" aria-hidden="true" />
		<span class="capitalize">{quote.day}</span>
		{#if quote.source === 'fallback'}
			<span
				class="rounded-full border border-border px-2 py-0.5 text-[10px] tracking-wider uppercase"
				>curated</span
			>
		{/if}
	</div>

	<div class="mt-2 flex items-center gap-3">
		<ShareButton
			url={shareUrl}
			title={`Daily ${QUOTE_CATEGORY_LABELS[quote.category]} Quote — Streamium`}
			description={`“${quote.quote}” — ${quote.author}`}
		/>
		<a
			href="/"
			class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
		>
			<Home class="size-4" aria-hidden="true" />
			Back to Streamium
		</a>
	</div>
</main>
