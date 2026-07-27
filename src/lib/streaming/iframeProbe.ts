export async function testWithFallback(url: string): Promise<{ works: boolean; reason?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.type === 'opaque' || resp.ok) {
      return { works: true };
    }
    return { works: false, reason: 'http_error' };
  } catch {
    return { works: false, reason: 'fetch_failed' };
  }
}
