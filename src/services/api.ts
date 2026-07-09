/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWeatherStore } from '../store.js';
import { AuthUser, ShareLink, WLLConfig } from '../types.js';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchMe() {
  return api<{ user: AuthUser | null }>('/api/auth/me');
}

export async function login(email: string, password: string) {
  return api<{ user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, name?: string) {
  return api<{ user: AuthUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
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

export function useWeatherQuery(enabled = true) {
  const setAll = useWeatherStore((state) => state.setAll);

  const query = useQuery({
    queryKey: ['weatherCurrent'],
    queryFn: fetchCurrentWeather,
    refetchInterval: 15000,
    retry: 2,
    staleTime: 5000,
    enabled,
  });

  useEffect(() => {
    if (query.data) {
      setAll(query.data);
    }
  }, [query.data, setAll]);

  return query;
}

export function useConfigMutation() {
  const queryClient = useQueryClient();
  const updateConfigState = useWeatherStore((state) => state.updateConfig);
  const setAll = useWeatherStore((state) => state.setAll);

  return useMutation({
    mutationFn: updateStationConfig,
    onSuccess: (data) => {
      if (data?.config) updateConfigState(data.config);
      if (data?.weather) setAll(data);
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

/** Map UI form fields to API patch (including secret fields only when non-empty) */
export function buildStationPatch(
  form: {
    name?: string;
    apiVersion: 'v1' | 'v2';
    did: string;
    password: string;
    apiToken: string;
    apiSecret: string;
    stationId: string;
    latitude: number | '';
    longitude: number | '';
    unitTemp?: WLLConfig['unitTemp'];
    unitWind?: WLLConfig['unitWind'];
    unitBaro?: WLLConfig['unitBaro'];
    unitRain?: WLLConfig['unitRain'];
  }
) {
  const patch: Record<string, unknown> = {
    cloudApiVersion: form.apiVersion,
    cloudDid: form.did,
    cloudStationId: form.stationId,
    latitude: form.latitude === '' ? null : Number(form.latitude),
    longitude: form.longitude === '' ? null : Number(form.longitude),
  };
  if (form.name) patch.name = form.name;
  if (form.password) patch.cloudPassword = form.password;
  if (form.apiToken) patch.cloudApiToken = form.apiToken;
  if (form.apiSecret) patch.cloudApiSecret = form.apiSecret;
  if (form.unitTemp) patch.unitTemp = form.unitTemp;
  if (form.unitWind) patch.unitWind = form.unitWind;
  if (form.unitBaro) patch.unitBaro = form.unitBaro;
  if (form.unitRain) patch.unitRain = form.unitRain;
  return patch;
}
