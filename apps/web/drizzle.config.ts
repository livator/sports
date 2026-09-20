import { defineConfig } from 'drizzle-kit';

/** `npm run db:generate -w @sports/web` after changing src/db/schema.ts. Migrations apply at server start. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
