/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin Blog tab: list, create/edit, schedule, cover images.
 */
import { FormEvent, useEffect, useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  AdminBlogPost,
  adminCreateBlog,
  adminDeleteBlog,
  adminFetchBlogCover,
  adminListBlog,
  adminUpdateBlog,
} from '../services/api.js';

const EMPTY = { title: '', slug: '', excerpt: '', body: '', coverQuery: '', coverAlt: '', status: 'draft', publishAt: '', author: '', tags: '' };

function toDateInput(ms: number) {
  try {
    const d = new Date(ms);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export default function BlogAdmin({ notify, error }: { notify: (msg: string) => void; error: (msg: string) => void }) {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverBusy, setCoverBusy] = useState('');

  const load = async () => {
    try {
      const res = await adminListBlog();
      setPosts(res.posts || []);
    } catch (e: any) {
      error(e.message || 'Failed to load posts');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = posts.filter(
    (p) =>
      !filter ||
      p.status === filter ||
      p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.slug.includes(filter.toLowerCase())
  );

  const statusBadge = (p: AdminBlogPost) => {
    const scheduled = p.publishAt > Date.now();
    const label = p.status === 'published' && scheduled ? 'scheduled' : p.status;
    const cls =
      label === 'published'
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
        : label === 'scheduled'
        ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25'
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/25';
    return <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${cls}`}>{label}</span>;
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: editing.title.trim(),
        excerpt: editing.excerpt,
        body: editing.body,
        coverQuery: editing.coverQuery,
        coverAlt: editing.coverAlt,
        status: editing.status,
        author: editing.author,
        tags: editing.tags,
      };
      if (editing.slug.trim()) payload.slug = editing.slug.trim().toLowerCase();
      if (editing.publishAt) payload.publishAt = new Date(editing.publishAt).getTime();
      if (editing.id) {
        await adminUpdateBlog(editing.id, payload);
        notify('Post updated');
      } else {
        await adminCreateBlog(payload);
        notify('Post created');
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (p: AdminBlogPost) => {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    try {
      await adminDeleteBlog(p.id);
      notify('Post deleted');
      await load();
    } catch (err: any) {
      error(err.message || 'Delete failed');
    }
  };

  const onCover = async (p: AdminBlogPost) => {
    setCoverBusy(p.id);
    try {
      await adminFetchBlogCover(p.id, undefined, true);
      notify('Cover fetched');
      await load();
    } catch (err: any) {
      error(err.message || 'Cover fetch failed. Set PIXABAY_API_KEY first.');
    } finally {
      setCoverBusy('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-xs">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by status, title, or slug…"
          className="flex-1 min-w-[200px] bg-slate-50 dark:bg-[#070a11] border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-sm outline-none"
        />
        <span className="text-xs text-slate-500 font-medium">{posts.length} posts</span>
        <a
          href="/blogs"
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl min-h-[44px] inline-flex items-center"
        >
          View /blogs
        </a>
        <button
          onClick={() => setEditing({ ...EMPTY, publishAt: toDateInput(Date.now()) })}
          className="px-4 py-2.5 text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl min-h-[44px] inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> New post
        </button>
      </div>

      <div className="bg-white dark:bg-[#0e1320] border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-[#090d16] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-xs font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Post</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Publish date</th>
                <th className="px-6 py-4">Cover</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {shown.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{p.title}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">/post/{p.slug}</div>
                  </td>
                  <td className="px-6 py-4">{statusBadge(p)}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {new Date(p.publishAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    {p.coverImageUrl ? (
                      <img src={p.coverImageUrl} alt="" className="w-16 h-10 object-cover rounded-lg border border-slate-200 dark:border-slate-700" loading="lazy" />
                    ) : (
                      <span className="text-xs text-slate-400">none{ p.coverQuery ? ` (${p.coverQuery})` : ''}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onCover(p)}
                        disabled={coverBusy === p.id}
                        title="Fetch cover"
                        aria-label={`Fetch cover for ${p.title}`}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
                      >
                        <ImagePlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setEditing({
                            id: p.id,
                            title: p.title,
                            slug: p.slug,
                            excerpt: p.excerpt,
                            body: p.body,
                            coverQuery: p.coverQuery || '',
                            coverAlt: p.coverAlt,
                            status: p.status,
                            publishAt: toDateInput(p.publishAt),
                            author: p.author || '',
                            tags: p.tags.join(', '),
                          })
                        }
                        title="Edit post"
                        aria-label={`Edit ${p.title}`}
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(p)}
                        title="Delete post"
                        aria-label={`Delete ${p.title}`}
                        className="p-2.5 rounded-lg text-rose-600 dark:text-rose-400 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No posts yet</p>
                    <p className="text-xs text-slate-500 mt-1">Create the first post, or run the 2026 seed below.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Blog post editor" className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form onSubmit={onSave} className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h2 className="font-bold text-lg">{editing.id ? 'Edit post' : 'New post'}</h2>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close editor" className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Title
                <input value={editing.title} onChange={(e) => setEditing({ ...editing!, title: e.target.value })} required minLength={3} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Slug (optional)
                <input value={editing.slug} onChange={(e) => setEditing({ ...editing!, slug: e.target.value })} placeholder="auto-from-title" className="rounded-xl border px-4 py-3 text-sm font-mono font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Publish date
                <input type="datetime-local" value={editing.publishAt} onChange={(e) => setEditing({ ...editing!, publishAt: e.target.value })} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Excerpt
                <textarea value={editing.excerpt} onChange={(e) => setEditing({ ...editing!, excerpt: e.target.value })} rows={2} maxLength={400} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10" />
              </label>
              <label className="sm:col-span-2 flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Body (markdown)
                <textarea value={editing.body} onChange={(e) => setEditing({ ...editing!, body: e.target.value })} rows={10} className="rounded-xl border px-4 py-3 text-sm font-mono font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Status
                <select value={editing.status} onChange={(e) => setEditing({ ...editing!, status: e.target.value })} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Author
                <input value={editing.author} onChange={(e) => setEditing({ ...editing!, author: e.target.value })} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Cover query
                <input value={editing.coverQuery} onChange={(e) => setEditing({ ...editing!, coverQuery: e.target.value })} placeholder="e.g. thunderstorm" className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wider">
                Tags (comma separated)
                <input value={editing.tags} onChange={(e) => setEditing({ ...editing!, tags: e.target.value })} className="rounded-xl border px-4 py-3 text-sm font-normal normal-case tracking-normal bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 min-h-[44px]" />
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="px-5 py-2.5 text-sm font-semibold rounded-xl min-h-[44px]">Cancel</button>
              <button type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white rounded-xl min-h-[44px] disabled:opacity-50">
                {saving ? 'Saving…' : editing.id ? 'Save changes' : 'Create post'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
