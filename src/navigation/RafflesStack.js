import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { palette } from '../theme';
import RafflesHomeScreen from '../screens/RafflesHomeScreen';
import RaffleDetailScreen from '../screens/RaffleDetailScreen';
import MyPublicationsScreen from '../screens/MyPublicationsScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import ReportScreen from '../screens/ReportScreen';

const InnerStack = createNativeStackNavigator();

export default function RafflesStack({ api, user }) {
  return (
    <InnerStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.background },
        headerTitleStyle: { color: palette.text, fontWeight: '800' },
        headerTintColor: palette.primary
      }}
    >
      <InnerStack.Screen name="RafflesHome" options={{ title: 'Rifas', headerShown: false }}>
        {(props) => <RafflesHomeScreen {...props} api={api} user={user} />}
      </InnerStack.Screen>
      <InnerStack.Screen name="RaffleDetail" options={{ title: 'Detalle' }}>
        {(props) => <RaffleDetailScreen {...props} api={api} />}
      </InnerStack.Screen>
      <InnerStack.Screen name="MyPublications" options={{ title: 'Mis Publicaciones', headerShown: false }}>
        {(props) => <MyPublicationsScreen {...props} api={api} user={user} />}
      </InnerStack.Screen>

      <InnerStack.Screen name="PublicProfile" options={{ title: 'Perfil', headerShown: false }}>
        {(props) => <PublicProfileScreen {...props} api={api} />}
      </InnerStack.Screen>

      <InnerStack.Screen name="Report" options={{ title: 'Denunciar y reportar' }}>
        {(props) => <ReportScreen {...props} api={api} />}
      </InnerStack.Screen>
    </InnerStack.Navigator>
  );
}
