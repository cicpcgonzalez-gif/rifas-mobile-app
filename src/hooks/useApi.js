import { useCallback } from 'react';
import { ENV } from '../config/env';

const API_URL = ENV.apiUrl;

export function useApi(accessToken, refreshToken, persistTokens) {
  const call = useCallback(
    async (path, options = {}) => {
      const headers = {
        Accept: 'application/json',
        ...(options.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      };

      // Set JSON content type when sending a body and none provided
      const hasBody = options.body !== undefined;
      if (hasBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

      const res = await fetch(`${API_URL}${path}`, { ...options, headers });
      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      // Attempt silent refresh on 401 once
      if (res.status === 401 && refreshToken) {
        try {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          const refreshData = await refreshRes.json();
          if (refreshRes.ok && refreshData.accessToken) {
            await persistTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken, refreshData.user);
            return call(path, options);
          }
        } catch (err) {
          // swallow and return original response
        }
      }

      return { res, data };
    },
    [accessToken, refreshToken, persistTokens]
  );

  return call;
}
