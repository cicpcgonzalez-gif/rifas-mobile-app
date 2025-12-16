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
import { useFocusEffect } from '@react-navigation/native';
import { useToast } from '../components/UI';
import { palette } from '../theme';
import { styles } from '../styles';

const TEST_MODE_TOPUP = true;

export default function WalletScreen({ api }) {
  const [refreshing, setRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [movements, setMovements] = useState([]);
  const [payments, setPayments] = useState([]);
  const [topupAmount, setTopupAmount] = useState('');
  const [showTopup, setShowTopup] = useState(false);
  
  const toast = typeof useToast === 'function' ? useToast() : null;
  const showToast = (msg, type = 'info') => {
    if (toast?.showToast) return toast.showToast(msg, type);
    Alert.alert(type === 'error' ? 'Error' : 'Info', msg);
  };

  const loadWallet = useCallback(async () => {
    setRefreshing(true);
    try {
      const { res, data } = await api('/wallet');
      if (res.ok && data) {
        setBalance(data?.balance || 0);
        setMovements(data?.transactions || []);
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

  const handleTopup = async () => {
    const amount = Number(topupAmount);
    if (!topupAmount || Number.isNaN(amount) || amount <= 0) {
      return showToast('Monto inválido', 'error');
    }
    const { res, data } = await api('/wallet/topup', {
      method: 'POST',
      body: JSON.stringify({ amount })
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
        const fallbackMovement = {
          id: `local-${Date.now()}`,
          type: 'deposit',
          amount,
          status: 'approved',
          createdAt: now,
          reference: 'SIMULADO-TEST'
        };
        setBalance((b) => b + amount);
        setMovements((m) => [fallbackMovement, ...m]);
        setTopupAmount('');
        setShowTopup(false);
        showToast('Recarga simulada (modo prueba)', 'success');
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Wallet</Text>

        <View style={styles.balanceCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.section}>Saldo disponible</Text>
              <Text style={styles.balanceValue}>VES {balance.toFixed(2)}</Text>
            </View>
            <View style={styles.circleAccent}>
              <Ionicons name="wallet-outline" size={22} color="#fbbf24" />
            </View>
          </View>
          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaButtonPrimary} onPress={() => setShowTopup(!showTopup)} activeOpacity={0.9}>
              <Ionicons name="add" size={18} color="#0b1224" />
              <Text style={styles.ctaButtonPrimaryText}>Recargar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaButtonGhost}
              activeOpacity={0.9}
              onPress={() => {
                Alert.alert(
                  'Retirar saldo',
                  'Para solicitar un retiro, contáctanos por WhatsApp con el monto y tus datos de pago.',
                  [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                      text: 'Abrir WhatsApp',
                      onPress: () => {
                        Linking.openURL('https://wa.me/584227930168');
                      }
                    }
                  ]
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
            <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12 }}>
              <Text style={{ color: '#e2e8f0', marginBottom: 8, fontWeight: '700' }}>Monto a recargar (VES)</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput 
                  style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                  placeholder="0.00" 
                  keyboardType="numeric"
                  value={topupAmount}
                  onChangeText={setTopupAmount}
                />
                <TouchableOpacity onPress={handleTopup} style={{ backgroundColor: '#10b981', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Ingresos</Text>
              <Text style={styles.statValue}>VES {movements.filter(m => m.type === 'deposit').reduce((acc, m) => acc + m.amount, 0).toFixed(0)}</Text>
            </View>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Gastos</Text>
              <Text style={[styles.statValue, { color: '#f97316' }]}>VES {Math.abs(movements.filter(m => m.type === 'purchase').reduce((acc, m) => acc + m.amount, 0)).toFixed(0)}</Text>
            </View>
            <View style={styles.statTile}> 
              <Text style={styles.statLabel}>Tickets</Text>
              <Text style={styles.statValue}>{movements.filter(m => m.type === 'purchase').length}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, styles.glassCard]}>
          <Text style={styles.section}>Actividad Reciente</Text>
          <View style={{ marginTop: 8 }}>
            {movements.length === 0 ? (
              <Text style={styles.muted}>No hay movimientos recientes.</Text>
            ) : (
              movements.map((m) => (
                <View key={m.id} style={styles.movementRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.movementBadge, { backgroundColor: m.type === 'deposit' ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)', borderColor: m.type === 'deposit' ? 'rgba(16,185,129,0.35)' : 'rgba(248,113,113,0.35)' }]}> 
                      <Ionicons name={m.type === 'deposit' ? 'arrow-up' : 'arrow-down'} size={16} color={m.type === 'deposit' ? '#10b981' : '#f87171'} />
                    </View>
                    <View>
                      <Text style={styles.itemTitle}>{m.reference || (m.type === 'deposit' ? 'Recarga' : 'Compra')}</Text>
                      <Text style={styles.muted}>{new Date(m.createdAt).toLocaleDateString()} · {m.type === 'deposit' ? 'Entrada' : 'Salida'}</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: m.type === 'deposit' ? '#10b981' : '#f87171', fontWeight: '800' }}>{m.type === 'deposit' ? '+' : ''}VES {m.amount.toFixed(2)}</Text>
                    <Text style={[styles.statusPill, m.status === 'approved' ? styles.statusApproved : m.status === 'pending' ? styles.statusPending : styles.statusRejected]}>{m.status}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.card, styles.glassCard]}>
          <Text style={styles.section}>Historial de Pagos</Text>
          {payments.length === 0 ? <Text style={styles.muted}>No tienes pagos registrados.</Text> : null}
          {payments.map((p) => {
            const amount = p.amount ?? p.total ?? (p.price && p.quantity ? Number(p.price) * Number(p.quantity) : null);
            return (
              <View key={p.id || p.reference} style={styles.receiptCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{p.raffleTitle || p.raffleId || 'Pago'}</Text>
                  <Text style={styles.ghostPill}>{p.status || 'pendiente'}</Text>
                </View>
                <Text style={styles.muted}>Ref: {p.reference || '—'}</Text>
                <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>VES {amount || '0.00'}</Text>
                <Text style={styles.muted}>{new Date(p.createdAt).toLocaleDateString()}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
