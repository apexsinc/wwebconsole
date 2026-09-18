-- Blog cover attribution (photographer credit for CDN-hosted covers).
ALTER TABLE blog_posts ADD COLUMN cover_credit TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN cover_page_url TEXT NOT NULL DEFAULT '';
