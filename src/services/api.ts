/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { API_PREFIX, apiPath } from '../../shared/apiPaths.js';
import { useWeatherStore } from '../store.js';
import { ApiError, AuthUser, BillingInfo, ShareLink, WLLConfig } from '../types.js';

/** Absolute API base in production (api subdomain), same-origin in dev. */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || '';

/** Canonical API URL builder for callers that need to fetch outside `api()`. */
export { API_PREFIX };
export function apiUrl(path: string): string {
  return `${API_BASE}${apiPath(path)}`;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as any)?.error || `Request failed (${res.status})`, res.status, (data as any)?.code);
  }
  return data as T;
}

export async function fetchAuthConfig() {
  return api<{
    turnstileEnabled: boolean;
    turnstileSiteKey: string;
    emailVerificationRequired: boolean;
    yearlyPriceUsd: number;
    freeTrialDays: number;
    googleClientId?: string;
  }>('/auth/config');
}

/** Mint a one-shot nonce for the Google Identity Services credential flow. */
export async function fetchGoogleNonce() {
  return api<{ ok: boolean; nonce: string }>('/auth/google/nonce', { method: 'POST' });
}

/** Exchange a Google ID token (from the rendered GIS button) for a session. */
export async function loginWithGoogleCredential(payload: {
  credential: string;
  nonce: string;
  entry?: 'admin';
  mode?: 'login' | 'register';
}) {
  return api<{ ok: boolean; redirectTo: string; user: { email: string; name: string } }>(
    '/auth/google/credential',
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export type PublicSiteConfig = {
  [key: string]: any;
  yearlyPriceUsd: number;
  freeTrialDays: number;
  indexable: boolean;
  features: { title: string; body: string }[];
  pricing?: {
    currency: string;
    amount: number;
    formatted: string;
    periodLabel: string;
    note: string;
    country: string;
  };
};

export async function fetchSiteConfig() {
  return api<PublicSiteConfig>('/public/site');
}

export async function submitContact(payload: {
  name?: string;
  email: string;
  subject?: string;
  message: string;
  turnstileToken?: string;
  website?: string;
}) {
  return api<{ ok: boolean }>('/public/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMe() {
  return api<{ user: AuthUser | null; billing: BillingInfo | null; trialDays?: number }>('/auth/me');
}

export async function login(email: string, password: string, turnstileToken?: string) {
  return api<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, turnstileToken }),
  });
}

export async function register(email: string, password: string, name?: string, turnstileToken?: string) {
  return api<{
    user?: AuthUser;
    needsVerification?: boolean;
    ok?: boolean;
    email?: string;
    message?: string;
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, turnstileToken }),
  });
}

export async function verifyEmail(email: string, code: string, turnstileToken?: string) {
  return api<{ user: AuthUser }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code, turnstileToken }),
  });
}

export async function resendVerification(email: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export async function forgotPassword(email: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export async function resetPassword(email: string, code: string, password: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password, turnstileToken }),
  });
}

export async function logout() {
  return api<{ ok: boolean }>('/auth/logout', { method: 'POST' });
}

export async function fetchCurrentWeather() {
  return api<any>('/weather/current');
}

export async function updateStationConfig(patch: Record<string, unknown>) {
  return api<any>('/station', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchShareLinks() {
  return api<{ links: ShareLink[] }>('/share');
}

export async function createShareLink(label?: string, slug?: string) {
  return api<{ link: ShareLink }>('/share', {
    method: 'POST',
    body: JSON.stringify({ label, slug }),
  });
}

export async function deleteShareLink(id: string) {
  return api<{ ok: boolean }>(`/share/${id}`, { method: 'DELETE' });
}

export async function fetchPublicTv(slug: string) {
  return api<any>(`/public/tv/${encodeURIComponent(slug)}`);
}

export async function adminGetOverview() {
  return api<{ users: number; suspended: number; activePaidDevices: number }>('/admin/overview');
}

export async function adminListUsers(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return api<{ users: any[] }>(`/admin/users${qs}`);
}

export async function adminUpdateUser(id: string, patch: Record<string, unknown>) {
  return api<any>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function adminActivateDevice(userId: string, body: { years?: number; wlPlan?: string }) {
  return api<any>(`/admin/users/${userId}/activate-device`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminDeleteUser(userId: string) {
  return api<{ ok: boolean; message?: string }>(`/admin/users/${userId}`, { method: 'DELETE' });
}

export type AdminBlogPost = {
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
  status: string;
};

export async function adminListBlog() {
  return api<{ posts: AdminBlogPost[] }>('/admin/blog');
}

export async function adminCreateBlog(payload: Record<string, unknown>) {
  return api<{ post: AdminBlogPost }>('/admin/blog', { method: 'POST', body: JSON.stringify(payload) });
}

export async function adminUpdateBlog(id: string, payload: Record<string, unknown>) {
  return api<{ post: AdminBlogPost }>(`/admin/blog/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function adminDeleteBlog(id: string) {
  return api<{ ok: boolean }>(`/admin/blog/${id}`, { method: 'DELETE' });
}

export async function adminFetchBlogCover(id: string, query?: string, refresh?: boolean) {
  return api<{ ok: boolean; coverImageUrl: string }>(`/admin/blog/${id}/cover`, {
    method: 'POST',
    body: JSON.stringify({ query, refresh }),
  });
}

export async function adminGetSettings() {
  return api<{ settings: any[]; groups?: { id: string; label: string; keys: string[] }[] }>('/admin/settings');
}

export async function adminUpdateSettings(settings: Record<string, string>) {
  return api<{ settings: any[]; groups?: { id: string; label: string; keys: string[] }[] }>('/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export async function changeAccountPassword(currentPassword: string, newPassword: string) {
  return api<{ ok: boolean }>('/account/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function requestEmailChange(email: string) {
  return api<{ ok: boolean; needsVerification?: boolean; email: string; devCode?: string }>(
    '/account/email/request',
    { method: 'POST', body: JSON.stringify({ email }) }
  );
}

export async function confirmEmailChange(code: string) {
  return api<{ ok: boolean; user: AuthUser; email: string }>('/account/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function requestAccountDeletion() {
  return api<{ ok: boolean; deleteRequestedAt: number; deleteEffectiveAt: number; user: AuthUser }>(
    '/account/delete',
    { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }
  );
}

export async function cancelAccountDeletion() {
  return api<{ ok: boolean; user: AuthUser }>('/account/delete/cancel', { method: 'POST' });
}

export function useWeatherQuery(enabled = true) {
  const setAll = useWeatherStore((state) => state.setAll);
  const pollSec = useWeatherStore((state) => state.billing?.pollIntervalSec || state.config.pollIntervalSec || 120);

  const query = useQuery({
    queryKey: ['weatherCurrent'],
    queryFn: fetchCurrentWeather,
    refetchInterval: Math.max(pollSec, 60) * 1000,
    retry: 2,
    staleTime: 5000,
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      setAll(query.data);
      const st = useWeatherStore.getState();
      const layout = query.data.config?.tileLayout;
      if ((layout === 'dense' || layout === 'room') && st.tileLayout !== layout) {
        st.setTileLayout(layout);
      }
      if (typeof query.data.config?.highContrast === 'boolean' && st.highContrast !== query.data.config.highContrast) {
        st.setHighContrast(query.data.config.highContrast);
      }
      if (query.data.billing) {
        useWeatherStore.getState().setBilling(query.data.billing);
      }
    }
  }, [query.data, setAll]);

  return query;
}

export function useConfigMutation() {
  const queryClient = useQueryClient();
  const updateConfigState = useWeatherStore((state) => state.updateConfig);
  const setAll = useWeatherStore((state) => state.setAll);
  const setBilling = useWeatherStore((state) => state.setBilling);

  return useMutation({
    mutationFn: updateStationConfig,
    onSuccess: (data) => {
      if (data?.config) updateConfigState(data.config);
      if (data?.weather) setAll(data);
      if (data?.billing) setBilling(data.billing);
      queryClient.invalidateQueries({ queryKey: ['weatherCurrent'] });
      queryClient.invalidateQueries({ queryKey: ['shareLinks'] });
    },
  });
}

export function useShareLinks() {
  return useQuery({
    queryKey: ['shareLinks'],
    queryFn: fetchShareLinks,
  });
}

export function buildStationPatch(form: {
  name?: string;
  apiVersion: 'v1' | 'v2';
  did: string;
  password: string;
  apiToken: string;
  apiSecret: string;
  stationId: string;
  latitude?: number | '';
  longitude?: number | '';
  unitTemp?: WLLConfig['unitTemp'];
  unitWind?: WLLConfig['unitWind'];
  unitBaro?: WLLConfig['unitBaro'];
  unitRain?: WLLConfig['unitRain'];
  wlPlan?: 'basic' | 'pro' | 'unknown';
}) {
  const patch: Record<string, unknown> = {
    cloudApiVersion: form.apiVersion,
    cloudDid: form.did,
    cloudStationId: form.stationId,
  };
  if (form.name) patch.name = form.name;
  if (form.password) patch.cloudPassword = form.password;
  if (form.apiToken) patch.cloudApiToken = form.apiToken;
  if (form.apiSecret) patch.cloudApiSecret = form.apiSecret;
  if (form.unitTemp) patch.unitTemp = form.unitTemp;
  if (form.unitWind) patch.unitWind = form.unitWind;
  if (form.unitBaro) patch.unitBaro = form.unitBaro;
  if (form.unitRain) patch.unitRain = form.unitRain;
  // wlPlan is not user-writable (billing / admin controlled)
  return patch;
}

export async function createCheckoutSession(stationId?: string) {
  return api<{ ok: boolean; checkoutUrl: string; checkoutId: string }>('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ stationId }),
  });
}

export async function verifyCheckout(checkoutId: string) {
  return api<{ ok: boolean; message?: string; billing?: BillingInfo }>('/billing/verify-checkout', {
    method: 'POST',
    body: JSON.stringify({ checkoutId }),
  });
}
