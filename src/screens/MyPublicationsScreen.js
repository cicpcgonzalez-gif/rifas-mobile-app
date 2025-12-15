import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';

export default function MyPublicationsScreen({ api, navigation, user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await api('/admin/raffles');
      if (res.ok && Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
    } catch (err) {
      setItems([]);
    }
    setLoading(false);
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (id) => {
    Alert.alert(
      'Eliminar Rifa',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { res, data } = await api(`/raffles/${id}`, { method: 'DELETE' });
            if (res.ok) {
              Alert.alert('Éxito', 'Rifa eliminada.');
              load();
            } else {
              Alert.alert('Error', data.error || 'No se pudo eliminar.');
            }
          }
        }
      ]
    );
  };

  const handleEdit = (raffle) => {
    const targetTab = user?.role === 'superadmin' ? 'Superadmin' : 'Admin';
    // Navegar al tab de Admin y pasar los parámetros para editar
    navigation.navigate(targetTab, { 
      screen: targetTab, // Esto asegura que si hay un stack anidado (que no lo hay en tabs directo, pero por si acaso) se maneje
      params: { 
        action: 'editRaffle', 
        raffleData: raffle 
      } 
    });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Mis Publicaciones</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {loading ? (
            <ActivityIndicator color={palette.primary} size="large" />
          ) : (
            <View>
              {items.length === 0 ? <Text style={styles.muted}>No has publicado rifas.</Text> : null}
              {items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: '#fff' }]}>{item.title}</Text>
                      <Text style={styles.muted}>{item.status === 'closed' ? 'CERRADA' : 'ACTIVA'} • Tickets: {item.soldTickets || 0}/{item.totalTickets || 0}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity onPress={() => handleEdit(item)} style={{ padding: 8, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderRadius: 8 }}>
                        <Ionicons name="create-outline" size={20} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 8 }}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
