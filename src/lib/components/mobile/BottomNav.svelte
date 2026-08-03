<script lang="ts">
  import { page } from '$app/stores';
  import { icons } from './icons';
  import { searchOpen } from '$lib/stores/search';
  const navItems: { href: string; label: string; icon: keyof typeof icons; action?: 'search' }[] = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/movies', label: 'Movies', icon: 'grid' },
    { href: '/tv', label: 'Series', icon: 'list' },
    { href: '/search', label: 'Search', icon: 'search', action: 'search' as const },
    { href: '/profile', label: 'Profile', icon: 'user' },
  ];
  $: path = $page.url.pathname;
  function isActive(href: string): boolean {
    if (href === '/') return path === '/';
    return path.startsWith(href);
  }
</script>
<nav class="bottom-nav" aria-label="Main navigation">
  {#each navItems as item}
    {@const active = isActive(item.href)}
    {#if item.action === 'search'}
      <button type="button" class="bottom-nav-item {active ? 'active' : ''}" onclick={() => searchOpen.set(true)} aria-label={item.label} aria-current={active ? 'page' : undefined}>
        <span class="bottom-nav-icon">{@html icons[item.icon]}</span>
        <span class="bottom-nav-label">{item.label}</span>
      </button>
    {:else}
      <a href={item.href} class="bottom-nav-item {active ? 'active' : ''}" aria-label={item.label} aria-current={active ? 'page' : undefined}>
        <span class="bottom-nav-icon">{@html icons[item.icon]}</span>
        <span class="bottom-nav-label">{item.label}</span>
      </a>
    {/if}
  {/each}
</nav>