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
  cover_credit: string;
  cover_page_url: string;
  status: string;
  publish_at: number;
  author: string;
  tags: string;
  created_at: number;
  updated_at: number;
}

export const COVER_CDN_BASE = 'https://cdn.wwebconsole.com';

export function coverObjectKey(slug: string) {
  return `blog/${slug}.jpg`;
}

/** Hosts we ever fetch cover bytes from (Pixabay + Unsplash CDNs). */
const COVER_FETCH_HOSTS = new Set([
  'pixabay.com',
  'cdn.pixabay.com',
  'images.unsplash.com',
]);

/** Defense-in-depth: never fetch cover bytes from an unlisted host. */
export function isAllowedCoverHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (new URL(url).protocol !== 'https:') return false;
    for (const allowed of COVER_FETCH_HOSTS) {
      if (host === allowed || host.endsWith(`.${allowed}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
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
    coverCredit: p.cover_credit || null,
    coverPageUrl: p.cover_page_url || null,
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

/** Related posts: tag overlap first, recency as tiebreak. Never includes self. */
export async function listRelatedPosts(env: Env, slug: string, limit = 3) {
  const now = Date.now();
  const current = await env.DB.prepare(`SELECT tags FROM blog_posts WHERE slug = ? COLLATE NOCASE`)
    .bind(slug)
    .first<{ tags: string }>();
  const currentTags = new Set((current?.tags || '').split(',').map((t) => t.trim()).filter(Boolean));
  const { results } = await env.DB.prepare(
    `SELECT * FROM blog_posts WHERE slug != ? COLLATE NOCASE AND status = 'published' AND publish_at <= ? ORDER BY publish_at DESC LIMIT 60`
  )
    .bind(slug, now)
    .all<BlogPostRow>();
  const scored = (results || []).map((p) => {
    const tags = p.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const overlap = tags.filter((t) => currentTags.has(t)).length;
    return { p, overlap };
  });
  scored.sort((a, b) => b.overlap - a.overlap || b.p.publish_at - a.p.publish_at);
  return scored.slice(0, limit).map((s) => publicPost(s.p));
}

export async function listAllPosts(env: Env, limit = 200) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM blog_posts ORDER BY publish_at DESC LIMIT ?`
  )
    .bind(limit)
    .all<BlogPostRow>();
  return (results || []).map((p) => ({ ...publicPost(p), status: p.status }));
}

/** Archive a remote image into our R2 CDN (survives source deletion). Returns the CDN URL. */
export async function archiveCoverToCdn(
  env: Env,
  slug: string,
  sourceUrl: string,
  credit: string,
  pageUrl: string,
  postId: string
): Promise<string | null> {
  if (!env.COVERS) return null;
  if (!isAllowedCoverHost(sourceUrl)) {
    console.error('Cover fetch blocked: host not allowlisted');
    return null;
  }
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const bytes = await res.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 8_000_000) return null;
    const key = coverObjectKey(slug);
    await env.COVERS.put(key, bytes, { httpMetadata: { contentType: 'image/jpeg', cacheControl: 'public, max-age=31536000, immutable' } });
    const cdnUrl = `${COVER_CDN_BASE}/${key}`;
    await env.DB.prepare('UPDATE blog_posts SET cover_image_url = ?, cover_credit = ?, cover_page_url = ?, updated_at = ? WHERE id = ?')
      .bind(cdnUrl, credit, pageUrl, Date.now(), postId)
      .run()
      .catch(() => undefined);
    return cdnUrl;
  } catch {
    return null;
  }
}

/** Resolve a cover image: cached URL, else Pixabay/Unsplash by cover_query (archived to our CDN), else null. */
export async function resolveCoverImage(env: Env, post: BlogPostRow): Promise<string | null> {
  if (post.cover_image_url) return post.cover_image_url;
  const query = post.cover_query || post.title;
  if (!query) return null;
  // Pixabay first (key is configured), Unsplash as fallback.
  const pixabayKey = env.PIXABAY_API_KEY || '';
  if (pixabayKey) {
    try {
      const res = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=3`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { hits?: { largeImageURL?: string; webformatURL?: string; user?: string; pageURL?: string }[] };
        const hit = data.hits?.[0];
        const url = hit?.largeImageURL || hit?.webformatURL || null;
        if (url) {
          const credit = hit?.user ? `Photo by ${hit.user} on Pixabay` : '';
          const archived = await archiveCoverToCdn(env, post.slug, url, credit, hit?.pageURL || '', post.id);
          if (archived) return archived;
          await env.DB.prepare('UPDATE blog_posts SET cover_image_url = ?, cover_credit = ?, cover_page_url = ?, updated_at = ? WHERE id = ?')
            .bind(url, credit, hit?.pageURL || '', Date.now(), post.id)
            .run()
            .catch(() => undefined);
          return url;
        }
      }
    } catch {
      /* fall through to Unsplash */
    }
  }
  const key = env.UNSPLASH_ACCESS_KEY || '';
  if (!key) return null;
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

/** RSS 2.0 feed for /blog.xml (latest 50 published posts). */
export async function buildBlogRss(env: Env): Promise<string> {
  const { posts } = await listPublishedPosts(env, 50, 0);
  // Single source of truth for the canonical origin (Admin → Site & SEO).
  // A hardcoded origin here would split canonicals if the domain ever changes.
  let base = 'https://wwebconsole.com';
  try {
    const row = await env.DB.prepare('SELECT value FROM app_settings WHERE key = ?')
      .bind('site_canonical_base')
      .first<{ value: string }>();
    if (row?.value) base = row.value.replace(/\/+$/, '');
  } catch {
    /* default stands */
  }
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const items = posts
    .map((p) => {
      const pubDate = new Date(p.publishAt || Date.now()).toUTCString();
      return `    <item>\n      <title>${esc(p.title)}</title>\n      <link>${base}/post/${p.slug}</link>\n      <guid isPermaLink="true">${base}/post/${p.slug}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${esc(p.excerpt || p.title)}</description>\n    </item>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>WWebConsole Blog</title>\n    <link>${base}/blogs</link>\n    <description>Station setup guides, weather reading tips, and product updates.</description>\n    <language>en</language>\n${items}\n  </channel>\n</rss>`;
}

/** Published post metadata for sitemap.xml (slugs + freshness + covers). */
export async function listPublishedPostMeta(
  env: Env,
  limit = 500
): Promise<{ slug: string; updated_at: number; publish_at: number; cover_image_url: string | null }[]> {
  const { results } = await env.DB.prepare(
    `SELECT slug, updated_at, publish_at, cover_image_url FROM blog_posts WHERE status = 'published' AND publish_at <= ? ORDER BY publish_at DESC LIMIT ?`
  )
    .bind(Date.now(), limit)
    .all<{ slug: string; updated_at: number; publish_at: number; cover_image_url: string | null }>();
  return results || [];
}

/** Published slugs for sitemap.xml. */
export async function listPublishedSlugs(env: Env, limit = 500): Promise<string[]> {
  return (await listPublishedPostMeta(env, limit)).map((r) => r.slug);
}

/** SEO descriptor for /blogs and /post/:slug (same shape as getSeoForPath). */
export async function getBlogSeo(env: Env, pathname: string) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  // Respect the global seo_indexable kill-switch + canonical base + site name
  // (Admin → Site & SEO). Hardcoding these would split canonicals on rename.
  let indexable = true;
  let base = 'https://wwebconsole.com';
  const siteName = 'WWebConsole';
  try {
    const { results } = await env.DB.prepare(
      'SELECT key, value FROM app_settings WHERE key IN (?, ?)'
    )
      .bind('seo_indexable', 'site_canonical_base')
      .all<{ key: string; value: string }>();
    const map = new Map((results || []).map((r) => [r.key, r.value]));
    const v = map.get('seo_indexable') ?? '1';
    indexable = v === '1' || v.toLowerCase() === 'true';
    if (map.get('site_canonical_base')) base = map.get('site_canonical_base')!.replace(/\/+$/, '');
  } catch {
    /* defaults stand */
  }
  if (clean === '/blogs') {
    return {
      title: 'Blog — Weatherlink Web Console',
      description: 'Station setup guides, weather reading tips, and product updates.',
      keywords: 'weather station blog, WeatherLink guides, weather console tips',
      ogImage: '',
      canonical: `${base}/blogs`,
      twitter: '',
      indexable,
      siteName,
    };
  }
  const m = clean.match(/^\/post\/([a-z0-9-]+)$/i);
  if (!m) return null;
  const post = await getPublishedPost(env, m[1]!);
  if (!post) return null;
  const isoDate = new Date(post.publishAt || Date.now()).toISOString();
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        headline: post.title,
        description: post.excerpt || post.title,
        image: post.coverImageUrl || undefined,
        datePublished: isoDate,
        dateModified: isoDate,
        author: { '@type': 'Person', name: post.author || siteName },
        publisher: {
          '@type': 'Organization',
          name: siteName,
          logo: `${base}/apexs-logo.png`,
        },
        mainEntityOfPage: `${base}/post/${post.slug}`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${base}/blogs` },
          { '@type': 'ListItem', position: 3, name: post.title, item: `${base}/post/${post.slug}` },
        ],
      },
    ],
  });
  return {
    title: `${post.title} — WWebConsole Blog`,
    description: post.excerpt || post.title,
    keywords: post.tags.join(', '),
    ogImage: post.coverImageUrl || '',
    canonical: `${base}/post/${post.slug}`,
    twitter: '',
    indexable,
    siteName,
    jsonLd,
  };
}
