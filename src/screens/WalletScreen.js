import React, { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from '../components/UI';
import { palette } from '../theme';
import { styles } from '../styles';
import { formatMoneyVES } from '../utils';

const TEST_MODE_TOPUP = true;

export default function WalletScreen({ api }) {
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiverDetails, setReceiverDetails] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  const [topupProvider, setTopupProvider] = useState('mobile_payment');

  const toast = typeof useToast === 'function' ? useToast() : null;
  const showToast = useCallback((msg, type = 'info') => {
    if (toast?.showToast) return toast.showToast(msg, type);
    Alert.alert(type === 'error' ? 'Error' : 'Info', msg);
  }, [toast]);

  const copyValue = useCallback(async (value, label = 'Dato') => {
    const raw = String(value ?? '').trim();
    if (!raw) return;
    try {
      await Clipboard.setStringAsync(raw);
      showToast(`${label} copiado`, 'success');
    } catch (_e) {
      showToast('No se pudo copiar', 'error');
    }
  }, [showToast]);

  const loadWallet = useCallback(async () => {
    setRefreshing(true);
    try {
      const { res, data } = await api('/wallet');
      if (res.ok && data) {
        setBalance(Number(data?.balance || 0) || 0);
        setMovements(Array.isArray(data?.transactions) ? data.transactions : []);
      }

      try {
        const { res: bRes, data: bData } = await api('/admin/bank-details');
        if (bRes.ok) {
          const normalized = (bData && typeof bData === 'object' && bData.bankDetails != null)
            ? bData.bankDetails
            : bData;
          setReceiverDetails(normalized && typeof normalized === 'object' ? normalized : null);
        }
      } catch (_e) {
        // Silenciar
      }

      const { res: pRes, data: pData } = await api('/me/payments');
      if (pRes.ok) {
        setPayments(Array.isArray(pData) ? pData : []);
      }
    } catch (e) {
      console.log('Error loading wallet:', e);
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  const providerOptions = useMemo(
    () => ([
      { id: 'mobile_payment', label: 'Pago móvil', icon: 'phone-portrait-outline', hint: 'Transferencia móvil' },
      { id: 'transfer', label: 'Transferencia', icon: 'card-outline', hint: 'Transferencia bancaria' },
      { id: 'zelle', label: 'Zelle', icon: 'cash-outline', hint: 'Pago internacional' },
      { id: 'binance', label: 'Binance', icon: 'logo-bitcoin', hint: 'Cripto / Binance' }
    ]),
    []
  );

  const getProviderDetailsRows = useCallback((providerId) => {
    const d = receiverDetails && typeof receiverDetails === 'object' ? receiverDetails : {};

    const bank = d.bankName || d.bank || '';
    const phone = d.phone || '';
    const cedula = d.cedula || '';
    const accountNumber = d.accountNumber || d.account || '';
    const accountType = d.accountType || d.type || '';
    const accountName = d.accountName || d.holder || d.name || '';

    const zelleEmail = d.zelleEmail || d.zelle || d.emailZelle || d.email || '';
    const binanceId = d.binanceId || d.binancePayId || d.binancePay || d.binance || d.usdtAddress || d.wallet || '';

    if (providerId === 'mobile_payment') {
      const rows = [
        bank ? { label: 'Banco', value: bank } : null,
        phone ? { label: 'Teléfono', value: phone } : null,
        cedula ? { label: 'Cédula', value: cedula } : null
      ].filter(Boolean);
      return rows.length ? rows : [{ label: 'Datos', value: 'No configurados' }];
    }

    if (providerId === 'transfer') {
      const rows = [
        bank ? { label: 'Banco', value: bank } : null,
        accountType ? { label: 'Tipo', value: accountType } : null,
        accountNumber ? { label: 'Cuenta', value: accountNumber } : null,
        accountName ? { label: 'Titular', value: accountName } : null,
        cedula ? { label: 'Cédula', value: cedula } : null
      ].filter(Boolean);
      return rows.length ? rows : [{ label: 'Datos', value: 'No configurados' }];
    }

    if (providerId === 'zelle') {
      return zelleEmail ? [{ label: 'Email', value: zelleEmail }] : [{ label: 'Datos', value: 'No configurados' }];
    }

    if (providerId === 'binance') {
      return binanceId ? [{ label: 'ID/Wallet', value: binanceId }] : [{ label: 'Datos', value: 'No configurados' }];
    }

    return [];
  }, [receiverDetails]);

  const handleTopup = useCallback(async () => {
    const amount = Number(String(topupAmount).replace(',', '.'));
    if (!topupAmount || Number.isNaN(amount) || amount <= 0) {
      return showToast('Monto inválido', 'error');
    }

    if (!topupProvider) {
      return showToast('Selecciona un método de recarga', 'error');
    }

    try {
      const { res, data } = await api('/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount, provider: topupProvider })
      });

      if (res.ok) {
        showToast('Recarga enviada', 'success');
        setTopupAmount('');
        setShowTopup(false);
        loadWallet();
        return;
      }

      showToast(data?.error || 'Error al recargar', 'error');

      if (TEST_MODE_TOPUP) {
        const now = new Date().toISOString();
        setMovements((prev) => ([
          {
            id: `test-${Date.now()}`,
            type: 'deposit',
            amount,
            provider: topupProvider,
            createdAt: now
          },
          ...(Array.isArray(prev) ? prev : [])
        ]));
      }
    } catch (e) {
      console.log('handleTopup error:', e);
      showToast(e?.message || 'Error de conexión', 'error');
    }
  }, [api, loadWallet, showToast, topupAmount, topupProvider]);

  const stats = useMemo(() => {
    const list = Array.isArray(movements) ? movements : [];
    const ingresos = list
      .filter((m) => String(m?.type || '').toLowerCase() === 'deposit')
      .reduce((acc, m) => acc + (Number(m?.amount) || 0), 0);
    const gastos = list
      .filter((m) => String(m?.type || '').toLowerCase() === 'purchase')
      .reduce((acc, m) => acc + (Number(m?.amount) || 0), 0);
    const tickets = list.filter((m) => String(m?.type || '').toLowerCase() === 'purchase').length;
    return { ingresos, gastos: Math.abs(gastos), tickets };
  }, [movements]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.balanceCard, styles.glassCard]}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={[styles.section, { marginBottom: 0 }]}>Wallet</Text>
                <Text style={styles.muted}>Saldo disponible</Text>
              </View>
              <TouchableOpacity onPress={loadWallet} activeOpacity={0.9} style={styles.ctaButtonGhost}>
                <Ionicons name="refresh" size={18} color="#e2e8f0" />
                <Text style={styles.ctaButtonGhostText}>{refreshing ? '...' : 'Actualizar'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>{formatMoneyVES(balance, { decimals: 2 })}</Text>

            <View style={styles.ctaRow}>
              <TouchableOpacity
                style={styles.ctaButtonPrimary}
                onPress={() => setShowTopup((s) => !s)}
                activeOpacity={0.9}
              >
                <Ionicons name="arrow-up" size={18} color="#0b1224" />
                <Text style={styles.ctaButtonPrimaryText}>{showTopup ? 'Cerrar recarga' : 'Recargar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaButtonGhost}
                onPress={() => showToast('Próximamente', 'info')}
                activeOpacity={0.9}
              >
                <Ionicons name="arrow-down" size={18} color="#e2e8f0" />
                <Text style={styles.ctaButtonGhostText}>Retirar</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Ingresos</Text>
                <Text style={styles.statValue}>{formatMoneyVES(stats.ingresos, { decimals: 0 })}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Gastos</Text>
                <Text style={[styles.statValue, { color: '#f97316' }]}>{formatMoneyVES(stats.gastos, { decimals: 0 })}</Text>
              </View>
              <View style={styles.statTile}>
                <Text style={styles.statLabel}>Tickets</Text>
                <Text style={styles.statValue}>{stats.tickets}</Text>
              </View>
            </View>
          </View>

          {showTopup && (
            <View style={[styles.card, styles.glassCard]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.section, { marginBottom: 0 }]}>Recarga</Text>
                <Text style={[styles.muted, { fontSize: 12 }]}>Selecciona método y monto</Text>
              </View>

              <Text style={[styles.muted, { fontSize: 12, marginTop: 10, marginBottom: 8 }]}>Método</Text>

              {providerOptions.map((opt) => {
                const active = topupProvider === opt.id;
                const detailRows = getProviderDetailsRows(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setTopupProvider(opt.id)}
                    activeOpacity={0.85}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 14,
                      marginBottom: 8,
                      backgroundColor: active ? 'rgba(124,58,237,0.16)' : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: active ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.10)'
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: active ? 'rgba(124,58,237,0.22)' : 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: active ? 'rgba(124,58,237,0.40)' : 'rgba(255,255,255,0.10)'
                      }}
                    >
                      <Ionicons name={opt.icon} size={18} color={active ? palette.primary : '#e2e8f0'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: '900' }}>{opt.label}</Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>{opt.hint}</Text>
                      {detailRows.map((row) => {
                        const key = `${opt.id}-${row.label}-${row.value}`;
                        const canCopy = row.value && row.value !== 'No configurados';
                        return (
                          <View
                            key={key}
                            style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
                          >
                            <Text style={{ color: '#cbd5e1', fontSize: 12, flex: 1 }} numberOfLines={2}>
                              {row.label}: <Text style={{ color: '#fff', fontWeight: '800' }}>{row.value}</Text>
                            </Text>
                            {canCopy ? (
                              <TouchableOpacity
                                onPress={() => copyValue(row.value, row.label)}
                                activeOpacity={0.85}
                                style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
                              >
                                <Ionicons name="copy-outline" size={16} color="#e2e8f0" />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                    <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? '#4ade80' : '#94a3b8'} />
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.muted, { fontSize: 12, marginTop: 6, marginBottom: 8 }]}>Monto (Bs.)</Text>
              <TextInput
                style={[styles.input, { marginBottom: 0 }]}
                placeholder="0.00"
                keyboardType="numeric"
                value={topupAmount}
                onChangeText={setTopupAmount}
              />

              <TouchableOpacity
                onPress={handleTopup}
                activeOpacity={0.9}
                style={[styles.primaryButton, { marginTop: 10 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={styles.primaryButtonText}>Confirmar recarga</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.card, styles.glassCard]}>
            <Text style={styles.section}>Movimientos</Text>
            {Array.isArray(movements) && movements.length === 0 ? (
              <Text style={styles.muted}>No tienes movimientos registrados.</Text>
            ) : null}

            {(Array.isArray(movements) ? movements : []).map((m, idx) => {
              const id = m?.id || m?._id || `${idx}`;
              const type = String(m?.type || 'movimiento');
              const amount = Number(m?.amount || 0) || 0;
              const createdAt = m?.createdAt ? new Date(m.createdAt) : null;
              return (
                <View key={id} style={styles.movementRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.itemTitle}>{type === 'purchase' ? 'Compra' : type === 'deposit' ? 'Recarga' : 'Movimiento'}</Text>
                    <Text style={styles.muted}>{createdAt ? createdAt.toLocaleDateString() : ''}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: type === 'purchase' ? '#f97316' : '#fbbf24', fontWeight: '800' }}>{formatMoneyVES(amount)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={[styles.card, styles.glassCard]}>
            <Text style={styles.section}>Historial de Pagos</Text>
            {Array.isArray(payments) && payments.length === 0 ? <Text style={styles.muted}>No tienes pagos registrados.</Text> : null}
            {(Array.isArray(payments) ? payments : []).map((p) => {
              const amount = p.amount ?? p.total ?? (p.price && p.quantity ? Number(p.price) * Number(p.quantity) : 0);
              const status = String(p.status || 'pendiente');
              const isApproved = status === 'approved';
              const isPending = status === 'pending';

              const prov = String(p?.provider || '').trim().toLowerCase();
              const providerLabel =
                prov === 'mobile_payment'
                  ? 'Pago móvil'
                  : prov === 'transfer'
                    ? 'Transferencia'
                    : prov === 'zelle'
                      ? 'Zelle'
                      : prov === 'binance'
                        ? 'Binance'
                        : prov;

              const key = p.id || p.reference || `${p.createdAt || ''}-${Math.random()}`;

              return (
                <View key={key} style={styles.movementRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.itemTitle}>{p.raffleTitle || p.raffleId || 'Pago'}</Text>
                    <Text style={styles.muted}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}
                      {providerLabel ? ` · ${providerLabel}` : ''}
                    </Text>
                    {p.reference ? <Text style={styles.muted}>Ref: {p.reference}</Text> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#fbbf24', fontWeight: '800' }}>{formatMoneyVES(amount || 0)}</Text>
                    <Text style={[styles.statusPill, isApproved ? styles.statusApproved : isPending ? styles.statusPending : styles.statusRejected]}>{status}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
