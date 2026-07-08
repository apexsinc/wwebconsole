/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useWeatherStore } from '../store.js';
import { WLLConfig } from '../types.js';

const api = axios.create({
  baseURL: '',
  timeout: 8000,
});

export const fetchCurrentWeather = async () => {
  const response = await api.get('/api/weatherlink-current');
  return response.data;
};

export const updateWLLConfig = async (newConfig: Partial<WLLConfig>) => {
  const response = await api.post('/api/config', newConfig);
  return response.data;
};

// React hook to handle SSE live stream connection
export function useLiveStream() {
  const setAll = useWeatherStore((state) => state.setAll);
  const updateConnection = useWeatherStore((state) => state.updateConnection);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connect() {
      updateConnection({ status: 'connecting' });
      eventSource = new EventSource('/api/live-stream');

      eventSource.onopen = () => {
        updateConnection({ status: 'online', errorMessage: null });
      };

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          setAll(payload);
        } catch (err) {
          console.error('Error parsing live stream data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('Live stream connection error:', err);
        updateConnection({ 
          status: 'offline', 
          errorMessage: 'Live stream disconnected. Reconnecting...' 
        });
        eventSource?.close();

        // Attempt reconnection after 5 seconds
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };
    }

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [setAll, updateConnection]);
}

// React Query hook for polling fallback & cache management
export function useWeatherQuery() {
  const setAll = useWeatherStore((state) => state.setAll);
  const useCloudApi = useWeatherStore((state) => state.config.useCloudApi);

  const pollInterval = useCloudApi ? 60000 : 10000; // 1 minute for cloud, 10 seconds for local WLL

  return useQuery({
    queryKey: ['weatherCurrent'],
    queryFn: fetchCurrentWeather,
    refetchInterval: pollInterval,
    retry: 2,
    staleTime: 5000,
  });
}

// Config mutation
export function useConfigMutation() {
  const queryClient = useQueryClient();
  const updateConfigState = useWeatherStore((state) => state.updateConfig);

  return useMutation({
    mutationFn: updateWLLConfig,
    onSuccess: (data) => {
      updateConfigState(data);
      queryClient.invalidateQueries({ queryKey: ['weatherCurrent'] });
    },
  });
}
