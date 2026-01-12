import React, { useCallback, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Main from './src/Main';
import AppErrorBoundary from './src/components/AppErrorBoundary';

import * as Sentry from 'sentry-expo';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.EXPO_PUBLIC_SENTRY_ENV || (process.env.NODE_ENV === 'development' ? 'development' : 'production');

// Init lo antes posible. Si no hay DSN, queda desactivado sin romper la app.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enableInExpoDevelopment: false,
    environment: SENTRY_ENVIRONMENT,
    debug: false
  });
}

export default function App() {
  const [restartKey, setRestartKey] = useState(0);
  const handleReset = useCallback(() => setRestartKey((k) => k + 1), []);

  const ErrorBoundary = useMemo(
    () => (SENTRY_DSN && Sentry?.Native?.ErrorBoundary ? Sentry.Native.ErrorBoundary : React.Fragment),
    []
  );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppErrorBoundary onReset={handleReset}>
          <Main key={restartKey} />
        </AppErrorBoundary>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
