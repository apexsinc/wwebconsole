/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWeatherStore } from '../store.js';
import { ApiError, AuthUser, BillingInfo, ShareLink, WLLConfig } from '../types.js';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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
  }>('/api/auth/config');
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
  return api<PublicSiteConfig>('/api/public/site');
}

export async function submitContact(payload: {
  name?: string;
  email: string;
  subject?: string;
  message: string;
  turnstileToken?: string;
  website?: string;
}) {
  return api<{ ok: boolean }>('/api/public/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMe() {
  return api<{ user: AuthUser | null; billing: BillingInfo | null }>('/api/auth/me');
}

export async function login(email: string, password: string, turnstileToken?: string) {
  return api<{ user: AuthUser }>('/api/auth/login', {
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
  }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, turnstileToken }),
  });
}

export async function verifyEmail(email: string, code: string, turnstileToken?: string) {
  return api<{ user: AuthUser }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code, turnstileToken }),
  });
}

export async function resendVerification(email: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export async function forgotPassword(email: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, turnstileToken }),
  });
}

export async function resetPassword(email: string, code: string, password: string, turnstileToken?: string) {
  return api<{ ok: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, code, password, turnstileToken }),
  });
}

export async function logout() {
  return api<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export async function fetchCurrentWeather() {
  return api<any>('/api/weather/current');
}

export async function updateStationConfig(patch: Record<string, unknown>) {
  return api<any>('/api/station', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchShareLinks() {
  return api<{ links: ShareLink[] }>('/api/share');
}

export async function createShareLink(label?: string, slug?: string) {
  return api<{ link: ShareLink }>('/api/share', {
    method: 'POST',
    body: JSON.stringify({ label, slug }),
  });
}

export async function deleteShareLink(id: string) {
  return api<{ ok: boolean }>(`/api/share/${id}`, { method: 'DELETE' });
}

export async function fetchPublicTv(slug: string) {
  return api<any>(`/api/public/tv/${encodeURIComponent(slug)}`);
}

export async function adminGetOverview() {
  return api<{ users: number; suspended: number; activePaidDevices: number }>('/api/admin/overview');
}

export async function adminListUsers(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return api<{ users: any[] }>(`/api/admin/users${qs}`);
}

export async function adminUpdateUser(id: string, patch: Record<string, unknown>) {
  return api<any>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function adminActivateDevice(userId: string, body: { years?: number; wlPlan?: string }) {
  return api<any>(`/api/admin/users/${userId}/activate-device`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminGetSettings() {
  return api<{ settings: any[]; groups?: { id: string; label: string; keys: string[] }[] }>('/api/admin/settings');
}

export async function adminUpdateSettings(settings: Record<string, string>) {
  return api<{ settings: any[]; groups?: { id: string; label: string; keys: string[] }[] }>('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export async function changeAccountPassword(currentPassword: string, newPassword: string) {
  return api<{ ok: boolean }>('/api/account/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function requestEmailChange(email: string) {
  return api<{ ok: boolean; needsVerification?: boolean; email: string; devCode?: string }>(
    '/api/account/email/request',
    { method: 'POST', body: JSON.stringify({ email }) }
  );
}

export async function confirmEmailChange(code: string) {
  return api<{ ok: boolean; user: AuthUser; email: string }>('/api/account/email/confirm', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function requestAccountDeletion() {
  return api<{ ok: boolean; deleteRequestedAt: number; deleteEffectiveAt: number; user: AuthUser }>(
    '/api/account/delete',
    { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }
  );
}

export async function cancelAccountDeletion() {
  return api<{ ok: boolean; user: AuthUser }>('/api/account/delete/cancel', { method: 'POST' });
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
