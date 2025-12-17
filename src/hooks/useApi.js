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
      const isFormDataBody =
        typeof FormData !== 'undefined' &&
        options.body &&
        typeof options.body === 'object' &&
        options.body instanceof FormData;
      if (hasBody && !isFormDataBody && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

      let res;
      try {
        res = await fetch(`${API_URL}${path}`, { ...options, headers });
      } catch (_err) {
        return {
          res: { ok: false, status: 0, networkError: true },
          data: { error: 'No se pudo conectar. Verifica tu internet o el servidor.' }
        };
      }
      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        data = {};
      }

      // Attempt silent refresh on 401 once
      if (res.status === 401 && refreshToken) {
        try {
          const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          let refreshData = {};
          try {
            refreshData = await refreshRes.json();
          } catch (_e) {
            refreshData = {};
          }
          if (refreshRes.ok && refreshData?.accessToken) {
            await persistTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken, refreshData.user);
            return call(path, options);
          } else {
            // Refresh falló: Token inválido o expirado definitivamente
            await persistTokens(null, null, null);
            return {
              res: { ok: false, status: 401 },
              data: { error: 'Sesión expirada. Inicia sesión nuevamente.' }
            };
          }
        } catch (err) {
          // Error de red al refrescar o similar
          await persistTokens(null, null, null);
          return {
            res: { ok: false, status: 401 },
            data: { error: 'Sesión expirada. Inicia sesión nuevamente.' }
          };
        }
      }

      return { res, data };
    },
    [accessToken, refreshToken, persistTokens]
  );

  return call;
}
