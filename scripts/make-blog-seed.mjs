#!/usr/bin/env node
/**
 * Generates migrations/0014_blog_seed.sql — 80 scheduled blog posts for 2026.
 * 16 topics × 5 angles, publish dates spread Jan 5 → Dec 28 2026.
 * Posts dated on/before 2026-09-17 seed as published, later ones as scheduled.
 * Covers resolve on demand via the Unsplash API (cover_query); no硬-coded URLs.
 *
 * Run: node scripts/make-blog-seed.mjs
 */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const DAY = 86400000;
const START = Date.UTC(2026, 0, 5);
const END = Date.UTC(2026, 11, 28);
const STEP = (END - START) / 79;
const LIVE_CUTOFF = Date.UTC(2026, 8, 17);

const TOPICS = [
  { name: 'station siting', cover: 'weather station', tags: 'setup,siting' },
  { name: 'reading your barometer', cover: 'storm clouds', tags: 'barometer,forecasting' },
  { name: 'winter station prep', cover: 'snow landscape', tags: 'winter,maintenance' },
  { name: 'rainfall accuracy', cover: 'rain drops', tags: 'rain,accuracy' },
  { name: 'wind sensor mounting', cover: 'wind', tags: 'wind,mounting' },
  { name: 'TV weather dashboards', cover: 'modern living room', tags: 'tv,dashboard' },
  { name: 'WeatherLink Pro vs Basic', cover: 'satellite dish', tags: 'weatherlink,plans' },
  { name: 'fixing data gaps', cover: 'cloudy sky', tags: 'troubleshooting,data' },
  { name: 'lightning safety', cover: 'lightning storm', tags: 'safety,storms' },
  { name: 'UV and solar sensors', cover: 'bright sun', tags: 'uv,solar' },
  { name: 'sharing data with neighbors', cover: 'suburban neighborhood', tags: 'sharing,community' },
  { name: 'seasonal station checklist', cover: 'autumn forest', tags: 'maintenance,seasonal' },
  { name: 'weather-driven home automation', cover: 'smart home', tags: 'automation,smart home' },
  { name: 'sunrise and sunset for gardeners', cover: 'garden sunrise', tags: 'sun,gardening' },
  { name: 'when your console goes offline', cover: 'wifi router', tags: 'troubleshooting,console' },
  { name: 'understanding dew point', cover: 'foggy morning', tags: 'humidity,dew point' },
];

const ANGLES = [
  {
    kind: 'How-to',
    title: (t) => `How to master ${t} with your home station`,
    excerpt: (t) => `A practical walkthrough for getting ${t} right, from unboxing to daily habit.`,
    body: (t, month) => [
      `${month} is a good time to get ${t} right. Small setup choices now pay off every day you glance at your console.`,
      `## Why it matters`,
      `Your station is only as useful as its weakest reading. When ${t} is handled well, every other number on the dashboard becomes easier to trust — temperature, wind, and rain all read cleaner.`,
      `## Practical tips`,
      `- Start with placement: give the sensor a full day in its spot before judging the numbers.`,
      `- Compare against a nearby reference for a week and note any steady offset.`,
      `- Recheck after the first storm; wind and water find every weak mount.`,
      `- Log changes in a notebook or your console notes so trends stay honest.`,
      `Open your console at /app and watch the relevant panel for a few days. Steady, believable numbers mean ${t} is dialed in.`,
    ],
  },
  {
    kind: 'Mistakes',
    title: (t) => `5 ${t} mistakes almost every station owner makes`,
    excerpt: (t) => `The most common ways ${t} goes wrong — and the five-minute fixes for each.`,
    body: (t, month) => [
      `As ${month} rolls in, here are the five ${t} mistakes we see most often from home station owners.`,
      `## The short list`,
      `- Measuring too close to walls, roofs, or concrete that skew the reading.`,
      `- Mounting low to "make it reachable" instead of where the weather actually happens.`,
      `- Never cleaning the sensor — dust and webs quietly bias every number.`,
      `- Changing two things at once, then not knowing which one helped.`,
      `- Ignoring the first odd week of data instead of investigating it.`,
      `## The fix`,
      `Pick one issue, fix it, and give the station a week. Your console history at /app makes before-and-after obvious, and that feedback loop is the whole hobby.`,
    ],
  },
  {
    kind: 'Checklist',
    title: (t) => `The ${t} checklist every station needs`,
    excerpt: (t) => `Print-friendly steps to audit ${t} in under an hour.`,
    body: (t, month) => [
      `Use this ${month} checklist to audit ${t} in a single afternoon.`,
      `## Walk the checklist`,
      `- [ ] Inspect the mount: tight, level, and clear of new obstructions.`,
      `- [ ] Clean the sensor face and check drains or vents for debris.`,
      `- [ ] Verify readings against a neighbor station or airport METAR.`,
      `- [ ] Confirm your console units and timezone are still what you expect.`,
      `- [ ] Update firmware or app settings you have been postponing.`,
      `## Done?`,
      `Finish by viewing a full day of graphs in your console. If the curves look smooth and physical, ${t} is in good shape until next season.`,
    ],
  },
  {
    kind: 'Explainer',
    title: (t) => `Why ${t} matters more than you think`,
    excerpt: (t) => `The science behind ${t}, explained without the jargon.`,
    body: (t, month) => [
      `${month} weather is a good reminder that ${t} is not trivia — it shapes comfort, safety, and planning.`,
      `## The idea in plain language`,
      `Every reading your station reports is a small physics story. When you understand ${t}, sudden jumps stop looking like glitches and start looking like information: a front arriving, a shadow passing, a season turning.`,
      `## What to watch`,
      `- The direction of change matters more than the absolute number.`,
      `- Rate of change tells you how fast conditions are evolving.`,
      `- Overnight lows and afternoon highs frame the whole day.`,
      `- Week-over-week comparison beats day-to-day noise.`,
      `Keep the TV dashboard up in the living room and narrate the weather to your household. Understanding ${t} turns a gadget into a habit.`,
    ],
  },
  {
    kind: 'Seasonal',
    title: (t) => `${t} through the seasons: a month-by-month view`,
    excerpt: (t) => `How ${t} shifts across the year and when to act on it.`,
    body: (t, month) => [
      `Starting this ${month}, track how ${t} behaves as the year turns. Each season stresses your station differently.`,
      `## Spring and summer`,
      `Growth, heat, and storms are the themes. Vegetation creeps toward sensors, heat radiates off surfaces, and every thunderstorm tests your mounts. Inspect monthly.`,
      `## Autumn and winter`,
      `Leaves clog, daylight shrinks, and frost finds weak batteries. This is maintenance season: clean, tighten, and confirm heating or drainage where your hardware needs it.`,
      `## Your rhythm`,
      `Put two reminders on the calendar — one at each equinox — to walk the full station. Ten minutes twice a year keeps ${t} honest all year, and your console graphs will prove it.`,
    ],
  },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => s.replace(/'/g, "''");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const rows = [];
let i = 0;
for (const topic of TOPICS) {
  for (const angle of ANGLES) {
    const title = angle.title(topic.name);
    const publishAt = Math.round(START + i * STEP);
    const month = MONTHS[new Date(publishAt).getUTCMonth()];
    const status = publishAt <= LIVE_CUTOFF ? 'published' : 'scheduled';
    const body = angle.body(topic.name, month).join('\n\n');
    const excerpt = angle.excerpt(topic.name);
    rows.push({
      id: randomUUID(),
      slug: slugify(`${title}-2026`),
      title,
      excerpt,
      body,
      cover: topic.cover,
      tags: `${topic.tags},${angle.kind.toLowerCase()}`,
      status,
      publishAt,
    });
    i++;
  }
}

// Chronological order so the calendar reads naturally.
rows.sort((a, b) => a.publishAt - b.publishAt);

const out = [
  '-- 2026 blog calendar: 80 posts (16 topics × 5 angles). Covers resolve via Unsplash API on demand.',
  ...rows.map(
    (r) =>
      `INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, cover_query, cover_alt, status, publish_at, author, tags, created_at, updated_at) VALUES ('${r.id}', '${esc(r.slug)}', '${esc(r.title)}', '${esc(r.excerpt)}', '${esc(r.body)}', '', '${esc(r.cover)}', '${esc(r.title)}', '${r.status}', ${r.publishAt}, 'WWebConsole', '${esc(r.tags)}', ${r.publishAt}, ${r.publishAt}) ON CONFLICT(slug) DO NOTHING;`
  ),
].join('\n');

writeFileSync(new URL('../migrations/0014_blog_seed.sql', import.meta.url), out + '\n');
const pub = rows.filter((r) => r.status === 'published').length;
console.log(`wrote 80 posts (${pub} published, ${80 - pub} scheduled), ${new Date(rows[0].publishAt).toISOString().slice(0, 10)} → ${new Date(rows[79].publishAt).toISOString().slice(0, 10)}`);
