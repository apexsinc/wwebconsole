/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Public blog: /blogs list and /post/:slug article.
 */
import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useSpring } from 'motion/react';
import { CalendarDays, Tag, ArrowLeft, ArrowRight } from 'lucide-react';
import { MarkdownLite, usePageSeo } from './MarketingPages.js';
import type { PublicSiteConfig } from '../services/api.js';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  coverQuery: string | null;
  coverAlt: string;
  publishAt: number;
  author: string | null;
  tags: string[];
};

type Ctx = { site: PublicSiteConfig | null };

function formatDate(ms: number) {
  try {
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

function Cover({ post, large }: { post: BlogPost; large?: boolean }) {
  const src = post.coverImageUrl || `/api/public/blog/cover/${encodeURIComponent(post.slug)}`;
  const [failed, setFailed] = useState(false);
  if (failed || (!post.coverImageUrl && !post.coverQuery)) {
    return (
      <div
        aria-hidden="true"
        className={`w-full ${large ? 'h-64 sm:h-96' : 'h-44'} rounded-2xl bg-gradient-to-br from-[#073075] via-[#0a3f99] to-sky-500 flex items-center justify-center`}
      >
        <span className="font-[family-name:var(--font-display)] text-white/80 font-black text-2xl tracking-tight px-6 text-center">
          {post.title}
        </span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={post.coverAlt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`w-full ${large ? 'h-64 sm:h-96' : 'h-44'} object-cover rounded-2xl border border-slate-200 dark:border-white/10`}
    />
  );
}

export function BlogListPage() {
  const { site } = useOutletContext<Ctx>();
  usePageSeo(site, 'seo_home_title', 'seo_home_description', '/blogs', 'Blog — Weatherlink Web Console', 'Station guides and product updates.');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const LIMIT = 12;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/public/blog?limit=${LIMIT}&offset=${offset}`)
      .then((r) => r.json() as Promise<{ posts?: BlogPost[]; total?: number }>)
      .then((d) => {
        if (cancelled) return;
        setPosts(d.posts || []);
        setTotal(d.total || 0);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-64px)] pb-24 transition-colors">
      <div className="bg-gradient-to-b from-sky-50/80 to-white dark:from-[#020b18] dark:to-slate-950 border-b border-sky-100/60 dark:border-white/5">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h1 className="font-[family-name:var(--font-display)] text-5xl sm:text-6xl font-black text-[#020b18] dark:text-white tracking-tight">
            Blog
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-4 text-lg font-medium">
            Station setup guides, weather reading tips, and product updates.
          </p>
        </div>
      </div>
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-12">
        {loading && posts.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="Loading posts">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10 overflow-hidden">
                <div className="h-44 bg-slate-200 dark:bg-slate-800 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-slate-500 dark:text-slate-400 font-medium py-16">No posts yet — check back soon.</p>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((p) => (
                <Link
                  key={p.id}
                  to={`/post/${p.slug}`}
                  className="group rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10 overflow-hidden hover:shadow-[0_20px_40px_rgba(7,48,117,0.08)] hover:-translate-y-1 transition-all"
                >
                  <Cover post={p} />
                  <div className="p-5">
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                      {p.title}
                    </h2>
                    {p.excerpt && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{p.excerpt}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {formatDate(p.publishAt)}
                      {p.author && <span className="ml-1">· {p.author}</span>}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-10 flex items-center justify-center gap-3">
              <button
                disabled={offset === 0}
                onClick={() => {
                  setOffset(Math.max(0, offset - LIMIT));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold disabled:opacity-40 min-h-[44px]"
              >
                <ArrowLeft className="w-4 h-4" /> Newer
              </button>
              <span className="text-sm text-slate-500 font-medium">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => {
                  setOffset(offset + LIMIT);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-bold disabled:opacity-40 min-h-[44px]"
              >
                Older <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export function BlogPostPage() {
  const { site } = useOutletContext<Ctx>();
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [missing, setMissing] = useState(false);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25 });
  usePageSeo(site, 'seo_home_title', 'seo_home_description', `/post/${slug || ''}`, post?.title || 'Post', post?.excerpt || '');

  useEffect(() => {
    document.title = post ? `${post.title} — WWebConsole Blog` : 'Post — WWebConsole Blog';
    // JSON-LD Article schema for SEO.
    const id = 'wwc-blog-jsonld';
    document.getElementById(id)?.remove();
    if (post) {
      const s = document.createElement('script');
      s.id = id;
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt,
        datePublished: new Date(post.publishAt).toISOString(),
        author: { '@type': 'Organization', name: post.author || 'WWebConsole' },
        image: post.coverImageUrl || undefined,
        mainEntityOfPage: `https://wwebconsole.com/post/${post.slug}`,
      });
      document.head.appendChild(s);
    }
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [post]);

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    setRelated([]);
    setMissing(false);
    fetch(`/api/public/blog/${encodeURIComponent(slug || '')}`)
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) setMissing(true);
          return null;
        }
        return r.json() as Promise<{ post?: BlogPost }>;
      })
      .then((d) => {
        if (!cancelled && d?.post) {
          setPost(d.post);
          fetch(`/api/public/blog/${encodeURIComponent(slug || '')}/related`)
            .then((r) => r.json() as Promise<{ posts?: BlogPost[] }>)
            .then((rel) => {
              if (!cancelled) setRelated(rel.posts || []);
            })
            .catch(() => undefined);
        }
        else if (!cancelled && d) setMissing(true);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white">Post not found</h1>
        <p className="text-slate-500 mt-3">It may be scheduled for a future date or removed.</p>
        <Link to="/blogs" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-sky-600 text-white text-sm font-bold min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 space-y-4" aria-label="Loading post">
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-5/6" />
      </div>
    );
  }

  return (
    <article className="bg-slate-50 dark:bg-slate-950 min-h-[calc(100vh-64px)] pb-24">
      {!reduceMotion && (
        <motion.div
          aria-hidden="true"
          style={{ scaleX: progress }}
          className="fixed top-0 left-0 right-0 h-1 origin-left bg-gradient-to-r from-sky-600 to-sky-400 z-[100]"
        />
      )}
      <main id="main-content" className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/blogs" className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-700 dark:text-sky-300 min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> All posts
        </Link>
        <h1 className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight mt-4">
          {post.title}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-2 flex-wrap">
          <CalendarDays className="w-4 h-4" />
          {formatDate(post.publishAt)}
          {post.author && <span>· {post.author}</span>}
          {post.tags.length > 0 && (
            <span className="inline-flex items-center gap-1.5 ml-1">
              <Tag className="w-3.5 h-3.5" />
              {post.tags.join(', ')}
            </span>
          )}
        </p>
        <div className="mt-6">
          <Cover post={post} large />
        </div>
        {post.excerpt && (
          <p className="text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed mt-6">{post.excerpt}</p>
        )}
        <div className="mt-6 bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
          <MarkdownLite text={post.body} large />
        </div>

        {related.length > 0 && (
          <motion.section
            aria-label="Related posts"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5 }}
            className="mt-12"
          >
            <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Keep reading
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Related guides from the station blog.</p>
            <div className="mt-6 grid sm:grid-cols-3 gap-5">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/post/${r.slug}`}
                  className="group rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-white/10 overflow-hidden hover:shadow-[0_20px_40px_rgba(7,48,117,0.08)] hover:-translate-y-1 transition-all"
                >
                  <Cover post={r} />
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 dark:text-white leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                      {r.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(r.publishAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.section>
        )}
      </main>
    </article>
  );
}
