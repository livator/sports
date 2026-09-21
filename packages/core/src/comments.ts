import type { LeagueSlug } from './types';

/** Longest comment the API accepts, counted in characters (not bytes). */
export const COMMENT_MAX_LENGTH = 1000;

/** Anything people can comment on. */
export type CommentThread =
  { type: 'match'; league: LeagueSlug; matchId: string } | { type: 'article'; articleId: string };

/** A comment in any thread. The name predates article comments. */
export interface MatchComment {
  id: string;
  body: string;
  /** ISO-8601 UTC timestamp */
  createdAt: string;
  author: {
    id: string;
    name: string;
    /** True for the site's own staff. Names are not unique, so this is what tells them apart. */
    staff?: boolean;
  };
  /** Upvotes. */
  votes: number;
  /** Whether the signed-in viewer has upvoted it. Always false for guests. */
  voted: boolean;
}

/** Machine-readable failure reasons, so every client can show its own translated message. */
export type CommentErrorCode =
  'unauthorized' | 'empty' | 'tooLong' | 'tooFast' | 'notFound' | 'ownComment' | 'generic';

export class CommentRequestError extends Error {
  constructor(
    readonly code: CommentErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'CommentRequestError';
  }
}

const KNOWN: readonly CommentErrorCode[] = [
  'unauthorized',
  'empty',
  'tooLong',
  'tooFast',
  'notFound',
  'ownComment',
];

export interface CommentsClientOptions {
  /** Base URL of the sports web app, e.g. https://sports.example.com. Empty means same origin. */
  baseUrl: string;
  fetch?: typeof fetch;
}

/** Stable string for cache keys and local drafts. */
export function threadKey(thread: CommentThread): string {
  return thread.type === 'match'
    ? `match.${thread.league}.${thread.matchId}`
    : `article.${thread.articleId}`;
}

/**
 * Talks to the web app's comment routes. Reading is public. Posting, voting and deleting rely
 * on the session cookie (web) or whatever auth headers the supplied `fetch` adds (mobile).
 */
export class CommentsClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: CommentsClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchFn = options.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  private async send<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.baseUrl}/api/v1${path}`, {
        credentials: 'include',
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
    } catch {
      throw new CommentRequestError('generic', 0);
    }
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
    if (!res.ok) {
      const code =
        KNOWN.find((c) => c === data.error) ?? (res.status === 401 ? 'unauthorized' : 'generic');
      throw new CommentRequestError(code, res.status);
    }
    return data;
  }

  private path(thread: CommentThread): string {
    return thread.type === 'match'
      ? `/leagues/${thread.league}/matches/${encodeURIComponent(thread.matchId)}/comments`
      : `/news/${encodeURIComponent(thread.articleId)}/comments`;
  }

  async list(thread: CommentThread): Promise<MatchComment[]> {
    return (await this.send<{ comments: MatchComment[] }>(this.path(thread))).comments;
  }

  async post(thread: CommentThread, body: string): Promise<MatchComment> {
    const data = await this.send<{ comment: MatchComment }>(this.path(thread), {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return data.comment;
  }

  /** Toggles the viewer's upvote and returns the new state. */
  async vote(commentId: string): Promise<{ votes: number; voted: boolean }> {
    return this.send(`/comments/${encodeURIComponent(commentId)}/vote`, { method: 'POST' });
  }

  async remove(commentId: string): Promise<void> {
    await this.send<void>(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
  }
}
