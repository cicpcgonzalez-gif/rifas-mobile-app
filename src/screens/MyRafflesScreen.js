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
import { ProgressBar } from '../components/UI';
import { formatTicketNumber } from '../utils';

const formatReceiptDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatMoney = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
};

const LUCKY_MOTTOS = [
  '¡La suerte está contigo hoy!',
  'Confía en tu número, brilla fuerte.',
  'Hoy puede ser tu gran día.',
  'La esperanza siempre gana.',
  'Tu ticket guarda una sorpresa.',
  'El destino sonríe a los valientes.',
  'Cada número es una oportunidad.',
  'La fortuna favorece a los soñadores.',
  'Tu suerte está en camino.',
  'El éxito comienza con la confianza.',
  'Este ticket puede cambiar tu vida.',
  'La suerte se construye con fe.',
  'Tu número tiene energía positiva.',
  'La fortuna está más cerca de lo que piensas.',
  'Confía, tu momento llegará.',
  'El azar premia a los persistentes.',
  'Tu ticket es un símbolo de esperanza.',
  'La suerte siempre encuentra su camino.',
  'Hoy tu número puede ser el ganador.',
  'La magia de la rifa está contigo.'
];

const stableMottoForSeed = (seed) => {
  const s = String(seed || '0');
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return LUCKY_MOTTOS[h % LUCKY_MOTTOS.length];
};

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
    const numbers = Array.isArray(item.numbers) ? item.numbers.filter((n) => n !== null && n !== undefined) : [];
    const qty = numbers.length;
    const unitPrice = raffle?.price;
    const totalPrice = Number.isFinite(Number(unitPrice)) ? Number(unitPrice) * qty : null;
    const serialShort = item.serialNumber ? String(item.serialNumber).slice(-8).toUpperCase() : (item.id ? String(item.id) : '—');

    const purchasedAt = item?.payment?.purchasedAt || item.createdAt;
    const whenLabel = formatReceiptDateTime(purchasedAt);

    const sellerName = raffle?.user?.name || '—';
    const sellerSecurityId = raffle?.user?.securityId || '';

    const prov = String(item?.payment?.method || '').trim().toLowerCase();
    const providerLabel =
      prov === 'wallet'
        ? 'Saldo'
        : prov === 'mobile_payment'
          ? 'Pago móvil'
          : prov === 'transfer'
            ? 'Transferencia'
            : prov === 'zelle'
              ? 'Zelle'
              : prov === 'binance'
                ? 'Binance'
                : prov || '—';

    const totalSpent = item?.payment?.totalSpent;
    const motto = stableMottoForSeed(item?.serialNumber || `${raffle?.id || ''}-${serialShort}`);
    const footerMotto = stableMottoForSeed(`footer-${item?.serialNumber || item?.id || `${raffle?.id || ''}-${serialShort}`}`);

    return (
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: 14,
        marginBottom: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: isWinner ? '#fbbf24' : 'rgba(15, 23, 42, 0.18)',
      }}>
        {/* Encabezado (tipo farmacia) */}
        <View style={{ padding: 14 }}>
          <View style={{ alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '900', letterSpacing: 2 }}>MEGARIFAS</Text>
            <Text style={{ color: 'rgba(15, 23, 42, 0.6)', fontSize: 10, marginTop: 2 }}>{whenLabel}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: '#0f172a', fontSize: 14, fontWeight: '800' }} numberOfLines={2}>{raffle.title || 'Rifa'}</Text>
              {!!raffle.description && (
                <Text style={{ color: 'rgba(15, 23, 42, 0.65)', fontSize: 11, marginTop: 2 }} numberOfLines={2}>{raffle.description}</Text>
              )}

              <Text style={{ color: 'rgba(15, 23, 42, 0.7)', fontSize: 11, marginTop: 6 }} numberOfLines={1}>
                Vendedor: {sellerName}{sellerSecurityId ? ` (${sellerSecurityId})` : ''}
              </Text>
            </View>
            <View style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: statusColor,
              backgroundColor: 'rgba(15, 23, 42, 0.04)'
            }}>
              <Text style={{ color: statusColor, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>{status}</Text>
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(15, 23, 42, 0.10)', marginTop: 10, paddingTop: 10 }}>
            <Text style={{ color: 'rgba(15, 23, 42, 0.65)', fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Números</Text>

            {qty > 0 ? (
              <View style={{ marginTop: 8 }}>
                {numbers.map((n, idx) => (
                  <View key={`${n}-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: idx === qty - 1 ? 0 : 1, borderBottomColor: 'rgba(15, 23, 42, 0.06)' }}>
                    <Text style={{ color: '#0f172a', fontSize: 12, fontFamily: 'monospace' }}>#{String(idx + 1).padStart(2, '0')}</Text>
                    <Text style={{ color: '#0f172a', fontSize: 12, fontFamily: 'monospace', fontWeight: '800' }}>{formatTicketNumber(n, raffle?.digits)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: 'rgba(15, 23, 42, 0.55)', fontSize: 12, marginTop: 6 }}>—</Text>
            )}
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(15, 23, 42, 0.10)', marginTop: 12, paddingTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(15, 23, 42, 0.7)', fontSize: 11 }}>Cantidad</Text>
              <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800' }}>{qty}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(15, 23, 42, 0.7)', fontSize: 11 }}>Método de pago</Text>
              <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800' }}>{providerLabel}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={{ color: 'rgba(15, 23, 42, 0.7)', fontSize: 11 }}>Precio unitario</Text>
              <Text style={{ color: '#0f172a', fontSize: 11, fontWeight: '800' }}>{formatMoney(unitPrice)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '900' }}>TOTAL</Text>
              <Text style={{ color: '#0f172a', fontSize: 12, fontWeight: '900' }}>
                {totalSpent != null ? formatMoney(totalSpent) : (totalPrice === null ? '—' : formatMoney(totalPrice))}
              </Text>
            </View>
          </View>
        </View>

        {/* Talón / Pie */}
        <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.04)', padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(15, 23, 42, 0.10)' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: 'rgba(15, 23, 42, 0.65)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>Serial</Text>
              <Text style={{ color: '#0f172a', fontSize: 12, fontFamily: 'monospace', fontWeight: '800' }}>{serialShort}</Text>
              <Text style={{ color: 'rgba(15, 23, 42, 0.6)', fontSize: 10, marginTop: 6 }}>Conserva este comprobante. No requiere QR.</Text>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: 'rgba(15, 23, 42, 0.65)', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>Progreso</Text>
              <View style={{ width: 110, marginTop: 6 }}>
                <ProgressBar progress={progress} color={isWinner ? '#fbbf24' : palette.accent} />
              </View>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: 'rgba(15, 23, 42, 0.75)', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{motto}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
              {raffle && raffle.id ? (
                <TouchableOpacity
                  onPress={() => navigation.navigate('RaffleDetail', { raffle, ticket: item })}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Text style={{ color: palette.primary, fontWeight: '900', fontSize: 13, marginRight: 4 }}>Ver detalles</Text>
                  <Ionicons name="chevron-forward" size={14} color={palette.primary} />
                </TouchableOpacity>
              ) : (
                <Text style={[styles.muted, { fontSize: 12 }]}>No disponible</Text>
              )}
            </View>
            
            <View style={{ marginTop: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(15,23,42,0.06)', paddingTop: 8 }}>
              <Text style={{ color: palette.primary, fontSize: 11, fontStyle: 'italic', fontWeight: '600' }}>
                "{footerMotto}"
              </Text>
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
