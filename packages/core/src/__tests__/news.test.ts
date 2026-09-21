import { describe, expect, it } from 'vitest';
import { CommentsClient, threadKey } from '../comments';
import { EspnProvider } from '../providers/espn';
import {
  EXCERPT_MAX_CHARS,
  excerptOf,
  mapNewsItem,
  mergeNews,
  type EspnNewsItem,
} from '../providers/espn/news';

const story = (overrides: Partial<EspnNewsItem> = {}): EspnNewsItem => ({
  id: 49988715,
  type: 'HeadlineNews',
  headline: " Ricardo Pepi's injury in PSV match a concern ",
  description: 'PSV striker Ricardo Pepi had to be substituted.',
  published: '2026-09-20T13:45:33Z',
  byline: 'ESPN',
  images: [
    { url: 'https://a.espncdn.com/photo/small.jpg', width: 576 },
    { url: 'https://a.espncdn.com/photo/wide.jpg', width: 1296, credit: 'Getty' },
  ],
  links: { web: { href: 'https://www.espn.com/soccer/story/_/id/49988715/x' } },
  categories: [
    { type: 'league', description: 'Soccer', leagueId: 600, league: { id: 600 } },
    { type: 'league', description: 'Dutch Eredivisie', leagueId: 11, league: { id: 725 } },
    { type: 'team', description: 'PSV' },
  ],
  ...overrides,
});

describe('story excerpts', () => {
  const html =
    '<p>City won 5-3.</p><photo1><p>A caption that must not appear.</p></photo1>' +
    '<p>Semenyo scored twice &amp; said it &#x27;felt great&#x27;. Guardiola was less sure. He wants more.</p>' +
    '<script>alert(1)</script><p>' +
    'A very long closing paragraph. '.repeat(40) +
    '</p>';

  it('takes whole paragraphs, then whole sentences, up to the limit', () => {
    expect(excerptOf(html, 60)).toEqual([
      'City won 5-3.',
      "Semenyo scored twice & said it 'felt great'.",
    ]);
  });

  it('is plain text: no tags, no captions, no scripts', () => {
    const text = excerptOf(html, 2000).join(' ');
    expect(text).not.toMatch(/[<>]|caption|alert/);
    expect(text).toContain("'felt great'");
  });

  it('never exceeds the limit, however long the story', () => {
    const excerpt = excerptOf(html);
    expect(excerpt.join('').length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
    expect(excerpt.length).toBeGreaterThan(0);
    expect(excerptOf(undefined)).toEqual([]);
  });

  it('reaches the article only as an excerpt, and skips a line the summary already says', () => {
    const article = mapNewsItem(story({ description: 'City won 5-3.', story: html }));
    expect(article?.excerpt?.[0]).toMatch(/^Semenyo scored twice/);
    // The story itself is never passed on: only the excerpt, which respects the limit.
    expect(article).not.toHaveProperty('story');
    expect((article?.excerpt ?? []).join('').length).toBeLessThanOrEqual(EXCERPT_MAX_CHARS);
  });
});

describe('ESPN news mapper', () => {
  it('drops a story whose link is not a web address, and images that are not https', () => {
    expect(mapNewsItem(story({ links: { web: { href: 'javascript:alert(1)' } } }))).toBeNull();
    expect(mapNewsItem(story({ links: { web: { href: 'not a url' } } }))).toBeNull();
    const article = mapNewsItem(
      story({
        images: [
          { url: 'javascript:alert(1)', width: 4000 },
          { url: 'http://a.espncdn.com/photo/plain.jpg', width: 3000 },
          { url: 'https://a.espncdn.com/photo/ok.jpg', width: 600 },
        ],
      }),
    );
    expect(article?.imageUrl).toBe('https://a.espncdn.com/photo/ok.jpg');
  });

  it('maps a story, picks the widest image and finds its competition', () => {
    expect(mapNewsItem(story())).toEqual({
      id: '49988715',
      title: "Ricardo Pepi's injury in PSV match a concern",
      summary: 'PSV striker Ricardo Pepi had to be substituted.',
      publishedAt: '2026-09-20T13:45:33.000Z',
      leagueSlug: 'eredivisie',
      author: 'ESPN',
      imageUrl: 'https://a.espncdn.com/photo/wide.jpg',
      imageCredit: 'Getty',
      sourceName: 'ESPN',
      sourceUrl: 'https://www.espn.com/soccer/story/_/id/49988715/x',
    });
  });

  it('falls back to the short league id, then to the publisher label', () => {
    const shortOnly = story({ categories: [{ type: 'league', description: 'x', leagueId: 23 }] });
    expect(mapNewsItem(shortOnly)?.leagueSlug).toBe('premier-league');

    const unknown = story({ categories: [{ type: 'league', description: 'MLS', leagueId: 19 }] });
    expect(mapNewsItem(unknown)?.leagueSlug).toBeUndefined();
    expect(mapNewsItem(unknown)?.tag).toBe('MLS');
  });

  it('trusts the feed a story came from over its categories', () => {
    expect(mapNewsItem(story(), 'champions-league')?.leagueSlug).toBe('champions-league');
  });

  it('drops video clips and anything it cannot attribute', () => {
    expect(mapNewsItem(story({ type: 'Media' }))).toBeNull();
    expect(mapNewsItem(story({ links: {} }))).toBeNull();
    expect(mapNewsItem(story({ headline: '' }))).toBeNull();
  });

  it('merges feeds newest first without repeating a story', () => {
    const a = mapNewsItem(story({ id: 1, published: '2026-09-20T10:00:00Z' }))!;
    const b = mapNewsItem(story({ id: 2, published: '2026-09-20T12:00:00Z' }))!;
    const c = mapNewsItem(story({ id: 3, published: '2026-09-20T11:00:00Z' }))!;
    expect(
      mergeNews(
        [
          [a, b],
          [b, c],
        ],
        10,
      ).map((n) => n.id),
    ).toEqual(['2', '3', '1']);
    expect(mergeNews([[a, b, c]], 2)).toHaveLength(2);
  });
});

describe('EspnProvider news', () => {
  it('survives one dead feed and rejects malformed article ids without a request', async () => {
    let calls = 0;
    const fakeFetch = (async (input: Parameters<typeof fetch>[0]) => {
      calls++;
      const url = String(input);
      if (url.includes('/esp.1/')) return new Response('nope', { status: 500 });
      return new Response(
        JSON.stringify({ articles: [story({ id: url.includes('eng.1') ? 1 : 2 })] }),
      );
    }) as typeof fetch;
    const provider = new EspnProvider({ fetch: fakeFetch });

    const news = await provider.getNews(['premier-league', 'la-liga', 'serie-a'], 5);
    expect(news.map((n) => n.id).sort()).toEqual(['1', '2']);

    const before = calls;
    await expect(provider.getArticle('../../etc/passwd')).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(before);
  });
});

describe('comment threads', () => {
  it('builds stable keys', () => {
    expect(threadKey({ type: 'match', league: 'serie-a', matchId: '42' })).toBe('match.serie-a.42');
    expect(threadKey({ type: 'article', articleId: '7' })).toBe('article.7');
  });

  it('routes match and article threads to their own endpoints', async () => {
    const seen: string[] = [];
    const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      seen.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return new Response(JSON.stringify({ comments: [], votes: 1, voted: true }));
    }) as typeof fetch;
    const client = new CommentsClient({ baseUrl: 'https://x.test/', fetch: fakeFetch });

    await client.list({ type: 'match', league: 'serie-a', matchId: '42' });
    await client.list({ type: 'article', articleId: '7' });
    expect(await client.vote('c1')).toEqual({ comments: [], votes: 1, voted: true });
    expect(seen).toEqual([
      'GET https://x.test/api/v1/leagues/serie-a/matches/42/comments',
      'GET https://x.test/api/v1/news/7/comments',
      'POST https://x.test/api/v1/comments/c1/vote',
    ]);
  });
});
