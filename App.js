import React, { useCallback, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Main from './src/Main';
import AppErrorBoundary from './src/components/AppErrorBoundary';

export default function App() {
  const [restartKey, setRestartKey] = useState(0);
  const handleReset = useCallback(() => setRestartKey((k) => k + 1), []);

  return (
    <SafeAreaProvider>
      <AppErrorBoundary onReset={handleReset}>
        <Main key={restartKey} />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
