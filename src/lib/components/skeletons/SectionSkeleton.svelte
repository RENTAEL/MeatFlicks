<script lang="ts">
  let {
    type = 'grid' as 'grid' | 'row' | 'list' | 'card' | 'detail',
    count = 6,
    aspect = '2/3',
  } = $props();
</script>

{#if type === 'grid'}
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {#each Array(count) as _}
      <div class="animate-pulse rounded-lg bg-muted/30" style="aspect-ratio: {aspect}">
        <div class="h-full w-full rounded-lg bg-muted/20 shimmer"></div>
      </div>
    {/each}
  </div>
{:else if type === 'row'}
  <div class="flex gap-3 overflow-hidden">
    {#each Array(count) as _}
      <div class="animate-pulse shrink-0 rounded-lg bg-muted/30" style="aspect-ratio: {aspect}; width: 150px">
        <div class="h-full w-full rounded-lg bg-muted/20 shimmer"></div>
      </div>
    {/each}
  </div>
{:else if type === 'card'}
  <div class="animate-pulse rounded-lg bg-muted/30" style="aspect-ratio: {aspect}">
    <div class="h-full w-full rounded-lg bg-muted/20 shimmer"></div>
  </div>
{:else if type === 'detail'}
  <div class="space-y-4">
    <div class="animate-pulse rounded-lg bg-muted/30" style="aspect-ratio: 16/9; max-width: 100%">
      <div class="h-full w-full rounded-lg bg-muted/20 shimmer"></div>
    </div>
    <div class="space-y-2">
      <div class="h-4 w-3/4 rounded bg-muted/30 animate-pulse"></div>
      <div class="h-3 w-1/2 rounded bg-muted/20 animate-pulse"></div>
    </div>
  </div>
{:else if type === 'list'}
  <div class="space-y-2">
    {#each Array(count) as _}
      <div class="flex animate-pulse gap-3 rounded-lg bg-muted/20 p-3">
        <div class="h-16 w-12 shrink-0 rounded bg-muted/30"></div>
        <div class="flex-1 space-y-2 py-1">
          <div class="h-3 w-3/4 rounded bg-muted/30"></div>
          <div class="h-2 w-1/2 rounded bg-muted/20"></div>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  @keyframes shimmer {
    0% { opacity: 0.3; }
    50% { opacity: 0.7; }
    100% { opacity: 0.3; }
  }
  .shimmer {
    animation: shimmer 2s ease-in-out infinite;
  }
</style>
