/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Blog: public listing/post queries, admin CRUD, Unsplash cover proxy.
 * Covers resolve on demand via the Unsplash API (UNSPLASH_ACCESS_KEY
 * Worker secret) and are cached into cover_image_url. Without a key
 * or image, the frontend renders a gradient fallback.
 */

import type { Env } from './types';

export interface BlogPostRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string;
  cover_query: string;
  cover_alt: string;
  status: string;
  publish_at: number;
  author: string;
  tags: string;
  created_at: number;
  updated_at: number;
}

export function publicPost(p: BlogPostRow) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    body: p.body,
    coverImageUrl: p.cover_image_url || null,
    coverQuery: p.cover_query || null,
    coverAlt: p.cover_alt || p.title,
    publishAt: p.publish_at,
    author: p.author || null,
    tags: (p.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
  };
}

export async function listPublishedPosts(env: Env, limit = 24, offset = 0) {
  const now = Date.now();
  const { results } = await env.DB.prepare(
    `SELECT * FROM blog_posts WHERE status = 'published' AND publish_at <= ? ORDER BY publish_at DESC LIMIT ? OFFSET ?`
  )
    .bind(now, limit, offset)
    .all<BlogPostRow>();
  const total = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM blog_posts WHERE status = 'published' AND publish_at <= ?`
  )
    .bind(now)
    .first<{ c: number }>();
  return { posts: (results || []).map(publicPost), total: total?.c || 0 };
}

export async function getPublishedPost(env: Env, slug: string) {
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT * FROM blog_posts WHERE slug = ? COLLATE NOCASE AND status = 'published' AND publish_at <= ?`
  )
    .bind(slug, now)
    .first<BlogPostRow>();
  return row ? publicPost(row) : null;
}

export async function listAllPosts(env: Env, limit = 200) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM blog_posts ORDER BY publish_at DESC LIMIT ?`
  )
    .bind(limit)
    .all<BlogPostRow>();
  return (results || []).map((p) => ({ ...publicPost(p), status: p.status }));
}

/** Resolve a cover image: cached URL, else Unsplash API by cover_query, else null. */
export async function resolveCoverImage(env: Env, post: BlogPostRow): Promise<string | null> {
  if (post.cover_image_url) return post.cover_image_url;
  const key = env.UNSPLASH_ACCESS_KEY || '';
  const query = post.cover_query || post.title;
  if (!key || !query) return null;
  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { urls?: { regular?: string }; alt_description?: string };
    const url = data.urls?.regular || null;
    if (url) {
      const sized = `${url}&w=1200&q=80&auto=format&fit=crop`;
      await env.DB.prepare('UPDATE blog_posts SET cover_image_url = ?, updated_at = ? WHERE id = ?')
        .bind(sized, Date.now(), post.id)
        .run()
        .catch(() => undefined);
      return sized;
    }
  } catch {
    /* fall through to null (frontend gradient fallback) */
  }
  return null;
}

export async function fetchAndStoreCover(env: Env, id: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT * FROM blog_posts WHERE id = ?').bind(id).first<BlogPostRow>();
  if (!row) return null;
  return resolveCoverImage(env, row);
}

/** Published slugs for sitemap.xml. */
export async function listPublishedSlugs(env: Env, limit = 500): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT slug FROM blog_posts WHERE status = 'published' AND publish_at <= ? ORDER BY publish_at DESC LIMIT ?`
  )
    .bind(Date.now(), limit)
    .all<{ slug: string }>();
  return (results || []).map((r) => r.slug);
}

/** SEO descriptor for /blogs and /post/:slug (same shape as getSeoForPath). */
export async function getBlogSeo(env: Env, pathname: string) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/blogs') {
    return {
      title: 'Blog — Weatherlink Web Console',
      description: 'Station setup guides, weather reading tips, and product updates.',
      keywords: 'weather station blog, WeatherLink guides, weather console tips',
      ogImage: '',
      canonical: 'https://wwebconsole.com/blogs',
      twitter: '',
      indexable: true,
      siteName: 'WWebConsole',
    };
  }
  const m = clean.match(/^\/post\/([a-z0-9-]+)$/i);
  if (!m) return null;
  const post = await getPublishedPost(env, m[1]!);
  if (!post) return null;
  const base = 'https://wwebconsole.com';
  return {
    title: `${post.title} — WWebConsole Blog`,
    description: post.excerpt || post.title,
    keywords: post.tags.join(', '),
    ogImage: post.coverImageUrl || '',
    canonical: `${base}/post/${post.slug}`,
    twitter: '',
    indexable: true,
    siteName: 'WWebConsole',
  };
}
