import { useCallback } from 'react';
import { ENV } from '../config/env';
import * as Sentry from 'sentry-expo';

const API_URL = ENV.apiUrl;

let refreshInFlight = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const captureApiError = (err, extras) => {
  try {
    const withScope = Sentry?.Native?.withScope || Sentry?.withScope;
    const capture = Sentry?.Native?.captureException || Sentry?.captureException;
    if (typeof withScope === 'function' && typeof capture === 'function') {
      withScope((scope) => {
        try {
          scope.setTag('area', 'api');
          if (extras && typeof extras === 'object') scope.setExtras(extras);
        } catch (_e) {
          // no-op
        }
        capture(err);
      });
      return;
    }
    if (typeof capture === 'function') capture(err);
  } catch (_e) {
    // no-op
  }
};

const fetchWithTimeout = async (url, options, timeoutMs) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), Math.max(1000, timeoutMs || 15000)) : null;
  try {
    return await fetch(url, { ...options, ...(controller ? { signal: controller.signal } : {}) });
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch (_e) {
    return {};
  }
};

export function useApi(accessToken, refreshToken, persistTokens) {
  const call = useCallback(
    async (path, options = {}, meta = {}) => {
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

      const method = String(options.method || 'GET').toUpperCase();
      const isIdempotent = method === 'GET' || method === 'HEAD';
      const maxRetries = isIdempotent ? 2 : 0;

      let res;
      try {
        const url = `${API_URL}${path}`;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            res = await fetchWithTimeout(url, { ...options, headers }, ENV?.timeout || 15000);

            // Retry 5xx (idempotente)
            if (res && res.status >= 500 && attempt < maxRetries) {
              await sleep(attempt === 0 ? 350 : 900);
              continue;
            }
            break;
            } catch (err) {
            const isAbort = String(err?.name || '').toLowerCase() === 'aborterror';
            if (attempt < maxRetries && isAbort) {
              await sleep(attempt === 0 ? 350 : 900);
              continue;
            }
            throw err;
          }
        }
      } catch (err) {
        captureApiError(err, { path, method, kind: 'network' });
        return {
          res: { ok: false, status: 0, networkError: true },
          data: { error: 'No se pudo conectar. Verifica tu internet o el servidor.' }
        };
      }
      const data = await safeJson(res);

      const tokenErrorText = String(data?.error || '').toLowerCase();
      const isTokenInvalid = tokenErrorText.includes('token inválido') || tokenErrorText.includes('token invalido') || tokenErrorText.includes('invalid token');
      const isTokenExpired = tokenErrorText.includes('expir') || tokenErrorText.includes('expired');
      const shouldAttemptRefresh = res.status === 401;
      const shouldForceLogout = (res.status === 401 || res.status === 403) && (isTokenInvalid || isTokenExpired);

      // Attempt silent refresh on 401 once
      if (shouldAttemptRefresh && refreshToken && !meta.attemptedRefresh) {
        try {
          if (!refreshInFlight) {
            refreshInFlight = (async () => {
              const refreshRes = await fetchWithTimeout(
                `${API_URL}/auth/refresh`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refreshToken })
                },
                ENV?.timeout || 15000
              );
              const refreshData = await safeJson(refreshRes);
              if (!refreshRes.ok || !refreshData?.accessToken) {
                const e = new Error('Refresh token failed');
                e.status = refreshRes.status;
                e.data = refreshData;
                throw e;
              }
              return refreshData;
            })().finally(() => {
              refreshInFlight = null;
            });
          }

          const refreshData = await refreshInFlight;
          await persistTokens(refreshData.accessToken, refreshData.refreshToken || refreshToken, refreshData.user);
          return call(path, options, { ...meta, attemptedRefresh: true });
        } catch (err) {
          // Error de red al refrescar o similar
          captureApiError(err, { path, method, kind: 'refresh' });
          await persistTokens(null, null, null);
          return {
            res: { ok: false, status: 401 },
            data: { error: 'Sesión expirada. Inicia sesión nuevamente.' }
          };
        }
      }

      // Si el token ya no es válido (por cambio de base/secret o expiración) y no se pudo refrescar,
      // cerrar sesión para forzar login limpio (evita errores repetidos en acciones como "like").
      if (shouldForceLogout && typeof persistTokens === 'function') {
        try {
          await persistTokens(null, null, null, { remember: false });
        } catch (_e) {
          // Silenciar
        }
        return {
          res: { ok: false, status: res.status },
          data: { error: 'Sesión expirada. Inicia sesión nuevamente.' }
        };
      }

      return { res, data };
    },
    [accessToken, refreshToken, persistTokens]
  );

  return call;
}
