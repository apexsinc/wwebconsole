import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = 'auto' | Theme;

const THEME_KEY = 'wwc_theme';
const MODE_KEY = 'wwc_theme_mode';

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return 'light';
}

/** Display mode: 'auto' follows the station sun, explicit pins the theme.
 *  Users with a stored explicit theme keep it; everyone else gets auto. */
export function getStoredThemeMode(): ThemeMode {
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === 'auto' || m === 'light' || m === 'dark') return m;
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark' || t === 'light') return t;
  } catch {
    /* ignore */
  }
  return 'auto';
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

function parseDayMinutes(t: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)\s*$/i.exec(t || '');
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

function nowMinutesIn(timeZone?: string): number {
  try {
    if (timeZone) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      }).formatToParts(new Date());
      const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
      return get('hour') % 24 * 60 + get('minute');
    }
  } catch {
    /* fall through to local */
  }
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** True when the station is in daylight. Pure + unit-testable. */
export function isDaytime(sunrise: string, sunset: string, timeZone?: string, nowMin?: number): boolean {
  const rise = parseDayMinutes(sunrise);
  const set = parseDayMinutes(sunset);
  if (rise === null || set === null || set <= rise) return true;
  const now = nowMin ?? nowMinutesIn(timeZone);
  return now >= rise && now < set;
}

export function useTheme(sun?: { sunrise: string; sunset: string; timeZone?: string }) {
  const [mode, setModeState] = useState<ThemeMode>(() =>
    typeof document !== 'undefined' ? getStoredThemeMode() : 'auto'
  );
  const [autoDay, setAutoDay] = useState(true);

  const rise = sun?.sunrise;
  const set = sun?.sunset;
  const tz = sun?.timeZone;

  useEffect(() => {
    if (mode !== 'auto') {
      applyTheme(mode);
      return;
    }
    // Auto without sun data must not fight sun-aware surfaces: leave the
    // document class alone (marketing/admin pages, navbars without context).
    if (!rise || !set) return;
    const resolve = () => {
      const day = isDaytime(rise, set, tz);
      setAutoDay(day);
      applyTheme(day ? 'light' : 'dark');
    };
    resolve();
    const id = window.setInterval(resolve, 60_000);
    return () => window.clearInterval(id);
  }, [mode, rise, set, tz]);

  const theme: Theme = mode === 'auto' ? (autoDay ? 'light' : 'dark') : mode;

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
    if (m !== 'auto') applyTheme(m);
  };
  const cycleTheme = () =>
    setMode(mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto');
  // Legacy explicit flip (admin/marketing buttons keep working).
  const toggleTheme = () => setMode(theme === 'dark' ? 'light' : 'dark');

  return { theme, mode, setMode, cycleTheme, toggleTheme, isDark: theme === 'dark' };
}
