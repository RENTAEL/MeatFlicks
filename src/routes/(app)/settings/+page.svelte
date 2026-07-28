<script lang="ts">
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
  <h1 class="page-title">Settings</h1>

  <section class="settings-section">
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
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Install uBlock Origin Lite
      </a>

      <p class="ublock-note">
        Already installed? Great — you're protected. If popups still
        appear, make sure the extension is enabled for this site.
      </p>
    </div>
  </section>
</div>

<style>
  .settings-page {
    max-width: 720px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  .page-title {
    font-size: 28px;
    font-weight: 700;
    color: #e0e7ff;
    margin: 0 0 32px;
  }

  .settings-section {
    background: rgba(30, 27, 75, 0.6);
    border: 1px solid rgba(129, 140, 248, 0.12);
    border-radius: 14px;
    padding: 24px;
    margin-bottom: 24px;
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
    font-size: 18px;
    font-weight: 600;
    color: #e0e7ff;
    margin: 0 0 4px;
  }

  .section-desc {
    font-size: 14px;
    color: #a5b4fc;
    margin: 0;
    line-height: 1.5;
  }

  .ublock-card {
    background: rgba(129, 140, 248, 0.06);
    border: 1px solid rgba(129, 140, 248, 0.15);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .ublock-info {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .ublock-name {
    font-size: 16px;
    font-weight: 600;
    color: #e0e7ff;
    margin: 0 0 4px;
  }

  .ublock-desc {
    font-size: 13px;
    color: #a5b4fc;
    line-height: 1.5;
    margin: 0;
  }

  .ublock-note {
    font-size: 12px;
    color: #6b7280;
    margin: 0;
    line-height: 1.4;
  }

  @media (max-width: 640px) {
    .settings-page { padding: 24px 16px; }
    .page-title { font-size: 22px; }
    .ublock-info { flex-direction: column; align-items: flex-start; }
  }
</style>
