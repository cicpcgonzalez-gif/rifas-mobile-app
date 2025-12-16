import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';

import RafflesStack from './RafflesStack';
import MyRafflesScreen from '../screens/MyRafflesScreen';
import WinnersScreen from '../screens/WinnersScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import WalletScreen from '../screens/WalletScreen';

const Tabs = createBottomTabNavigator();

export default function TabsNavigator({ api, user, onUserUpdate, modulesConfig, pushToken, setPushToken, onLogout }) {
  const cfg =
    modulesConfig || {
      user: { raffles: true, wallet: true, profile: true },
      admin: { raffles: true },
      superadmin: { audit: true, branding: true, modules: true }
    };

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.subtext,
        tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: 'rgba(255,255,255,0.08)' },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Rifas: 'pricetag-outline',
            Tickets: 'ticket-outline',
            Ganadores: 'trophy-outline',
            Perfil: 'person-circle-outline',
            Wallet: 'wallet-outline',
            Admin: 'settings-outline',
            Superadmin: 'shield-checkmark-outline'
          };
          return <Ionicons name={icons[route.name] || 'help-circle-outline'} size={size} color={color} />;
        },
        headerRight: () => null
      })}
    >
      {cfg?.user?.raffles !== false && (
        <Tabs.Screen name="Rifas" options={{ headerShown: true, headerTitle: '', headerTransparent: true, headerRight: () => (
          <TouchableOpacity 
            onPress={onLogout}
            style={{ marginRight: 16, backgroundColor: 'rgba(239, 68, 68, 0.2)', padding: 8, borderRadius: 20, marginTop: 8 }}
          >
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        )}}>
          {(props) => <RafflesStack {...props} api={api} user={user} />}
        </Tabs.Screen>
      )}
      {cfg?.user?.raffles !== false && (
        <Tabs.Screen name="Tickets">
          {(props) => <MyRafflesScreen {...props} api={api} user={user} />}
        </Tabs.Screen>
      )}
      {cfg?.user?.wallet !== false && (
        <Tabs.Screen name="Wallet">
          {(props) => <WalletScreen {...props} api={api} />}
        </Tabs.Screen>
      )}
      <Tabs.Screen name="Ganadores">
        {(props) => <WinnersScreen {...props} api={api} />}
      </Tabs.Screen>
      {cfg?.user?.profile !== false && (
        <Tabs.Screen name="Perfil">
          {(props) => <ProfileScreen {...props} api={api} user={user} onUserUpdate={onUserUpdate} pushToken={pushToken} setPushToken={setPushToken} onLogout={onLogout} />}
        </Tabs.Screen>
      )}
      {(user?.role === 'admin' || user?.role === 'organizer' || user?.role === 'superadmin') && cfg?.admin?.raffles !== false && (
        <Tabs.Screen name={user?.role === 'superadmin' ? 'Superadmin' : 'Admin'}>
          {(props) => <AdminScreen {...props} api={api} user={user} modulesConfig={modulesConfig} />}
        </Tabs.Screen>
      )}
    </Tabs.Navigator>
  );
}
