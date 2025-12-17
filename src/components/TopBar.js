import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';

export default function TopBar({
  balanceText,
  onPressWallet,
  onPressNotifications,
  onPressProfile
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPressWallet} activeOpacity={0.85} style={[styles.circle, styles.circleAccent]}>
        <Ionicons name="cash-outline" size={22} color={palette.background} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onPressNotifications} activeOpacity={0.85} style={[styles.circle, styles.circleNeutral]}>
        <Ionicons name="notifications-outline" size={22} color={palette.text} />
      </TouchableOpacity>

      <View style={styles.balancePill}>
        <Text style={styles.balanceText} numberOfLines={1}>
          {balanceText || '—'}
        </Text>
        <Text style={styles.flag} accessibilityLabel="Venezuela">🇻🇪</Text>
      </View>

      <TouchableOpacity onPress={onPressProfile} activeOpacity={0.85} style={[styles.circle, styles.circleAccent]}>
        <Ionicons name="person-outline" size={22} color={palette.background} />
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  circleAccent: {
    backgroundColor: palette.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)'
  },
  circleNeutral: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: palette.border
  },
  balancePill: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: palette.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)'
  },
  balanceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900'
  },
  flag: {
    fontSize: 18
  }
};
