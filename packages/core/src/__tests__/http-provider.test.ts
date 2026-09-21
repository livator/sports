import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpProvider } from '../providers/http';

describe('HttpProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the global fetch the way a browser allows: not as a method of the provider', async () => {
    const receivers: unknown[] = [];
    vi.stubGlobal('fetch', function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(new Response('[]', { status: 200 }));
    });

    const provider = new HttpProvider({ baseUrl: 'https://pitchside.test/' });
    await expect(provider.getMatchesByDate('2026-09-20')).resolves.toEqual([]);
    // window.fetch throws "Illegal invocation" for any receiver other than the global object.
    expect(receivers).toHaveLength(1);
    expect(receivers[0] === globalThis || receivers[0] === undefined).toBe(true);
  });

  it('builds the URL from the base, the API prefix and the query', async () => {
    const fetch = vi.fn((_input: Parameters<typeof globalThis.fetch>[0]) =>
      Promise.resolve(new Response('[]', { status: 200 })),
    );
    const provider = new HttpProvider({ baseUrl: 'https://pitchside.test/', fetch });
    await provider.getMatchesByDate('2026-09-20');
    expect(String(fetch.mock.calls[0]?.[0])).toBe(
      'https://pitchside.test/api/v1/matches?date=2026-09-20',
    );
  });
});
