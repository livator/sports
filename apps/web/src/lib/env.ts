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
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  },
};
