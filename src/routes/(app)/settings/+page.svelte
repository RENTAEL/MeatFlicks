<script lang="ts">
  import { page } from '$app/stores';
  import { redirect } from '@sveltejs/kit';
  import ThemePicker from '$lib/components/ThemePicker.svelte';
  import ThemeToggle from '$lib/themes/ThemeToggle.svelte';
  import { onMount } from 'svelte';
  import { displayMode, isImmersiveVrSupported } from '$lib/state/stores/displayModeStore.svelte';

  $: user = $page.data?.user;

  let xrSupported = 'unknown';
  onMount(() => {
    (async () => {
      try {
        xrSupported = (await isImmersiveVrSupported()) ? 'yes' : 'no';
      } catch {
        xrSupported = 'no';
      }
    })();
  });

  $: if (!user) {
    redirect(303, '/login');
  }

  const browser = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const links = {
    chrome: 'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh',
    edge: 'https://microsoftedge.microsoft.com/addons/detail/ublock-origin-lite/cimighlppcgcoapaliogpjjdehbnofjd',
  };

  function getStoreLink(): string {
    if (/Edge/i.test(browser)) return links.edge;
    return links.chrome;
  }
</script>

<svelte:head>
  <title>Settings — Streamium</title>
</svelte:head>

<div class="settings-page">
  <div class="settings-header">
    <h1 class="settings-title">Settings</h1>
    <p class="settings-sub">Customize your Streamium experience.</p>
  </div>

  <!-- Display Mode -->
  <div class="settings-section">
    <div class="section-header">
      <span class="section-icon">📺</span>
      <div>
        <h2 class="section-title">Display Mode</h2>
        <p class="section-desc">
          Desktop Mode is the default experience. VR Mode is a preference for
          future virtual-theater viewing; on non-VR browsers the site simply
          behaves as Desktop Mode.
        </p>
      </div>
    </div>

    <div class="mode-toggle" role="group" aria-label="Display mode">
      <button
        type="button"
        class="mode-btn"
        class:mode-btn-active={displayMode.mode === 'desktop'}
        onclick={() => displayMode.setMode('desktop')}
      >
        Desktop Mode
      </button>
      <button
        type="button"
        class="mode-btn"
        class:mode-btn-active={displayMode.mode === 'vr'}
        onclick={() => displayMode.setMode('vr')}
      >
        VR Mode
      </button>
    </div>

    {#if displayMode.mode === 'vr' && xrSupported !== 'yes'}
      <p class="vr-hint">🕶️ VR theater is available in the Meta Quest browser. Open Streamium on your headset and add it to the home screen.</p>
    {/if}
  </div>

  <!-- Theme Section -->
  <div class="settings-section">
    <ThemePicker />
  </div>

  <!-- Quick Theme Toggle -->
  <div class="settings-section">
    <h2 class="st-heading">Quick Theme Switch</h2>
    <p class="st-sub">Click to cycle through themes.</p>
    <div class="st-toggle-row">
      <ThemeToggle />
      <span class="st-toggle-label">Cycle themes</span>
    </div>
  </div>

  <!-- Popup Blocking (existing) -->
  <div class="settings-section">
    <div class="section-header">
      <span class="section-icon">🛡️</span>
      <div>
        <h2 class="section-title">Popup Blocking</h2>
        <p class="section-desc">
          Some video providers open popup windows. Install a lightweight
          ad blocker to prevent this automatically.
        </p>
      </div>
    </div>

    <div class="ublock-card">
      <div class="ublock-info">
        <div>
          <h3 class="ublock-name">uBlock Origin Lite</h3>
          <p class="ublock-desc">
            Free, open-source, Manifest V3 compliant. Runs with minimal
            permissions — only blocks what you want it to. Won't slow
            down your browser.
          </p>
        </div>
      </div>

      <a href={getStoreLink()} target="_blank" rel="noopener" class="ublock-install-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="12" x2="12" y2="3"/>
        </svg>
        Install uBlock Origin Lite
      </a>

      <p class="ublock-note">
        Already installed? Great — you're protected. If popups still
        appear, make sure the extension is enabled for this site.
      </p>
    </div>
  </div>

  <!-- Account -->
  <div class="settings-section">
    <h2 class="st-heading">Account</h2>
    <p class="st-sub">Manage your profile and watch history.</p>
    <a href="/profile" class="btn btn-secondary">Go to Profile →</a>
  </div>
</div>

<style>
  .settings-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .settings-header {
    margin-bottom: 2rem;
  }

  .settings-title {
    font-size: 1.75rem;
    font-weight: var(--font-weight-extrabold, 800);
    color: var(--text-primary);
    margin: 0 0 0.35rem;
  }

  .settings-sub {
    color: var(--text-secondary);
    margin: 0;
  }

  .settings-section {
    background: var(--bg-card);
    border: 1px solid var(--border-stream);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .st-heading {
    font-size: 1.1rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
    margin: 0 0 0.35rem;
  }

  .st-sub {
    font-size: 0.85rem;
    color: var(--text-tertiary);
    margin: 0 0 1rem;
  }

  .st-toggle-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .st-toggle-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .section-header {
    display: flex;
    gap: 14px;
    margin-bottom: 16px;
  }

  .section-icon {
    font-size: 24px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .section-title {
    font-size: 1.1rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
    margin: 0 0 4px;
  }

  .section-desc {
    font-size: 0.85rem;
    color: var(--text-tertiary);
    margin: 0;
    line-height: 1.5;
  }

  .ublock-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border-stream);
    border-radius: var(--radius-md);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .ublock-info {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .ublock-name {
    font-size: 1rem;
    font-weight: var(--font-weight-semibold, 600);
    color: var(--text-primary);
    margin: 0 0 4px;
  }

  .ublock-desc {
    font-size: 0.85rem;
    color: var(--text-tertiary);
    line-height: 1.5;
    margin: 0;
  }

  .ublock-note {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    margin: 0;
    line-height: 1.4;
    opacity: 0.8;
  }

  .ublock-install-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1.25rem;
    background: var(--gradient-brand);
    color: white;
    border-radius: var(--radius-full);
    font-size: 0.9rem;
    font-weight: var(--font-weight-semibold, 600);
    text-decoration: none;
    transition: all var(--transition-base);
    width: fit-content;
  }

  .ublock-install-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .ublock-install-btn svg {
    width: 18px;
    height: 18px;
  }

  .mode-toggle {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .mode-btn {
    min-height: 44px;
    padding: 0.65rem 1.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border-stream);
    border-radius: var(--radius-full);
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-weight: var(--font-weight-semibold, 600);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .mode-btn:active {
    transform: scale(0.97);
  }

  .mode-btn-active {
    background: var(--gradient-brand);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 20px var(--accent-glow);
  }

  .vr-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-tertiary);
    line-height: 1.5;
    background: var(--bg-elevated);
    border: 1px solid var(--border-stream);
    border-radius: var(--radius-md);
    padding: 0.75rem 1rem;
  }

  @media (max-width: 640px) {
    .settings-page { padding: 1.5rem 1rem; }
    .settings-title { font-size: 1.4rem; }
    .ublock-info { flex-direction: column; align-items: flex-start; }
    .mode-btn { flex: 1 1 100%; }
  }
</style>
