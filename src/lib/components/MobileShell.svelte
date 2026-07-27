<script lang="ts">
  import { onMount } from 'svelte';

  let isIOS = false;
  let isAndroid = false;
  let isStandalone = false;

  onMount(() => {
    const ua = navigator.userAgent;
    isIOS = /iPhone|iPad|iPod/.test(ua);
    isAndroid = /Android/.test(ua);
    isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS) document.documentElement.classList.add('ios');
    if (isAndroid) document.documentElement.classList.add('android');
    if (isStandalone) document.documentElement.classList.add('standalone');

    if (isIOS && isStandalone) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    }
  });
</script>

<slot />
