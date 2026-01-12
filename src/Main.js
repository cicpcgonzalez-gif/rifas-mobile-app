import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Linking, Keyboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as Sentry from 'sentry-expo';

import { palette } from './theme';
import { styles } from './styles';
import AuthScreen from './screens/AuthScreen';
import RafflesStack from './navigation/RafflesStack';
import TabsNavigator from './navigation/TabsNavigator';
import RaffleDetailScreen from './screens/RaffleDetailScreen';
import ReferralsScreen from './screens/ReferralsScreen';
import LegalScreen from './screens/LegalScreen';
import { useApi } from './hooks/useApi';
import { ToastProvider } from './components/UI';
import ConfettiOverlay from './components/ConfettiOverlay';
import AppErrorBoundary from './components/AppErrorBoundary';
import WinnersTicker from './components/WinnersTicker';
import { FloatingFabProvider, useFloatingFab } from './context/floatingFab';

import { initAnalytics, logScreenView, setAnalyticsUser } from './services/analytics';

const Stack = createNativeStackNavigator();

const APP_NAME = 'MegaRifas';
const APP_TAGLINE = 'Rifas premium con confianza.';

const MOTIVATION_LINES = [
  'Afinando tus sorteos en segundos...',
  'Generando buena suerte y buen diseño...',
  'Sincronizando rifas premium...',
  'Cargando beneficios VIP y promos...',
  'Listando premios para el siguiente ganador...',
  'Preparando una experiencia impecable...'
];

const SECURE_KEYS = {
  access: 'mr_accessToken',
  refresh: 'mr_refreshToken'
};

const getProjectId = () => Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false
  })
});

const setSecureItem = async (key, value) => {
  if (!value) return SecureStore.deleteItemAsync(key);
  return SecureStore.setItemAsync(key, value);
};

const getSecureItem = (key) => SecureStore.getItemAsync(key);
const deleteSecureItem = (key) => SecureStore.deleteItemAsync(key);

function MainContent() {
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [user, setUser] = useState(null);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rememberEnabled, setRememberEnabled] = useState(false);
  const [modulesConfig, setModulesConfig] = useState({ user: { raffles: true, wallet: true, profile: true }, admin: { raffles: true }, superadmin: { audit: true, branding: true, modules: true } });
  const [pushToken, setPushToken] = useState(null);
  const [winData, setWinData] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const { whatsAppFabHidden, setWhatsAppFabHidden } = useFloatingFab();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    initAnalytics();
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, []);

  const getActiveRouteName = useCallback((state) => {
    if (!state || !Array.isArray(state.routes) || state.routes.length === 0) return null;
    const index = typeof state.index === 'number' ? state.index : 0;
    const route = state.routes[index] || state.routes[0];
    if (!route) return null;
    if (route.state) return getActiveRouteName(route.state);
    return route.name || null;
  }, []);

  // Ocultar el FAB en cualquier pantalla que no sea la pestaña principal de Rifas.
  const handleNavStateChange = useCallback((state) => {
    const active = getActiveRouteName(state);
    const shouldShow = active === 'Rifas';
    setWhatsAppFabHidden(!shouldShow);

    // Analytics: best-effort
    logScreenView(active);
  }, [getActiveRouteName, setWhatsAppFabHidden]);

  const persistTokens = useCallback(
    async (at, rt, usr, opts = {}) => {
      const remember = opts.remember ?? rememberEnabled;
      setAccessToken(at || null);
      setRefreshToken(rt || null);
      setUser(usr || null);

      if (remember) {
        await AsyncStorage.setItem('rememberMe', 'true');
        if (at) await setSecureItem(SECURE_KEYS.access, at);
        if (rt) await setSecureItem(SECURE_KEYS.refresh, rt);
        if (usr) await AsyncStorage.setItem('user', JSON.stringify(usr));
      } else {
        await AsyncStorage.multiRemove(['rememberMe', 'user']);
        await deleteSecureItem(SECURE_KEYS.access);
        await deleteSecureItem(SECURE_KEYS.refresh);
      }
    },
    [rememberEnabled]
  );

  const updateUserProfile = useCallback(async (usr) => {
    setUser(usr);
    await AsyncStorage.setItem('user', JSON.stringify(usr));
  }, []);

  const api = useApi(accessToken, refreshToken, persistTokens);

  useEffect(() => {
    if (!accessToken) {
      setModulesConfig(null);
      setAnalyticsUser(null);
      try {
        Sentry?.Native?.setUser?.(null);
      } catch (_e) {
        // no-op
      }
      return;
    }
    (async () => {
      const { res, data } = await api('/modules');
      if (res.ok) setModulesConfig(data);
      
      // Check for pending wins
      const winRes = await api('/me/pending-wins');
      if (winRes.res.ok && winRes.data.win) {
        setWinData(winRes.data.win);
        setShowConfetti(true);
      }
    })();
  }, [accessToken, api]);

  useEffect(() => {
    if (user?.id) setAnalyticsUser(user.id);
    try {
      if (user?.id) {
        Sentry?.Native?.setUser?.({ id: String(user.id) });
      }
    } catch (_e) {
      // no-op
    }
  }, [user?.id]);

  const handleCloseConfetti = async () => {
    setShowConfetti(false);
    if (winData) {
      await api(`/me/ack-win/${winData.id}`, { method: 'POST' });
      setWinData(null);
    }
  };

  useEffect(() => {
    (async () => {
      const remember = (await AsyncStorage.getItem('rememberMe')) === 'true';
      setRememberEnabled(remember);
      if (remember) {
        const storedAccess = (await getSecureItem(SECURE_KEYS.access)) || (await AsyncStorage.getItem('accessToken'));
        const storedRefresh = (await getSecureItem(SECURE_KEYS.refresh)) || (await AsyncStorage.getItem('refreshToken'));
        const storedUser = await AsyncStorage.getItem('user');
        if (storedAccess) setAccessToken(storedAccess);
        if (storedRefresh) setRefreshToken(storedRefresh);
        if (storedUser) setUser(JSON.parse(storedUser));
      } else {
        await AsyncStorage.multiRemove(['user']);
        await deleteSecureItem(SECURE_KEYS.access);
        await deleteSecureItem(SECURE_KEYS.refresh);
      }
      setBootstrapped(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const projectId = getProjectId();
      if (!projectId) {
        console.warn('Falta projectId de EAS para registrar push tokens.');
        return;
      }
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      setPushToken(tokenData?.data || null);
    })();
  }, []);

  useEffect(() => {
    const notifSub = Notifications.addNotificationReceivedListener(() => {
      // no-op
    });
    const respSub = Notifications.addNotificationResponseReceivedListener(() => {
      // no-op
    });
    return () => {
      notifSub?.remove?.();
      respSub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!pushToken || !accessToken) return;
    (async () => {
      try {
        await api('/me/push-token', { method: 'POST', body: JSON.stringify({ token: pushToken }) });
      } catch (_err) {
        try {
          Sentry?.captureException?.(_err);
        } catch (_e) {
          // no-op
        }
      }
    })();
  }, [pushToken, accessToken, api]);

  const handleAuth = async (at, rt, usr, remember) => {
    setRememberEnabled(!!remember);
    await persistTokens(at, rt, usr, { remember });
  };

  const logout = async () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    setRememberEnabled(false);
    await AsyncStorage.multiRemove(['rememberMe', 'user']);
    await deleteSecureItem(SECURE_KEYS.access);
    await deleteSecureItem(SECURE_KEYS.refresh);
  };

  const loadingPhrase = useMemo(() => MOTIVATION_LINES[Math.floor(Math.random() * MOTIVATION_LINES.length)], []);

  if (!bootstrapped)
    return (
      <SafeAreaView style={styles.loaderContainer}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: palette.text }}>{APP_NAME}</Text>
          <Text style={{ fontSize: 16, color: palette.subtext, textAlign: 'center' }}>{APP_TAGLINE}</Text>
          <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 8 }} />
          <Text style={{ color: palette.muted, marginTop: 4 }}>{loadingPhrase}</Text>
        </View>
      </SafeAreaView>
    );

  return (
    <AppErrorBoundary onLogout={accessToken ? logout : undefined}>
      <>
        <NavigationContainer onStateChange={handleNavStateChange}>
          <StatusBar style="auto" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: palette.background },
              headerTitleStyle: { color: palette.text, fontWeight: '800' },
              headerTintColor: palette.primary
            }}
          >
            {accessToken ? (
              <>
                <Stack.Screen
                  name="Main"
                  options={{
                    headerShown: false
                  }}
                >
                  {() => (
                    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
                      <View style={{ flex: 1 }}>
                        <WinnersTicker api={api} enabled={!!accessToken} />
                        <TabsNavigator
                          api={api}
                          user={user}
                          onUserUpdate={updateUserProfile}
                          modulesConfig={modulesConfig}
                          pushToken={pushToken}
                          setPushToken={setPushToken}
                          onLogout={logout}
                        />
                        {/* WhatsApp Floating Button */}
                        {(!keyboardVisible && !whatsAppFabHidden) ? (
                          <TouchableOpacity
                            onPress={() => Linking.openURL('https://wa.me/584227930168')}
                            style={{
                              position: 'absolute',
                              bottom: 92,
                              left: 16,
                              backgroundColor: '#25D366',
                              width: 60,
                              height: 60,
                              borderRadius: 30,
                              justifyContent: 'center',
                              alignItems: 'center',
                              elevation: 5,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.3,
                              shadowRadius: 3,
                              zIndex: 1000
                            }}
                          >
                            <Ionicons name="logo-whatsapp" size={32} color="#fff" />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </SafeAreaView>
                  )}
                </Stack.Screen>
                <Stack.Screen name="RaffleDetail" options={{ title: 'Detalle de Rifa' }}>
                  {(props) => <RaffleDetailScreen {...props} api={api} />}
                </Stack.Screen>
                <Stack.Screen name="Referrals" options={{ headerShown: false }}>
                  {(props) => <ReferralsScreen {...props} api={api} />}
                </Stack.Screen>
              </>
            ) : (
              <Stack.Screen name="Auth" options={{ headerShown: false }}>
                {() => <AuthScreen onAuth={handleAuth} />}
              </Stack.Screen>
            )}
            <Stack.Screen name="Legal" options={{ headerShown: false }}>
              {(props) => <LegalScreen {...props} />}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <ConfettiOverlay visible={showConfetti} onClose={handleCloseConfetti} winData={winData} />
      </>
    </AppErrorBoundary>
  );
}

export default function Main() {
  return (
    <ToastProvider>
      <FloatingFabProvider>
        <MainContent />
      </FloatingFabProvider>
    </ToastProvider>
  );
}
