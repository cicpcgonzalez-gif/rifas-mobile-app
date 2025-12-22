import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
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

  const HIDDEN_KEY = 'hidden_ticket_raffle_ids_v1';

  const loadHiddenRaffleIds = useCallback(async () => {
    try {
      const raw = await SecureStore.getItemAsync(HIDDEN_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      return new Set(arr.map((x) => String(x)));
    } catch (_e) {
      return new Set();
    }
  }, []);

  const hideRaffleFromHistory = useCallback(async (raffleId) => {
    const id = String(raffleId || '').trim();
    if (!id) return;
    const confirmed = await new Promise((resolve) => {
      // eslint-disable-next-line no-undef
      Alert.alert(
        'Eliminar de mis tickets',
        'Esto solo lo oculta de tu historial en el teléfono. ¿Deseas continuar?',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }
        ]
      );
    });
    if (!confirmed) return;

    try {
      const hidden = await loadHiddenRaffleIds();
      hidden.add(id);
      await SecureStore.setItemAsync(HIDDEN_KEY, JSON.stringify(Array.from(hidden)));
      setItems((prev) => (Array.isArray(prev) ? prev.filter((it) => String(it?.raffle?.id || '') !== id) : []));
    } catch (_e) {
      // Silenciar
    }
  }, [loadHiddenRaffleIds]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const hidden = await loadHiddenRaffleIds();
      const { res, data } = await api('/me/raffles');
      if (res.ok && Array.isArray(data)) {
        const list = data
          .filter(Boolean)
          .filter((it) => {
            const rid = String(it?.raffle?.id || '').trim();
            return !rid || !hidden.has(rid);
          });
        setItems(list);
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
  }, [api, loadHiddenRaffleIds]);

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
    const resultsPublished = !!item.resultsPublished;
    const raffleStatus = String(raffle?.status || item.status || '').toLowerCase();
    const isClosed = raffleStatus === 'closed';

    const status = isWinner
      ? 'Ganador'
      : isClosed && resultsPublished
        ? 'No ganaste'
        : isClosed
          ? 'Esperando resultados'
          : 'Activa';

    const statusColor = isWinner ? '#fbbf24' : (status === 'No ganaste' ? '#f87171' : (isClosed ? '#fbbf24' : '#4ade80'));
    const numbers = Array.isArray(item.numbers) ? item.numbers.filter((n) => n !== null && n !== undefined) : [];
    const qty = numbers.length;
    const unitPrice = item?.payment?.unitPrice ?? item?.unitPrice ?? item?.price ?? raffle?.ticketPrice ?? raffle?.price;
    const unitPriceNum = Number(unitPrice);
    const totalPrice = Number.isFinite(unitPriceNum) ? unitPriceNum * qty : null;
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

    const totalSpentRaw = item?.payment?.totalSpent;
    const totalSpentNum = Number(totalSpentRaw);
    const totalSpent = Number.isFinite(totalSpentNum) ? totalSpentNum : null;
    const safeTotalSpent = totalSpent === 0 && totalPrice != null && totalPrice > 0 ? null : totalSpent;
    const motto = stableMottoForSeed(item?.serialNumber || `${raffle?.id || ''}-${serialShort}`);
    const canHide = isClosed && resultsPublished && !isWinner;

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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {numbers.map((n, idx) => (
                    <View
                      key={`${n}-${idx}`}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(15, 23, 42, 0.10)',
                        backgroundColor: 'rgba(15, 23, 42, 0.04)'
                      }}
                    >
                      <Text style={{ color: '#0f172a', fontSize: 12, fontFamily: 'monospace', fontWeight: '800' }}>
                        {formatTicketNumber(n, raffle?.digits)}
                      </Text>
                    </View>
                  ))}
                </View>
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
                {safeTotalSpent != null ? formatMoney(safeTotalSpent) : (totalPrice === null ? '—' : formatMoney(totalPrice))}
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
              <View style={{ width: 110, marginTop: 6 }}>
                <ProgressBar progress={progress} color={isWinner ? '#fbbf24' : palette.accent} />
              </View>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={{ color: 'rgba(15, 23, 42, 0.75)', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{motto}</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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

              {canHide && raffle?.id ? (
                <TouchableOpacity onPress={() => hideRaffleFromHistory(raffle.id)}>
                  <Text style={{ color: '#f87171', fontWeight: '900', fontSize: 13 }}>Eliminar</Text>
                </TouchableOpacity>
              ) : null}
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
