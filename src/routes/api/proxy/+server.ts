import { error, text } from '@sveltejs/kit';
import * as cheerio from 'cheerio';
import type { RequestHandler } from './$types';

const AD_KEYWORDS = [
  'googlead', 'doubleclick', 'googlesyndication', 'adservice',
  'amazon-adsystem', 'adsystem', 'adserver', 'adnxs', 'rubicon',
  'criteo', 'taboola', 'outbrain', 'popunder', 'popup',
  'exoclick', 'trafficjunky', 'propellerads', 'adsterra',
  'adcash', 'clicksor', 'popads', 'adf.ly', 'shorte.st',
  'mgid', 'revcontent', 'nativeads', 'sponsored',
];

const STYLE_BLOCKLIST = [
  'position:fixed', 'position: sticky', 'z-index:9999',
  'z-index: 9999', 'z-index:99999', 'z-index: 99999',
];

function hasAdIndicators(src: string): boolean {
  const lower = src.toLowerCase();
  return AD_KEYWORDS.some(k => lower.includes(k));
}

function isProbablyAdScript($el: cheerio.Cheerio): boolean {
  const src = $el.attr('src') || '';
  const text = $el.html() || '';
  return hasAdIndicators(src) || hasAdIndicators(text);
}

const POPUP_OVERRIDE_SCRIPT = `
<script nonce="__OPENSEA_NONCE__">
(function(){
  var noop = function(){};
  var noopTrue = function(){ return true; };
  window.open = function(){ return { close: noop, focus: noop, closed: false, document: { write: noop, writeln: noop }, location: { href: '' } }; };
  window.showModalDialog = noop;
  window.showModelessDialog = noop;
  window.createPopup = noop;
  window.Print = noop;
  document.write = noop;
  document.writeln = noop;
  Window.prototype.open = function(){ return { close: noop }; };
  document.querySelectorAll('[target="_blank"]').forEach(function(el){ el.removeAttribute('target'); el.setAttribute('target','_self'); });
  document.querySelectorAll('[onclick*="window.open"]').forEach(function(el){ el.removeAttribute('onclick'); });
  document.querySelectorAll('[onclick*="location"]').forEach(function(el){ el.removeAttribute('onclick'); });
  Object.defineProperty(document, 'sandboxed', { get: function(){ return false; }, configurable: true });
})();
</script>`;

export const GET: RequestHandler = async ({ url, fetch, platform }) => {
  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) throw error(400, 'Missing url param');

  let targetHostname: string;
  try {
    targetHostname = new URL(targetUrl).hostname;
  } catch {
    throw error(400, 'Invalid url param');
  }

  const res = await fetch(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': `https://${targetHostname}/`,
    },
    redirect: 'follow',
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Sanitized': 'false',
      },
    });
  }

  const rawHtml = await res.text();

  const $ = cheerio.load(rawHtml);
  const scriptsToRemove: cheerio.Element[] = [];
  const stylesToRemove: cheerio.Element[] = [];

  $('script').each((_, el) => {
    if (isProbablyAdScript($(el))) {
      scriptsToRemove.push(el);
      return;
    }
    const html = $(el).html() || '';
    if (AD_KEYWORDS.some(k => html.toLowerCase().includes(k))) {
      scriptsToRemove.push(el);
    }
  });

  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (hasAdIndicators(src)) {
      scriptsToRemove.push(el);
    }
  });

  $('ins').each((_, el) => {
    scriptsToRemove.push(el);
  });

  $('div[class*="ad"]').each((_, el) => {
    scriptsToRemove.push(el);
  });

  $('div[id*="ad"]').each((_, el) => {
    scriptsToRemove.push(el);
  });

  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    if (STYLE_BLOCKLIST.some(s => style.includes(s))) {
      stylesToRemove.push(el);
    }
  });

  [...scriptsToRemove, ...stylesToRemove].forEach(el => $(el).remove());

  $('a[target="_blank"]').attr('target', '_self');
  $('form[target="_blank"]').attr('target', '_self');
  $('[onclick]').each((_, el) => {
    const onclick = $(el).attr('onclick') || '';
    if (onclick.includes('window.open') || onclick.includes('location.href') || onclick.includes('location=')) {
      $(el).removeAttr('onclick');
    }
  });
  $('[onmousedown]').removeAttr('onmousedown');
  $('[onmouseup]').removeAttr('onmouseup');

  $('meta[http-equiv="refresh"]').remove();

  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const popupScript = POPUP_OVERRIDE_SCRIPT.replace(/__OPENSEA_NONCE__/g, nonce);
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; frame-src *; media-src *; img-src * data: blob:; connect-src *; style-src 'self' 'unsafe-inline' *;">`;

  let sanitized = $.html();
  sanitized = sanitized.replace('</head>', `${cspMeta}\n${popupScript}\n</head>`);
  sanitized = sanitized.replace(/window\.open\(/g, '(function(){})(');

  return text(sanitized, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Proxy-Sanitized': 'true',
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': `default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; frame-src *; media-src *; img-src * data: blob:; connect-src *; style-src 'self' 'unsafe-inline' *;`,
    },
  });
};
