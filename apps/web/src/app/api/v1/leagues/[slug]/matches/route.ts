import type { MatchQuery } from '@sports/core';
import { getProvider } from '@/lib/provider';
import { dateParam, handle, isResponse, json, resolveLeague } from '@/lib/api';

type Ctx = { params: Promise<{ slug: string }> };

export function GET(req: Request, { params }: Ctx) {
  return handle(async () => {
    const league = resolveLeague((await params).slug);
    if (isResponse(league)) return league;

    const { searchParams } = new URL(req.url);
    const query: MatchQuery = {};
    const matchday = Number.parseInt(searchParams.get('matchday') ?? '', 10);
    if (!Number.isNaN(matchday) && matchday > 0) query.matchday = matchday;
    const dateFrom = dateParam(searchParams.get('dateFrom'));
    const dateTo = dateParam(searchParams.get('dateTo'));
    if (dateFrom) query.dateFrom = dateFrom;
    if (dateTo) query.dateTo = dateTo;

    return json(await getProvider().getMatches(league.slug, query));
  });
}
