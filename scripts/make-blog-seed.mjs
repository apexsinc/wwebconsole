#!/usr/bin/env node
/**
 * Generates migrations/0014_blog_seed.sql — 80 long-form blog posts for 2026.
 * 16 topics × 5 angles, ~550 words each: hook opener, two deep sections,
 * topic field notes, practical playbook, FAQ (SEO snippets), related
 * internal links, and a console CTA. Publish dates spread Jan 5 → Dec 28 2026.
 * Posts dated on/before 2026-09-17 seed as published, later ones as scheduled.
 * Covers resolve on demand via the Unsplash API (cover_query).
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
  { name: 'station siting', cover: 'weather station', tags: 'setup,siting',
    stat: 'Moving a temperature sensor just 3 m off a sun-baked wall can cut afternoon bias by 1–2 °C.',
    example: 'A driveway-side sensor screaming 38 °C while the shaded backyard reads an honest 35 °C.',
    watch: 'New fences, sheds, and fast-growing hedges silently change a sensor\'s exposure.' },
  { name: 'reading your barometer', cover: 'storm clouds', tags: 'barometer,forecasting',
    stat: 'A drop of 3+ hPa in three hours often means a front arrives within 6–12 hours.',
    example: '29.85 inHg and falling fast on a gray, heavy afternoon.',
    watch: 'Compare sea-level readings only — station pressure and sea-level pressure tell different stories.' },
  { name: 'winter station prep', cover: 'snow landscape', tags: 'winter,maintenance',
    stat: 'Alkaline batteries can lose half their capacity below −10 °C; lithium keeps going.',
    example: 'A rain cone frozen solid after an overnight ice storm, flatlining the rain graph.',
    watch: 'Inspect at the first freeze, the first heavy snow, and the first thaw.' },
  { name: 'rainfall accuracy', cover: 'rain drops', tags: 'rain,accuracy',
    stat: 'A gauge sitting just 1° off level can under-read a heavy downpour by 5–10%.',
    example: '0.42 in on the console versus 0.50 in caught in a manual tube beside it.',
    watch: 'Spider webs and leaf litter in the funnel are the usual suspects.' },
  { name: 'wind sensor mounting', cover: 'wind', tags: 'wind,mounting',
    stat: 'In open terrain, wind speed roughly doubles between 2 m and 10 m height.',
    example: 'A rooftop eddy making every gust read 8 mph hotter than the street below.',
    watch: 'Chimney turbulence and swaying mounts invent gusts that never happened.' },
  { name: 'TV weather dashboards', cover: 'modern living room', tags: 'tv,dashboard',
    stat: 'A 15-second refresh keeps a lobby display feeling alive without hammering the API.',
    example: 'A reception TV showing live station data next to the morning briefing board.',
    watch: 'Static OLEDs can burn in — enable pixel shift and let the ticker rotate.' },
  { name: 'WeatherLink Pro vs Basic', cover: 'satellite dish', tags: 'weatherlink,plans',
    stat: 'Pro stations can update every few minutes; Basic typically lands around 15-minute intervals.',
    example: 'Watching a gust front arrive in near-real time instead of reading about it later.',
    watch: 'Faster polling only matters if the mount itself is honest.' },
  { name: 'fixing data gaps', cover: 'cloudy sky', tags: 'troubleshooting,data',
    stat: 'Most gaps trace to three causes: power, connectivity, or credentials.',
    example: 'A flatline every night at 2 a.m. — the router rebooting on schedule.',
    watch: 'Note the exact start time of every gap. Patterns diagnose themselves.' },
  { name: 'lightning safety', cover: 'lightning storm', tags: 'safety,storms',
    stat: 'Flash-to-bang under 30 seconds means shelter now; wait 30 minutes after the last thunder.',
    example: 'A strike counter jumping twice during one angry July cell.',
    watch: 'Never mount or service hardware while activity is nearby. No reading is worth the risk.' },
  { name: 'UV and solar sensors', cover: 'bright sun', tags: 'uv,solar',
    stat: 'UV index 3+ burns fair skin in under an hour; at 8+ it takes about 15 minutes.',
    example: 'A June noon spike to UVI 9 on a deceptively breezy, clear day.',
    watch: 'Clean sensor domes monthly — haze on the dome reads as cloud in the sky.' },
  { name: 'sharing data with neighbors', cover: 'suburban neighborhood', tags: 'sharing,community',
    stat: 'One well-sited station can serve a whole street\'s curiosity.',
    example: 'Texting the neighborhood group when frost threatens everyone\'s tomatoes.',
    watch: 'Share the dashboard link widely; never share your account credentials.' },
  { name: 'seasonal station checklist', cover: 'autumn forest', tags: 'maintenance,seasonal',
    stat: 'Two ten-minute inspections a year prevent most surprise station failures.',
    example: 'An equinox walk-around with a screwdriver, a cloth, and your phone for photos.',
    watch: 'Growth in spring, leaves in fall, ice in winter — each season attacks differently.' },
  { name: 'weather-driven home automation', cover: 'smart home', tags: 'automation,smart home',
    stat: 'Retracting awnings when gusts pass 25 mph saves fabric, frames, and repair bills.',
    example: 'Sprinklers skipping a cycle on their own after 0.3 in of overnight rain.',
    watch: 'Always keep a manual override. Automation should assist, never trap.' },
  { name: 'sunrise and sunset for gardeners', cover: 'garden sunrise', tags: 'sun,gardening',
    stat: 'Day length swings by hours across the year — planting calendars depend on it.',
    example: 'Last-frost seedlings timed to lengthening days instead of guesswork.',
    watch: 'Hills and tall trees shift your true sunrise by minutes. Observe your own plot.' },
  { name: 'when your console goes offline', cover: 'wifi router', tags: 'troubleshooting,console',
    stat: 'Nine times in ten it is local: power, Wi-Fi, or an expired credential.',
    example: 'The app showing yesterday\'s data the morning after a password change.',
    watch: 'Check the top-bar connection status before touching any hardware.' },
  { name: 'understanding dew point', cover: 'foggy morning', tags: 'humidity,dew point',
    stat: 'Dew point above 18 °C feels muggy to most people; above 21 °C feels oppressive.',
    example: 'A sticky 24 °C evening with the dew point parked at 22 °C.',
    watch: 'Fog forms when the temperature falls to meet the dew point — watch the gap close.' },
];

const HOOKS = [
  (t, month) => `Here's the thing nobody tells you about ${t}: it quietly decides whether the rest of your station data is gold or garbage. This ${month}, let's get it right once and enjoy trustworthy numbers all year.`,
  (t, month) => `If your weather numbers have ever felt "off" and you couldn't say why, ${t} is the first place to look. Pour a coffee — this ${month} guide will turn confusion into confidence.`,
  (t, month) => `Ask ten station owners about ${t} and you'll hear ten half-answers. This ${month}, here is the full answer: what matters, what doesn't, and the exact steps that work.`,
  (t, month) => `Your station already collects the data. Understanding ${t} is what turns those numbers into decisions — about storms, gardens, gear, and weekends. Let's make this ${month} the month it clicks.`,
  (t, month) => `Small detail, huge payoff: ${t} is one of those topics where an hour of attention returns years of better readings. Here's the ${month} playbook, no jargon required.`,
];

const ANGLES = [
  {
    kind: 'How-to',
    title: (t) => `How to master ${t} with your home station`,
    excerpt: (t) => `A practical walkthrough for getting ${t} right, from first setup to daily habit.`,
    secA: 'Start where you are',
    bodyA: (t) => `Forget perfection on day one. The secret to ${t} is iteration: make one thoughtful change, watch your console for a full week, then decide what is next. Your station keeps the history, so every experiment teaches you something permanent. Most owners try to fix everything in a single Saturday and end up unsure what actually helped. Resist that. One variable at a time is the fastest route to numbers you trust, because each improvement is proven by the graph before you move on.`,
    secB: 'Build the daily habit',
    bodyB: (t) => `Once the basics are set, ${t} becomes a two-minute glance, not a project. Check the same panel at the same time each day — morning coffee works for most people — and you will develop an instinct for what "normal" looks like on your console. That instinct is the real product here. When something drifts, you will feel it before you can articulate it, and a quick look at the week's curve will confirm whether it is weather or hardware.`,
  },
  {
    kind: 'Mistakes',
    title: (t) => `5 ${t} mistakes almost every station owner makes`,
    excerpt: (t) => `The most common ways ${t} goes wrong — and the five-minute fixes for each.`,
    secA: 'The classics',
    bodyA: (t) => `First, the placement trap: sensors tucked where they are convenient instead of where the weather happens — beside walls, under eaves, above concrete. Second, the "set and forget" trap: mounts loosen, vegetation grows, and nobody looks for a year. Third, the double-change trap: adjusting two things at once, then having no idea which one mattered. Fourth, ignoring the ugly first week of data instead of treating it as a free diagnostic. Fifth, comparing against the wrong reference — a station five streets over in a different microclimate.`,
    secB: 'Fix them in one afternoon',
    bodyB: (t) => `Here is the good news: every one of these has a short fix. Walk the mount with fresh eyes and a spirit level. Clean anything that looks dusty. Change exactly one thing, then let a full week of ${t} data accumulate before judging. Pull up a nearby airport METAR or a trusted neighbor station for comparison, but weight your own history heaviest — your console at /app remembers every season your station has lived through, and that context beats any single outside number.`,
  },
  {
    kind: 'Checklist',
    title: (t) => `The ${t} walkthrough every station needs`,
    excerpt: (t) => `A printable-style audit for ${t} you can finish in under an hour.`,
    secA: 'Before you touch anything',
    bodyA: (t) => `Screenshot today's readings first — that "before" picture is what makes the checklist satisfying. Then gather the whole job into one trip: a cloth, a screwdriver, your phone for photos, and the login for your console. Working through ${t} systematically beats heroic troubleshooting every time, because most station problems are boring: something loose, something dirty, something grown-over. The checklist below finds all three in under an hour.`,
    secB: 'After the walk-through',
    bodyB: (t) => `Resist the urge to declare victory immediately. The honest verdict on ${t} arrives after a week of ordinary weather has flowed through the fixed setup. Watch for smooth, physical-looking curves on your graphs rather than step-changes or flat spots. If a number still looks suspicious, you now have dated photos and notes to compare against — that paper trail turns the next round of troubleshooting from archaeology into a five-minute review.`,
  },
  {
    kind: 'Explainer',
    title: (t) => `Why ${t} matters more than you think`,
    excerpt: (t) => `The science behind ${t}, explained without the jargon.`,
    secA: 'The idea in plain language',
    bodyA: (t) => `Every number your station reports is a small physics story, and ${t} is one of the chapters most people skip. The short version: your sensors sample a chaotic atmosphere from a single point, so context is everything. A temperature means little without knowing the sun exposure; a gust means little without knowing the mount height. Once you see ${t} as context rather than trivia, sudden jumps stop looking like glitches and start reading like information — a front arriving, a shadow passing, a season turning.`,
    secB: 'How to read it like a forecaster',
    bodyB: (t) => `Forecasters think in change, not snapshots, and you can too. Watch the direction of ${t} first: rising, falling, or steady tells you more than any single value. Then watch the rate — fast moves mean active weather, slow drifts mean settled patterns. Compare this week to last week rather than today to yesterday; day-to-day noise lies, but week-over-week rhythm tells the truth. Keep the TV dashboard up in the living room and narrate it to your household. That daily two-minute habit builds more intuition than any manual.`,
  },
  {
    kind: 'Seasonal',
    title: (t) => `${t} through the seasons: a month-by-month view`,
    excerpt: (t) => `How ${t} shifts across the year, and exactly when to act on it.`,
    secA: 'Spring and summer pressure',
    bodyA: (t) => `Warm months attack ${t} with growth, heat, and violence. Vegetation creeps toward sensors week by week, heat radiates off every sun-baked surface, and each thunderstorm stress-tests your mounts. This is inspection season: walk the station monthly, trim what grew, tighten what shook loose, and clean what the storms splattered. Summer data is only as good as the hardware surviving it, and an hour a month is cheap insurance against a season of subtly wrong numbers.`,
    secB: 'Autumn and winter pressure',
    bodyB: (t) => `Cold months attack differently: leaves clog, daylight shrinks, frost finds weak batteries, and ice loads test every bracket. Shift ${t} into maintenance mode — clean drainage paths before the first freeze, confirm power margins before the darkest weeks, and photograph everything so spring-you can see what winter did. Put two reminders on the calendar, one at each equinox, and honor them. Ten minutes twice a year keeps ${t} honest all year, and your console graphs will quietly prove it.`,
  },
];

const PLAYBOOKS = {
  'How-to': [
    'Give every change a full week of data before judging it — weather needs a large sample.',
    'Screenshot "before" readings so improvements are visible, not vibes.',
    'Compare against one trusted reference, but trust your own history most.',
    'Recheck everything after the first real storm; wind and water find weak mounts.',
    'Write down what you changed and when — future-you will be grateful.',
  ],
  Mistakes: [
    'Fix one thing at a time so you always know what worked.',
    'Move sensors to where the weather happens, not where the ladder reaches.',
    'Clean on a schedule, not when numbers already look wrong.',
    'Keep a dated photo log of mounts and exposure.',
    'Treat the first odd week of data as a free diagnostic, not a failure.',
  ],
  Checklist: [
    'Inspect mounts: tight, level, and clear of anything that grew this season.',
    'Clean sensor faces, vents, and drainage paths.',
    'Verify against a neighbor station or airport METAR.',
    'Confirm console units, timezone, and alert thresholds.',
    'Update any firmware or settings you have been postponing.',
  ],
  Explainer: [
    'Watch direction of change first, absolute value second.',
    'Rate of change tells you how fast conditions are evolving.',
    'Compare week-over-week, not day-to-day.',
    'Learn your overnight lows and afternoon highs as anchors.',
    'Narrate the dashboard daily — teaching cements the intuition.',
  ],
  Seasonal: [
    'Monthly walk in storm season; equinox deep-checks twice a year.',
    'Trim vegetation before it touches anything.',
    'Pre-winter: batteries, drainage, and bracket tightness.',
    'Pre-summer: heat exposure, shade creep, and storm readiness.',
    'Photograph every inspection for year-over-year comparison.',
  ],
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const esc = (s) => s.replace(/'/g, "''");
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const rows = [];
let i = 0;
for (const topic of TOPICS) {
  const t = topic.name;
  const siblings = ANGLES.map((a) => slugify(`${a.title(t)}-2026`));
  ANGLES.forEach((angle, ai) => {
    const title = angle.title(t);
    const publishAt = Math.round(START + i * STEP);
    const month = MONTHS[new Date(publishAt).getUTCMonth()];
    const status = publishAt <= LIVE_CUTOFF ? 'published' : 'scheduled';
    const hook = HOOKS[i % HOOKS.length](t, month);
    const keep = [siblings[(ai + 1) % 5], siblings[(ai + 3) % 5]];
    const body = [
      hook,
      `## ${angle.secA}`,
      angle.bodyA(t),
      `## Field notes: ${t}`,
      `**By the numbers:** ${topic.stat}`,
      `**Picture this:** ${topic.example}`,
      `**Watch out for:** ${topic.watch}`,
      `## ${angle.secB}`,
      angle.bodyB(t),
      `## Your practical playbook`,
      ...PLAYBOOKS[angle.kind].map((b) => `- ${b}`),
      `## Quick answers`,
      `**How often should I check this?** Weekly glances catch drift early; deep audits twice a year at the equinoxes keep ${t} honest long-term.`,
      `**Do I need new hardware?** Almost never at first. Nine times in ten, ${t} improves with placement, cleaning, and patience — not purchases.`,
      `**Where do I watch the results?** Your [live console](/app) keeps every reading and trend in one place, and a [TV dashboard](/app) makes the whole household weather-aware.`,
      `## Keep reading`,
      `Continue with [${angleLabel(ANGLES[(ai + 1) % 5], t)}](/post/${keep[0]}) or [${angleLabel(ANGLES[(ai + 3) % 5], t)}](/post/${keep[1]}), or browse all [station guides](/blogs).`,
      `Ready to see your own numbers? Open your [weather console](/app) — and if you are still on the free trial, [see Pro pricing](/pricing) to keep every station updating.`,
    ].join('\n\n');
    rows.push({
      id: randomUUID(),
      slug: slugify(`${title}-2026`),
      title,
      excerpt: angle.excerpt(t),
      body,
      cover: topic.cover,
      tags: `${topic.tags},${angle.kind.toLowerCase()}`,
      status,
      publishAt,
    });
    i++;
  });
}

function angleLabel(angle, t) {
  return angle.title(t);
}

// Chronological order so the calendar reads naturally.
rows.sort((a, b) => a.publishAt - b.publishAt);

const out = [
  '-- 2026 blog calendar: 80 long-form posts (16 topics × 5 angles). Covers resolve via Unsplash API on demand.',
  ...rows.map(
    (r) =>
      `INSERT INTO blog_posts (id, slug, title, excerpt, body, cover_image_url, cover_query, cover_alt, status, publish_at, author, tags, created_at, updated_at) VALUES ('${r.id}', '${esc(r.slug)}', '${esc(r.title)}', '${esc(r.excerpt)}', '${esc(r.body)}', '', '${esc(r.cover)}', '${esc(r.title)}', '${r.status}', ${r.publishAt}, 'WWebConsole', '${esc(r.tags)}', ${r.publishAt}, ${r.publishAt}) ON CONFLICT(slug) DO UPDATE SET title=excluded.title, excerpt=excluded.excerpt, body=excluded.body, cover_query=excluded.cover_query, tags=excluded.tags, status=excluded.status, publish_at=excluded.publish_at, updated_at=excluded.updated_at;`
  ),
].join('\n');

writeFileSync(new URL('../migrations/0014_blog_seed.sql', import.meta.url), out + '\n');
const pub = rows.filter((r) => r.status === 'published').length;
const words = Math.round(rows.reduce((n, r) => n + r.body.split(/\s+/).length, 0) / rows.length);
console.log(`wrote 80 posts (~${words} words avg, ${pub} published, ${80 - pub} scheduled)`);
