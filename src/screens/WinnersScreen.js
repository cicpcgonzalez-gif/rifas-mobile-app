import React, { useState, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';

export default function WinnersScreen({ api }) {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { res, data } = await api('/winners');
    if (res.ok) setWinners(data);
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filteredWinners = useMemo(() => {
    if (!search) return winners;
    const lower = search.toLowerCase();
    return winners.filter(w => 
      (w.user?.name || '').toLowerCase().includes(lower) ||
      (w.prize || '').toLowerCase().includes(lower) ||
      (w.raffle?.title || '').toLowerCase().includes(lower)
    );
  }, [winners, search]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Muro de la Fama 🏆</Text>
        <Text style={styles.muted}>Nuestros ganadores reales y felices.</Text>
        
        <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginVertical: 16 }}>
          <Ionicons name="search" size={20} color={palette.muted} />
          <TextInput 
            style={{ flex: 1, color: '#fff', padding: 12 }}
            placeholder="Buscar ganador, premio o rifa..."
            placeholderTextColor={palette.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={palette.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={palette.primary} style={{ marginTop: 20 }} />
        ) : (
          <View>
            {filteredWinners.map((w) => (
              <View key={w.id} style={[styles.card, { marginBottom: 16 }]}>
                {w.photoUrl ? (
                  <Image
                    source={{ uri: w.photoUrl }}
                    style={{ width: '100%', height: 250, borderRadius: 12, marginBottom: 12, backgroundColor: '#000' }}
                    resizeMode="contain"
                  />
                ) : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {w.user?.avatar ? (
                    <Image source={{ uri: w.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="person" size={20} color={palette.muted} />
                    </View>
                  )}
                  <View>
                    <Text style={styles.itemTitle}>{w.user?.name || 'Ganador'}</Text>
                    <Text style={styles.muted}>{new Date(w.drawDate).toLocaleDateString()} • {w.raffle?.title}</Text>
                  </View>
                </View>
                <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 16, marginBottom: 4 }}>Premio: {w.prize || w.raffle?.title}</Text>
                {w.testimonial ? (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8 }}>
                    <Text style={{ color: palette.text, fontStyle: 'italic' }}>"{w.testimonial}"</Text>
                  </View>
                ) : null}
              </View>
            ))}
            {filteredWinners.length === 0 && <Text style={styles.muted}>No se encontraron ganadores.</Text>}
          </View>
        )}
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
