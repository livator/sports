import type { LeagueSlug } from './types';

/** Longest comment the API accepts, counted in characters (not bytes). */
export const COMMENT_MAX_LENGTH = 1000;

export interface MatchComment {
  id: string;
  body: string;
  /** ISO-8601 UTC timestamp */
  createdAt: string;
  author: { id: string; name: string };
}

/** Machine-readable failure reasons, so every client can show its own translated message. */
export type CommentErrorCode =
  'unauthorized' | 'empty' | 'tooLong' | 'tooFast' | 'notFound' | 'generic';

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
];

export interface CommentsClientOptions {
  /** Base URL of the sports web app, e.g. https://sports.example.com */
  baseUrl: string;
  fetch?: typeof fetch;
}

/**
 * Talks to the web app's comment routes. Reading is public. Posting and deleting rely on
 * the session cookie (web) or whatever auth headers the supplied `fetch` adds (mobile).
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

  private path(league: LeagueSlug, matchId: string): string {
    return `/leagues/${league}/matches/${encodeURIComponent(matchId)}/comments`;
  }

  async list(league: LeagueSlug, matchId: string): Promise<MatchComment[]> {
    return (await this.send<{ comments: MatchComment[] }>(this.path(league, matchId))).comments;
  }

  async post(league: LeagueSlug, matchId: string, body: string): Promise<MatchComment> {
    const data = await this.send<{ comment: MatchComment }>(this.path(league, matchId), {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    return data.comment;
  }

  async remove(commentId: string): Promise<void> {
    await this.send<void>(`/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
  }
}
