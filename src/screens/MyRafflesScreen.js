import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';
import { QRCodePlaceholder, ProgressBar } from '../components/UI';
import { formatTicketNumber } from '../utils';

export default function MyRafflesScreen({ api, navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await api('/me/raffles');
      if (res.ok && Array.isArray(data)) {
        setItems(data.filter(Boolean));
        setError('');
      } else {
        setItems([]);
        setError(res?.status ? `Error ${res.status}` : 'No se pudo cargar');
      }
    } catch (err) {
      setItems([]);
      setError('No se pudo cargar');
    }
    setLoading(false);
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderTicket = ({ item }) => {
    if (!item) return null;
    const raffle = item.raffle || {};
    const progress = raffle?.stats?.progress || 0;
    const isWinner = !!item.isWinner;
    const status = isWinner ? 'Ganador' : item.status || 'Activo';
    const statusColor = isWinner ? '#fbbf24' : status === 'approved' ? '#4ade80' : status === 'pending' ? '#fbbf24' : '#94a3b8';

    return (
      <View style={{ 
        backgroundColor: '#1e293b', 
        borderRadius: 16, 
        marginBottom: 20, 
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isWinner ? '#fbbf24' : 'rgba(255,255,255,0.1)',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}>
        {/* --- CABECERA DEL TICKET --- */}
        <View style={{ padding: 16, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 4 }}>{raffle.title || 'Rifa'}</Text>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>{raffle.description}</Text>
            </View>
            <View style={{ 
              backgroundColor: isWinner ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.1)', 
              paddingHorizontal: 10, 
              paddingVertical: 4, 
              borderRadius: 20,
              borderWidth: 1,
              borderColor: statusColor
            }}>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{status}</Text>
            </View>
          </View>

          {/* NÚMEROS GRANDES */}
          <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 12, alignItems: 'center', marginVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Tus Números</Text>
            <Text style={{ color: isWinner ? '#fbbf24' : '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 1 }}>
              {Array.isArray(item.numbers)
                ? item.numbers.map(n => formatTicketNumber(n, raffle?.digits)).join(' • ')
                : item.numbers
                ? formatTicketNumber(item.numbers, raffle?.digits)
                : '—'}
            </Text>
          </View>
        </View>

        {/* --- SEPARADOR CON MUESCAS --- */}
        <View style={{ height: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: -10, zIndex: 10 }}>
           <View style={{ position: 'absolute', left: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: palette.background }} />
           <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#334155', borderStyle: 'dashed', marginHorizontal: 16 }} />
           <View style={{ position: 'absolute', right: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: palette.background }} />
        </View>

        {/* --- TALÓN DE SEGURIDAD (PIE DEL TICKET) --- */}
        <View style={{ backgroundColor: '#0f172a', padding: 16, paddingTop: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* INFO SERIAL (IZQUIERDA) */}
            <View style={{ flex: 1 }}>
              <View style={{ marginBottom: 8 }}>
                <Text style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', fontWeight: 'bold' }}>Serial Único</Text>
                <Text style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: 11, letterSpacing: 0.5 }}>
                  {item.serialNumber ? item.serialNumber.slice(-8).toUpperCase() : 'PENDIENTE'}
                </Text>
              </View>
              <View>
                <Text style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', fontWeight: 'bold' }}>Comprador</Text>
                <Text style={{ color: '#cbd5e1', fontSize: 11 }} numberOfLines={1}>
                  {item?.user?.firstName || item?.user?.name || 'Usuario'} {item?.user?.lastName || ''}
                </Text>
              </View>
            </View>

            {/* QR (DERECHA) */}
            <View style={{ 
              backgroundColor: '#fff', 
              padding: 2, 
              borderRadius: 4,
              marginLeft: 12,
              width: 45,
              height: 45,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden'
            }}>
              <View style={{ transform: [{ scale: 0.35 }] }}>
                <QRCodePlaceholder value={item.serialNumber || `TICKET-${item.id}`} />
              </View>
            </View>
          </View>

          {/* BARRA DE PROGRESO Y BOTÓN */}
          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
             <ProgressBar progress={progress} color={isWinner ? '#fbbf24' : palette.accent} />
             <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                {raffle && raffle.id ? (
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('RaffleDetail', { raffle, ticket: item })}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={{ color: palette.primary, fontWeight: 'bold', fontSize: 13, marginRight: 4 }}>Ver Detalles</Text>
                    <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.muted, { fontSize: 12 }]}>No disponible</Text>
                )}
             </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <FlatList
          data={items}
          keyExtractor={(item, index) => item?.id || `ticket-${index}`}
          renderItem={renderTicket}
          contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
          ListHeaderComponent={<Text style={styles.title}>Mis Tickets</Text>}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color={palette.primary} size="large" />
                <Text style={styles.muted}>Cargando tickets...</Text>
              </View>
            ) : (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Ionicons name="ticket-outline" size={64} color="rgba(255,255,255,0.1)" />
                <Text style={[styles.muted, { textAlign: 'center', marginTop: 16, marginBottom: 24 }]}>
                  {error || 'Aún no tienes tickets comprados.'}
                </Text>
                {!error && (
                  <TouchableOpacity 
                    onPress={() => navigation.navigate('Rifas')}
                    style={{ backgroundColor: palette.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Explorar Rifas</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      </LinearGradient>
    </SafeAreaView>
  );
}
