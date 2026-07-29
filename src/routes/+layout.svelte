<script lang="ts">
  import '../app.css';
  import { themeStore } from '$lib/stores/theme';
  import { afterNavigate } from '$app/navigation';

  $effect(() => { $themeStore; });

  afterNavigate((nav) => {
    if (nav.type === 'link') {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(() => {
        document.documentElement.style.scrollBehavior = '';
      });
    }
  });
</script>

<slot />
