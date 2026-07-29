import { json } from '@sveltejs/kit';
import { syncToTrakt } from '$lib/server/tracking';

export async function POST({ request }) {
  try {
    const body = await request.json();
    await syncToTrakt('', body);
    return json({ success: true });
  } catch {
    return json({ success: false });
  }
}
