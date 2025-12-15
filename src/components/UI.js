import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';

export const HeroBanner = ({ compact = false }) => (
  <View style={{ alignItems: 'center', paddingVertical: compact ? 10 : 20 }}>
    <Text style={{ 
      fontSize: compact ? 28 : 42, 
      fontWeight: '900', 
      color: palette.text, 
      letterSpacing: 2,
      textTransform: 'uppercase',
      textShadowColor: palette.primary,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 15
    }}>
      MEGA <Text style={{ color: palette.secondary }}>RIFAS</Text>
    </Text>
    {!compact && (
      <Text style={{ 
        color: palette.subtext, 
        fontSize: 14, 
        letterSpacing: 4, 
        marginTop: 4, 
        fontWeight: '600',
        textTransform: 'uppercase' 
      }}>
        Rifas Premium
      </Text>
    )}
  </View>
);

export function FilledButton({ title, onPress, disabled, loading, icon, style }) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress && onPress();
      }}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[{ width: '100%', borderRadius: 12, overflow: 'hidden', opacity: isDisabled ? 0.7 : 1 }, style]}
    >
      <LinearGradient
        colors={['#7c3aed', '#4f46e5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14 }}
      >
        {loading ? <ActivityIndicator color="#fff" style={{ marginRight: 8 }} /> : icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 }}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function OutlineButton({ title, onPress, disabled, icon, style }) {
  const isDisabled = disabled;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'transparent', 
        borderWidth: 1, 
        borderColor: palette.border, 
        padding: 12, 
        borderRadius: 12,
        opacity: isDisabled ? 0.7 : 1 
      }, style]}
      activeOpacity={0.85}
    >
      {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
      <Text style={{ color: palette.primary, fontWeight: '700' }}>{title}</Text>
    </TouchableOpacity>
  );
}

export const QRCodePlaceholder = ({ value }) => {
  const seed = (value || 'SEED').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const blocks = Array.from({ length: 64 }).map((_, i) => (seed + i) % 3 !== 0);
  
  return (
    <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 8, alignSelf: 'center', marginVertical: 10 }}>
      <View style={{ width: 120, height: 120, flexDirection: 'row', flexWrap: 'wrap' }}>
        {blocks.map((filled, i) => (
          <View key={i} style={{ 
            width: '12.5%', 
            height: '12.5%', 
            backgroundColor: filled ? '#000' : '#fff' 
          }} />
        ))}
      </View>
    </View>
  );
};

export const ProgressBar = ({ progress, color }) => (
  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginVertical: 8, overflow: 'hidden' }}>
    <View style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
  </View>
);

// --- TOAST SYSTEM ---
const ToastContext = createContext();
export const useToast = () => useContext(ToastContext);

const Toast = ({ message, type, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => onHide());
  }, []);

  const bgColors = {
    success: 'rgba(16, 185, 129, 0.95)',
    error: 'rgba(239, 68, 68, 0.95)',
    info: 'rgba(59, 130, 246, 0.95)'
  };

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 60,
      left: 20,
      right: 20,
      backgroundColor: bgColors[type] || bgColors.info,
      padding: 16,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
      opacity,
      zIndex: 9999,
      transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }]
    }}>
      <Ionicons name={type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle'} size={24} color="#fff" style={{ marginRight: 12 }} />
      <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15, flex: 1 }}>{message}</Text>
    </Animated.View>
  );
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onHide={() => setToast(null)} />}
    </ToastContext.Provider>
  );
};
