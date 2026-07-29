<script lang="ts">
  import '../app.css';
  import { themeStore } from '$lib/stores/theme';

  $: currentTheme = $themeStore;
</script>

<slot />
