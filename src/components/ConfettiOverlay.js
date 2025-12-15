import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, Dimensions, StyleSheet, Easing, Modal, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const NUM_CONFETTI = 50;
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'];

const ConfettiPiece = ({ index }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * width).current;
  const color = useRef(COLORS[index % COLORS.length]).current;
  const size = useRef(Math.random() * 10 + 5).current;
  const speed = useRef(Math.random() * 3000 + 2000).current;
  const delay = useRef(Math.random() * 1000).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: speed,
          delay: delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        })
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, height + 20],
  });

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: size,
        height: size,
        backgroundColor: color,
        transform: [{ translateY }, { rotate }],
        borderRadius: size / 4,
      }}
    />
  );
};

export default function ConfettiOverlay({ visible, winData, onClose }) {
  if (!visible || !winData) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.container}>
        {Array.from({ length: NUM_CONFETTI }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}
        
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="trophy" size={64} color="#fbbf24" />
          </View>
          <Text style={styles.title}>¡FELICIDADES!</Text>
          <Text style={styles.subtitle}>Has ganado en la rifa:</Text>
          <Text style={styles.raffleTitle}>{winData.raffle?.title}</Text>
          <Text style={styles.prize}>{winData.raffle?.prize}</Text>
          
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>¡GENIAL!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: 20,
    borderRadius: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fbbf24',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 16,
    marginBottom: 4,
  },
  raffleTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  prize: {
    color: '#22d3ee',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#fbbf24',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#0f172a',
    fontWeight: '900',
    fontSize: 18,
  }
});
