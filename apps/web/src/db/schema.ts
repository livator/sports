import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/*
 * The first four tables are owned by better-auth (email + password accounts, sessions,
 * and the tokens used for email verification). Column names follow its Drizzle/SQLite
 * contract, so keep them in step with better-auth when upgrading it.
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
};

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  /* Added by better-auth's admin plugin. "admin" opens the console; everyone else is "user". */
  role: text('role'),
  /** A suspended account: cannot sign in, and its sessions are revoked when the flag is set. */
  banned: integer('banned', { mode: 'boolean' }).default(false),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp_ms' }),
  ...timestamps,
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Admin plugin column. Impersonation is not used by the console, but the plugin writes it. */
    impersonatedBy: text('impersonated_by'),
    ...timestamps,
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    /** Password hash for the email + password provider. Never the password itself. */
    password: text('password'),
    ...timestamps,
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps,
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

/**
 * A comment in a thread. A thread is a match (`scope` = its competition slug, `threadId` = the
 * data source's match id) or a news article (`scope` = "news", `threadId` = the article id).
 * The column names date from when only matches had comments; renaming them would mean
 * rebuilding the table for no gain, so only the TypeScript names moved on.
 */
export const comment = sqliteTable(
  'comment',
  {
    id: text('id').primaryKey(),
    scope: text('league_slug').notNull(),
    threadId: text('match_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('comment_match_idx').on(t.scope, t.threadId, t.createdAt),
    index('comment_user_idx').on(t.userId, t.createdAt),
  ],
);

/** One upvote per user per comment. */
export const commentVote = sqliteTable(
  'comment_vote',
  {
    commentId: text('comment_id')
      .notNull()
      .references(() => comment.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.commentId, t.userId] })],
);

/**
 * News written by our own staff in the admin console, in all three site languages at once.
 * Title, summary and body are per language; everything else (photo, byline, tag) is the same
 * story regardless of language, so it is shared. `ru`/`ro` may be blank while a translation is
 * still being written: the public site falls back to the English text until they are filled in.
 *
 * There is no "scheduled" status: an article is scheduled when it is published with a
 * `publishedAt` in the future, so going live needs no background job.
 */
export const article = sqliteTable(
  'article',
  {
    /** "ps-" plus random characters, so it can never collide with a data-source article id. */
    id: text('id').primaryKey(),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    /** Competition slug, or null for a general story shown under every filter. */
    leagueSlug: text('league_slug'),
    tag: text('tag').notNull().default(''),
    titleEn: text('title_en').notNull().default(''),
    titleRu: text('title_ru').notNull().default(''),
    titleRo: text('title_ro').notNull().default(''),
    summaryEn: text('summary_en').notNull().default(''),
    summaryRu: text('summary_ru').notNull().default(''),
    summaryRo: text('summary_ro').notNull().default(''),
    /** Plain text; a blank line separates paragraphs. */
    bodyEn: text('body_en').notNull().default(''),
    bodyRu: text('body_ru').notNull().default(''),
    bodyRo: text('body_ro').notNull().default(''),
    /** Byline as printed. Not necessarily the account that saved it. Same in every language. */
    author: text('author').notNull().default(''),
    imageUrl: text('image_url'),
    caption: text('caption').notNull().default(''),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    commentsOn: integer('comments_on', { mode: 'boolean' }).notNull().default(true),
    views: integer('views').notNull().default(0),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    /** Kept when the account is removed: the article outlives its editor. */
    editorId: text('editor_id').references(() => user.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [
    index('article_public_idx').on(t.status, t.publishedAt),
    index('article_updated_idx').on(t.updatedAt),
  ],
);
