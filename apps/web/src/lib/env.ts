/** Typed access to environment variables. Server-only values are read lazily. */
export const env = {
  get footballDataApiKey(): string | undefined {
    const key = process.env.FOOTBALL_DATA_API_KEY?.trim();
    return key ? key : undefined;
  },
  get appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
  },
};
