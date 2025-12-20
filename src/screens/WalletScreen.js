import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking
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
  const showToast = (msg, type = 'info') => {
    if (toast?.showToast) return toast.showToast(msg, type);
    Alert.alert(type === 'error' ? 'Error' : 'Info', msg);
  };

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
        setBalance(data?.balance || 0);
        setMovements(data?.transactions || []);
      }

      // Datos destino para recargar (cuentas del admin/sistema)
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
        setPayments(pData || []);
      }
    } catch (e) {
      console.log('Error loading wallet:', e);
    } finally {
      setRefreshing(false);
    }
  }, [api]);

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

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!topupAmount || Number.isNaN(amount) || amount <= 0) {
      return showToast('Monto inválido', 'error');
    }

    if (!topupProvider) {
      return showToast('Selecciona un método de recarga', 'error');
    }

    const { res, data } = await api('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount, provider: topupProvider })
    });
    if (res.ok) {
      showToast('Recarga exitosa', 'success');
      setTopupAmount('');
      setShowTopup(false);
      loadWallet();
    } else {
      showToast(data?.error || 'Error al recargar', 'error');
      if (TEST_MODE_TOPUP) {
        const now = new Date().toISOString();
        const providerLabel = topupProvider === 'mobile_payment'
          ? 'Pago móvil'
          : topupProvider === 'transfer'
            ? 'Transferencia'
            : topupProvider === 'zelle'
              ? 'Zelle'
              : topupProvider === 'binance'
                ? 'Binance'
                : topupProvider;
        const fallbackMovement = {
          {showTopup && (
            <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
              <View style={styles.rowBetween}>
                <Text style={{ color: '#e2e8f0', marginBottom: 10, fontWeight: '900' }}>Recarga</Text>
                <Text style={[styles.muted, { fontSize: 12, marginBottom: 10 }]}>Selecciona método y monto</Text>
              </View>

              <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>Método</Text>

              [{
                id: 'mobile_payment',
                label: 'Pago móvil',
                icon: 'phone-portrait-outline',
                hint: 'Transferencia móvil'
              }, {
                id: 'transfer',
                label: 'Transferencia',
                icon: 'card-outline',
                hint: 'Transferencia bancaria'
              }, {
                id: 'zelle',
                label: 'Zelle',
                icon: 'cash-outline',
                hint: 'Pago internacional'
              }, {
                id: 'binance',
                label: 'Binance',
                icon: 'logo-bitcoin',
                hint: 'Cripto / Binance'
              }].map((opt) => {
                const active = topupProvider === opt.id;
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
                    </View>
                    <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? '#4ade80' : '#94a3b8'} />
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.muted, { fontSize: 12, marginTop: 6, marginBottom: 8 }]}>Monto (Bs.)</Text>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                );
              }}
            >
              <Ionicons name="arrow-down" size={18} color="#e2e8f0" />
              <Text style={styles.ctaButtonGhostText}>Retirar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaButtonGhost} onPress={loadWallet} activeOpacity={0.9}>
              <Ionicons name="refresh" size={18} color="#e2e8f0" />
              <Text style={styles.ctaButtonGhostText}>{refreshing ? '...' : 'Actualizar'}</Text>
            </TouchableOpacity>
          </View>

          {showTopup && (
<<<<<<< HEAD
            <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 }}>
              <Text style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: '700' }}>Monto a recargar (Bs.)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
=======
            <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
              <View style={styles.rowBetween}>
                <Text style={{ color: '#e2e8f0', marginBottom: 10, fontWeight: '900' }}>Recarga</Text>
                <Text style={[styles.muted, { fontSize: 12, marginBottom: 10 }]}>Selecciona método y monto</Text>
              </View>

              <Text style={[styles.muted, { fontSize: 12, marginBottom: 8 }]}>Método</Text>

              {[
                { id: 'mobile_payment', label: 'Pago móvil', icon: 'phone-portrait-outline', hint: 'Transferencia móvil' },
                { id: 'transfer', label: 'Transferencia', icon: 'card-outline', hint: 'Transferencia bancaria' },
                { id: 'zelle', label: 'Zelle', icon: 'cash-outline', hint: 'Pago internacional' },
                { id: 'binance', label: 'Binance', icon: 'logo-bitcoin', hint: 'Cripto / Binance' }
              ].map((opt) => {
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
                          <View key={key} style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
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
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
>>>>>>> 1204166 (fix: admin parse + public profile preview)
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                  placeholder="0.00" 
                  keyboardType="numeric"
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                />
              </View>

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

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Ingresos</Text>
              <Text style={styles.statValue}>{formatMoneyVES(movements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + m.amount, 0), { decimals: 0 })}</Text>
            </View>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Gastos</Text>
              <Text style={[styles.statValue, { color: '#f97316' }]}>{formatMoneyVES(Math.abs(movements.filter(m => m.type === 'purchase').reduce((acc, m) => acc + m.amount, 0)), { decimals: 0 })}</Text>
            </View>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Tickets</Text>
              <Text style={styles.statValue}>{movements.filter(m => m.type === 'purchase').length}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.glassCard]}>
          <Text style={styles.section}>Historial de Pagos</Text>
          {payments.length === 0 ? <Text style={styles.muted}>No tienes pagos registrados.</Text> : null}
          {payments.map((p) => {
            const amount = p.amount ?? p.total ?? (p.price && p.quantity ? Number(p.price) * Number(p.quantity) : null);
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

            return (
              <View key={p.id || p.reference} style={styles.movementRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.itemTitle}>{p.raffleTitle || p.raffleId || 'Pago'}</Text>
                  <Text style={styles.muted}>
                    {new Date(p.createdAt).toLocaleDateString()}
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
