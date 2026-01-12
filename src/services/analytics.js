import Constants from 'expo-constants';

const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

let initialized = false;
let userId = null;

export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  // No-op: con HTTP API no hay init nativa.
}

export async function setAnalyticsUser(userId) {
  try {
    userId = userId ? String(userId) : null;
  } catch (_err) {
    // no-op
  }
}

export async function logEvent(name, props) {
  if (!name) return;
  if (!AMPLITUDE_API_KEY) return;

  try {
    const safeProps = props && typeof props === 'object' ? props : undefined;
    const releaseChannel = Constants?.expoConfig?.releaseChannel;
    const appVersion = Constants?.expoConfig?.version;

    const event = {
      event_type: String(name),
      user_id: userId || undefined,
      event_properties: safeProps,
      platform: 'React Native',
      app_version: appVersion,
      os_name: 'android',
      // Amplitude completa device_id si no se envía; evitamos PII.
      // device_id: undefined,
      // ip: '$remote'
    };

    await fetch('https://api2.amplitude.com/2/httpapi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: AMPLITUDE_API_KEY, events: [event], options: { min_id_length: 1 } })
    });
  } catch (_err) {
    // no-op
  }
}

export async function logScreenView(routeName) {
  if (!routeName) return;
  const releaseChannel = Constants?.expoConfig?.releaseChannel;
  await logEvent('screen_view', { screen: String(routeName), releaseChannel });
}
