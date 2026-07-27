<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<footer class="border-t border-border/30 bg-background/50 backdrop-blur-sm {className}">
	<div class="mx-auto flex max-w-screen-2xl flex-col items-center gap-3 px-6 py-8 text-center text-sm text-muted-foreground">
		<a href="/" class="text-lg font-bold tracking-tight text-foreground">Streamium</a>

		<nav class="flex flex-wrap items-center justify-center gap-4">
			<a href="/" class="transition-colors hover:text-foreground">Home</a>
			<a href="/movies" class="transition-colors hover:text-foreground">Movies</a>
			<a href="/tv-shows" class="transition-colors hover:text-foreground">TV Series</a>
			<a href="/search" class="transition-colors hover:text-foreground">Search</a>
		</nav>

		<p class="text-xs text-muted-foreground/60">
			Made with dedication &bull; Powered by TMDB
		</p>
		<p class="text-xs text-muted-foreground/40">
			&copy; 2026 Streamium. Not affiliated with TMDB.
		</p>
	</div>
</footer>
