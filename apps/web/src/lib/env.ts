export type DataProviderName = 'football-data' | 'api-football' | 'mock';

/** Typed access to environment variables. Server-only values are read lazily. */
export const env = {
  /** Real data from api-football by default; `mock` is for offline work and tests. */
  get dataProvider(): DataProviderName {
    const value = process.env.SPORTS_DATA_PROVIDER?.trim().toLowerCase();
    return value === 'mock' || value === 'football-data' ? value : 'api-football';
  },
  get footballDataApiKey(): string | undefined {
    const key = process.env.FOOTBALL_DATA_API_KEY?.trim();
    return key ? key : undefined;
  },
  get apiFootballKey(): string | undefined {
    const key = process.env.API_FOOTBALL_KEY?.trim();
    return key ? key : undefined;
  },
  /**
   * Canonical links, the sitemap, robots.txt and e-mail links are all built from this, so an
   * unset value in production would publish localhost addresses to search engines and send
   * verification links nobody can open. Fail instead, loudly, on the first request that needs it.
   */
  get appUrl(): string {
    const value = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
    if (value) return value;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
    }
    return 'http://localhost:3000';
  },
};
