import { toIsoDate } from '@sports/core';
import { getProvider } from '@/lib/provider';
import { dateParam, error, handle, json } from '@/lib/api';

export function GET(req: Request) {
  return handle(async () => {
    const raw = new URL(req.url).searchParams.get('date');
    const date = raw ? dateParam(raw) : toIsoDate(new Date());
    if (!date) return error('date must be YYYY-MM-DD', 400);
    return json(await getProvider().getMatchesByDate(date), {
      headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' },
    });
  });
}
