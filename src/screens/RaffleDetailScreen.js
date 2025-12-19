import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Animated,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { palette } from '../theme';
import { styles } from '../styles';
import { FilledButton, OutlineButton } from '../components/UI';
import { formatTicketNumber, formatMoneyVES } from '../utils';
import PublicProfileModal from '../components/PublicProfileModal';

const { width } = Dimensions.get('window');

export default function RaffleDetailScreen({ route, navigation, api }) {
  const { raffle, ticket } = route.params || {};
  const getMinTickets = (r) => {
    const raw = r?.minTickets ?? r?.style?.minTickets;
    const n = Number(raw);
    const parsed = Number.isFinite(n) ? Math.floor(n) : 1;
    return Math.max(1, parsed);
  };

  // Local state to hold the raffle data, initialized with param but updatable
  const [current, setCurrent] = useState(raffle || {});
  const [quantity, setQuantity] = useState(String(getMinTickets(raffle || {})));
  const [buying, setBuying] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualProof, setManualProof] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1);
  const [manualProvider, setManualProvider] = useState('');
  const [assignedNumbers, setAssignedNumbers] = useState([]);
  const numbersAnim = useRef(new Animated.Value(0)).current;
  const [supportVisible, setSupportVisible] = useState(false);
  const [bankDetails, setBankDetails] = useState(null);
  const [sellerPaymentMethods, setSellerPaymentMethods] = useState([]);
  const stats = current?.stats || {};
  const style = current?.style || {};
  const safeGallery = Array.isArray(style?.gallery)
    ? style.gallery.filter((uri) => typeof uri === 'string' && uri.trim().length > 0)
    : [];
  const safeBannerImage = typeof style?.bannerImage === 'string' && style.bannerImage.trim().length > 0
    ? style.bannerImage
    : null;
  const themeColor = style?.themeColor || palette.primary;
  const [viewProfileId, setViewProfileId] = useState(null);
  const [termsVisible, setTermsVisible] = useState(false);
  const [riferoRating, setRiferoRating] = useState(null);
  const [mySecurityId, setMySecurityId] = useState('');
  const userDisplayName = current?.user?.name || current?.user?.firstName || 'MegaRifas Oficial';
  const userInitial = (String(userDisplayName).trim().charAt(0) || 'M').toUpperCase();
  const totalTickets = current?.totalTickets || stats?.total || 0;
  const sold = stats?.sold || 0;
  const remaining = stats?.remaining ?? (totalTickets ? Math.max(totalTickets - sold, 0) : 0);
  const percentLeft = totalTickets ? Math.max(0, Math.min(100, (remaining / totalTickets) * 100)) : 0;
  const status = String(current?.status || '').toLowerCase();
  const endMs = Date.parse(current?.endDate);
  const endedByTime = Number.isFinite(endMs) && endMs > 0 && endMs < Date.now();
  const isClosed = status !== 'active' || endedByTime;
  const isAgotada = !isClosed && ((current?.isSoldOut === true) || Number(remaining) === 0);
  const playDisabled = isClosed || isAgotada;
  const safeSecurityId = typeof current?.user?.securityId === 'string' ? current.user.securityId : '';
  const safeAvatarUri = typeof current?.user?.avatar === 'string' && current.user.avatar.trim().length > 0 ? current.user.avatar : null;
  const ticketNumber = ticket?.number ?? (Array.isArray(ticket?.numbers) ? ticket.numbers[0] : ticket?.numbers);
  const userBoostActive = !!current?.user?.isBoosted;
  const boostEndsAt = current?.user?.boostEndsAt ? Date.parse(current.user.boostEndsAt) : 0;

  // Fetch full raffle details if missing critical data
  useEffect(() => {
    if (!current || !current.id) return;
    if (!api || typeof api !== 'function') return;
    // If stats or style are missing, fetch fresh data
    if (!current.stats || !current.style) {
      api(`/raffles/${current.id}`).then(({ res, data }) => {
        if (res.ok && data) {
          setCurrent(prev => ({ ...prev, ...data }));
        }
      });
    }
  }, [current?.id, api]);

  // Asegura que la cantidad nunca quede por debajo del mínimo del rifero
  useEffect(() => {
    const min = getMinTickets(current);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < min) {
      setQuantity(String(min));
    }
  }, [current, quantity]);
    if (!api || !current?.id) return;
    api(`/raffles/${current.id}/payment-details`).then(({ res, data }) => {
      if (!res.ok) return;
      const methods = Array.isArray(data?.paymentMethods) ? data.paymentMethods : [];
      setSellerPaymentMethods(methods);
      if (data?.bankDetails) setBankDetails(data.bankDetails);
    });
  }, [api, current?.id]);

  useEffect(() => {
    // Método por defecto: el primero seleccionado por el rifero (si existe)
    const supported = new Set(['mobile_payment', 'zelle', 'binance', 'transfer']);
    const list = Array.isArray(sellerPaymentMethods) ? sellerPaymentMethods : [];
    const first = list.find((m) => supported.has(String(m)));
    if (!manualProvider && first) setManualProvider(String(first));
  }, [sellerPaymentMethods, manualProvider]);

  useEffect(() => {
    const riferoId = current?.user?.id;
    if (!api || !riferoId) return;
    api(`/users/public/${riferoId}/rating-summary`)
      .then(({ res, data }) => {
        if (res.ok) setRiferoRating(data);
      })
      .catch(() => {});
  }, [api, current?.user?.id]);

  useEffect(() => {
    if (!api) return;
    api('/me')
      .then(({ res, data }) => {
        if (!res.ok) return;
        const sid = data?.securityId || data?.publicId || data?.id || '';
        if (typeof sid === 'string') setMySecurityId(sid);
      })
      .catch(() => {});
  }, [api]);

  if (!current || !current.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: palette.text, fontSize: 18 }}>Rifa no encontrada</Text>
          <OutlineButton title="Volver" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const [showPurchase, setShowPurchase] = useState(false);
  
  // Report System
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('fraud');
  const [reportComment, setReportComment] = useState('');
  const [reporting, setReporting] = useState(false);

  const submitReport = async () => {
    if (!reportComment.trim()) return Alert.alert('Detalles requeridos', 'Por favor describe brevemente el motivo del reporte.');
    
    setReporting(true);
    const { res, data } = await api('/reports', {
      method: 'POST',
      body: JSON.stringify({
        raffleId: current.id,
        category: reportReason,
        comment: reportComment
      })
    });
    setReporting(false);

    if (res.ok) {
      setReportVisible(false);
      setReportComment('');
      Alert.alert('Reporte enviado', 'Gracias por ayudarnos a mantener la comunidad segura. Revisaremos este caso.');
    } else {
      Alert.alert('Error', data.error || 'No se pudo enviar el reporte.');
    }
  };

  const isInfoView = !!ticket;
  if (isInfoView) {
    const numbers = Array.isArray(ticket?.numbers)
      ? ticket.numbers.filter((n) => n !== null && n !== undefined)
      : ticket?.number != null
        ? [ticket.number]
        : [];

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginLeft: -6 }}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.title, { marginBottom: 0, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{current.title}</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={styles.section}>Rifero</Text>

            <TouchableOpacity
              disabled={!current?.user?.id}
              onPress={() => current.user && setViewProfileId(current.user.id)}
              style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                {safeAvatarUri ? (
                  <Image source={{ uri: safeAvatarUri }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <Text style={{ color: '#000', fontWeight: '900' }}>{userInitial}</Text>
                )}
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }} numberOfLines={1}>{userDisplayName}</Text>
                {safeSecurityId ? (
                  <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={1}>ID: {safeSecurityId}</Text>
                ) : null}
              </View>
              {!!current?.user?.id ? (
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <Text style={styles.section}>Tickets comprados</Text>
            {numbers.length === 0 ? (
              <Text style={styles.muted}>No hay números disponibles.</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {numbers.map((n, idx) => (
                  <View
                    key={`${n}-${idx}`}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: idx === numbers.length - 1 ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: '#94a3b8', fontWeight: '800' }}>#{String(idx + 1).padStart(2, '0')}</Text>
                    <Text style={{ color: '#fff', fontWeight: '900', fontFamily: 'monospace' }}>{formatTicketNumber(n, current?.digits)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <PublicProfileModal visible={!!viewProfileId} userId={viewProfileId} onClose={() => setViewProfileId(null)} api={api} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const purchase = async () => {
    if (isClosed) return Alert.alert('Rifa cerrada', 'Esta rifa ya culminó y no permite compras.');
    if (isAgotada) return Alert.alert('Rifa agotada', 'Esta rifa ya no tiene números disponibles para la venta.');
    const min = getMinTickets(current);
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) return Alert.alert('Cantidad invalida', 'Ingresa una cantidad mayor a 0.');
    if (qty < min) return Alert.alert('Cantidad invalida', `La compra mínima para esta rifa es ${min}.`);
    
    setBuying(true);
    const { res, data } = await api(`/raffles/${current.id}/purchase`, {
      method: 'POST',
      body: JSON.stringify({ quantity: qty })
    });
    if (res.ok) {
      const nums = Array.isArray(data.numbers) ? data.numbers : [];
      setAssignedNumbers(nums);
      numbersAnim.setValue(0);
      Animated.spring(numbersAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
      const positive = nums.length <= 1 ? '¡Tu número ya está en juego!' : '¡Tus números ya están en juego!';
      Alert.alert('Compra confirmada', `${positive}\nNúmeros: ${nums.map(n => formatTicketNumber(n, current.digits)).join(', ')}`);
      setPaymentStep(1);
      setManualProof(null);
    } else {
      Alert.alert('Ups', data.error || 'No se pudo completar la compra.');
    }
    setBuying(false);
  };

  const pickProof = async () => {
    if (isClosed) return Alert.alert('Rifa cerrada', 'Esta rifa ya culminó y no permite pagos.');
    if (isAgotada) return Alert.alert('Rifa agotada', 'Esta rifa ya no tiene números disponibles para la venta.');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setManualProof({ uri: asset.uri, base64: asset.base64 });
    }
  };

  const submitManualPayment = async () => {
    if (isClosed) return Alert.alert('Rifa cerrada', 'Esta rifa ya culminó y no permite pagos.');
    if (isAgotada) return Alert.alert('Rifa agotada', 'Esta rifa ya no tiene números disponibles para la venta.');
    const min = getMinTickets(current);
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) return Alert.alert('Cantidad invalida', 'Ingresa una cantidad mayor a 0.');
    if (qty < min) return Alert.alert('Cantidad invalida', `La compra mínima para esta rifa es ${min}.`);
    if (sellerPaymentMethods?.length && !manualProvider) {
      return Alert.alert('Método requerido', 'Selecciona un método de pago antes de enviar el comprobante.');
    }
    if (!manualProof?.base64) return Alert.alert('Falta comprobante', 'Adjunta la captura del pago.');
    setManualLoading(true);
    const { res, data } = await api(`/raffles/${current.id}/manual-payments`, {
      method: 'POST',
      body: JSON.stringify({
        quantity: qty,
        provider: manualProvider,
        reference: manualRef,
        note: manualNote,
        proof: `data:image/jpeg;base64,${manualProof.base64}`
      })
    });
    if (res.ok) {
      Alert.alert('Enviado', 'Pago pendiente de aprobación. Te avisaremos cuando se validen tus números.');
      setManualRef('');
      setManualNote('');
      setManualProof(null);
      setPaymentStep(1);
    } else {
      Alert.alert('Ups', data.error || 'No se pudo registrar el pago.');
    }
    setManualLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setReportVisible(true)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Report Modal */}
        <Modal visible={reportVisible} transparent animationType="fade" onRequestClose={() => setReportVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>Reportar Rifa</Text>
                <TouchableOpacity onPress={() => setReportVisible(false)}>
                  <Ionicons name="close" size={24} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <Text style={{ color: palette.muted, marginBottom: 12 }}>Selecciona el motivo:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[
                  { id: 'fraud', label: 'Posible Fraude' },
                  { id: 'inappropriate', label: 'Inapropiado' },
                  { id: 'spam', label: 'Spam' },
                  { id: 'other', label: 'Otro' }
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setReportReason(opt.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: reportReason === opt.id ? palette.primary : 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: reportReason === opt.id ? palette.primary : 'rgba(255,255,255,0.1)'
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ color: palette.muted, marginBottom: 8 }}>Detalles adicionales:</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Describe el problema..."
                placeholderTextColor={palette.muted}
                multiline
                value={reportComment}
                onChangeText={setReportComment}
              />

              <FilledButton
                title={reporting ? 'Enviando...' : 'Enviar Reporte'}
                onPress={submitReport}
                disabled={reporting}
                style={{ marginTop: 16, backgroundColor: '#ef4444' }}
              />
            </View>
          </View>
        </Modal>

        {safeGallery.length > 0 ? (
          <View style={{ height: 260, marginBottom: 16 }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {safeGallery.map((img, index) => (
                <View key={index} style={{ width: width - 32, height: 260, borderRadius: 12, overflow: 'hidden', marginRight: 0, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                  <ImageBackground source={{ uri: img }} style={{ flex: 1 }} blurRadius={12}>
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                      <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </View>
                  </ImageBackground>
                </View>
              ))}
            </ScrollView>
            <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {safeGallery.map((_, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }} />
              ))}
            </View>
          </View>
        ) : safeBannerImage ? (
          <View style={{ height: 220, marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <ImageBackground source={{ uri: safeBannerImage }} style={{ flex: 1 }} blurRadius={12}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <Image source={{ uri: safeBannerImage }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
              </View>
            </ImageBackground>
          </View>
        ) : null}
        
        <Text style={[styles.title, { color: themeColor }]}>{current.title}</Text>
        
        {current.terms ? (
          <TouchableOpacity onPress={() => setTermsVisible(true)} style={{ marginBottom: 16 }}>
            <Text style={{ color: palette.accent, textDecorationLine: 'underline' }}>Ver Términos y Condiciones</Text>
          </TouchableOpacity>
        ) : null}

        <Modal visible={termsVisible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 20, maxHeight: '80%' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Términos y Condiciones</Text>
              <ScrollView>
                <Text style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 24 }}>{current.terms}</Text>
              </ScrollView>
              <TouchableOpacity onPress={() => setTermsVisible(false)} style={{ marginTop: 16, alignItems: 'center', padding: 10, backgroundColor: palette.primary, borderRadius: 8 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Aceptar y Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.card}>
          <TouchableOpacity 
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}
            onPress={() => current.user && setViewProfileId(current.user.id)}
          >
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
               {safeAvatarUri ? (
                 <Image source={{ uri: safeAvatarUri }} style={{ width: 40, height: 40, borderRadius: 20 }} />
               ) : (
                 <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>{userInitial}</Text>
               )}
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 4 }}>
                  {userDisplayName}
                </Text>
                {current.user?.identityVerified && <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>ID: {safeSecurityId ? safeSecurityId.slice(-8).toUpperCase() : 'VERIFICADO'}</Text>
              </View>

              {(riferoRating?.count || riferoRating?.avgScore != null || userBoostActive) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                  {riferoRating && (riferoRating.count || riferoRating.avgScore != null) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
                      <Ionicons name="star" size={12} color="#fbbf24" />
                      <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '900' }}>
                        {riferoRating.avgScore == null ? '—' : Number(riferoRating.avgScore).toFixed(1)}/10
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>({riferoRating.count || 0})</Text>
                    </View>
                  ) : null}

                  {userBoostActive && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(251, 191, 36, 0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.35)' }}>
                      <Ionicons name="flash" size={12} color="#fbbf24" />
                      <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: '900' }}>PROMOCIONADO</Text>
                      {boostEndsAt ? (
                        <Text style={{ color: '#fde68a', fontSize: 11 }}>· {new Date(boostEndsAt).toLocaleDateString()}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
               <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </View>
          </TouchableOpacity>

          <View style={{ marginBottom: 8 }}>
            <Text style={styles.muted}>
              Precio {formatMoneyVES(current.price, { decimals: 0 })} • Disponibles {remaining} / {totalTickets || '∞'} ({percentLeft.toFixed(0)}%)
            </Text>
            <View style={{ height: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, overflow: 'hidden', marginTop: 6 }}>
              <View style={{ width: `${percentLeft}%`, height: '100%', backgroundColor: themeColor }} />
            </View>
          </View>
          
          {(style.whatsapp || style.instagram || current.support) && (
            <View style={{ marginTop: 8, flexDirection: 'row', gap: 10 }}>
              {style.whatsapp ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${style.whatsapp}`)} style={[styles.pill, { backgroundColor: '#25D366' }]}>
                  <Ionicons name="logo-whatsapp" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
              {style.instagram ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${style.instagram}`)} style={[styles.pill, { backgroundColor: '#E1306C' }]}>
                  <Ionicons name="logo-instagram" size={16} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Instagram</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <TextInput
            style={[styles.input, playDisabled ? { opacity: 0.6 } : null]}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="Cantidad (Aleatoria)"
            editable={!playDisabled}
          />

          {(!style.paymentMethods || style.paymentMethods.includes('wallet')) && (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <OutlineButton 
                title={buying ? 'Procesando...' : playDisabled ? (isAgotada ? 'AGOTADA' : 'CERRADA') : 'Comprar con Saldo'} 
                onPress={purchase} 
                disabled={buying || playDisabled} 
                icon={<Ionicons name="wallet-outline" size={18} color={themeColor} />} 
              />
              <OutlineButton 
                title={showPurchase ? 'Ocultar Pago Manual' : 'Pago Manual'} 
                onPress={() => setShowPurchase(!showPurchase)} 
                disabled={playDisabled}
                icon={<Ionicons name="cash-outline" size={18} color={themeColor} />} 
              />
            </View>
          )}
        </View>

          {(!sellerPaymentMethods.length || sellerPaymentMethods.some(m => ['mobile_payment', 'zelle', 'binance', 'transfer'].includes(m))) && showPurchase && (
        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: themeColor }]}>Pago manual guiado</Text>
            <TouchableOpacity onPress={() => setSupportVisible(true)} style={[styles.pill, { backgroundColor: 'rgba(34,211,238,0.14)' }]}> 
              <Ionicons name="help-circle-outline" size={16} color={palette.accent} />
              <Text style={{ color: palette.text, fontWeight: '700' }}>Ayuda</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>2 pasos: completa datos y sube comprobante. Asignamos números aleatorios 1-10000 tras validar.</Text>

          <View style={{ marginTop: 10 }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Métodos aceptados:</Text>
            {(() => {
              const supported = ['mobile_payment', 'transfer', 'zelle', 'binance'];
              const list = Array.isArray(sellerPaymentMethods) && sellerPaymentMethods.length
                ? sellerPaymentMethods.map((m) => String(m))
                : supported;
              const visible = list.filter((m) => supported.includes(m));
              return (
                <View>
                  {visible.map((id) => {
                    const meta =
                      id === 'mobile_payment'
                        ? { label: 'Pago móvil', icon: 'phone-portrait-outline', hint: 'Transferencia móvil' }
                        : id === 'transfer'
                          ? { label: 'Transferencia', icon: 'card-outline', hint: 'Transferencia bancaria' }
                          : id === 'zelle'
                            ? { label: 'Zelle', icon: 'cash-outline', hint: 'Pago internacional' }
                            : { label: 'Binance', icon: 'logo-bitcoin', hint: 'Cripto / Binance' };
                    const active = manualProvider === id;
                    return (
                      <TouchableOpacity
                        key={id}
                        disabled={playDisabled}
                        onPress={() => {
                          if (playDisabled) return;
                          setManualProvider(id);
                          setPaymentStep(1);
                        }}
                        activeOpacity={0.85}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 14,
                          marginBottom: 8,
                          backgroundColor: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                          borderWidth: 1,
                          borderColor: active ? palette.primary : 'rgba(255,255,255,0.10)',
                          opacity: playDisabled ? 0.6 : 1
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: active ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
                            borderWidth: 1,
                            borderColor: active ? palette.primary : 'rgba(255,255,255,0.10)'
                          }}
                        >
                          <Ionicons name={meta.icon} size={18} color={active ? palette.primary : '#e2e8f0'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#fff', fontWeight: '900' }}>{meta.label}</Text>
                          <Text style={{ color: palette.muted, fontSize: 12 }}>{meta.hint}</Text>
                        </View>
                        <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? '#4ade80' : '#94a3b8'} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
          </View>
          
          {bankDetails && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginVertical: 8 }}>
              <Text style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 4 }}>Datos para el pago:</Text>
              <Text style={styles.muted}>Banco: <Text style={{ color: '#fff' }}>{bankDetails.bank}</Text></Text>
              <Text style={styles.muted}>Teléfono: <Text style={{ color: '#fff' }}>{bankDetails.phone}</Text></Text>
              <Text style={styles.muted}>Cédula: <Text style={{ color: '#fff' }}>{bankDetails.cedula}</Text></Text>
              {(bankDetails.type != null && String(bankDetails.type).trim() !== '') ? (
                <Text style={styles.muted}>Tipo: <Text style={{ color: '#fff' }}>{bankDetails.type}</Text></Text>
              ) : null}
              {(bankDetails.account != null && String(bankDetails.account).trim() !== '') ? (
                <Text style={styles.muted}>Cuenta: <Text style={{ color: '#fff' }}>{bankDetails.account}</Text></Text>
              ) : null}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
            {[1, 2].map((step) => (
              <View
                key={step}
                style={[
                  styles.pill,
                  {
                    backgroundColor: paymentStep === step ? palette.primary : 'rgba(255,255,255,0.06)',
                    color: paymentStep === step ? '#fff' : palette.text
                  }
                ]}
              >
                <Text style={{ color: paymentStep === step ? '#fff' : palette.text, fontWeight: '800' }}>Paso {step}</Text>
              </View>
            ))}
          </View>

          {paymentStep === 1 ? (
            <>
              <TextInput
                style={[styles.input, playDisabled ? { opacity: 0.6 } : null]}
                value={manualRef}
                onChangeText={setManualRef}
                editable={!playDisabled}
                placeholder={
                  manualProvider === 'binance'
                    ? 'TxID / Hash'
                    : manualProvider === 'zelle'
                      ? 'Confirmación / Referencia'
                      : 'Referencia (últimos 4 dígitos)'
                }
              />
              <TextInput
                style={[styles.input, playDisabled ? { opacity: 0.6 } : null]}
                value={manualNote}
                onChangeText={setManualNote}
                placeholder="Nota (opcional)"
                editable={!playDisabled}
              />
              <OutlineButton
                title="Continuar"
                onPress={() => setPaymentStep(2)}
                disabled={playDisabled}
                icon={<Ionicons name="arrow-forward-outline" size={18} color={palette.primary} />}
              />
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, playDisabled ? { opacity: 0.6 } : null]}
                onPress={pickProof}
                disabled={playDisabled}
                activeOpacity={0.85}
              >
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Adjuntar captura</Text>
              </TouchableOpacity>
              <Text style={[styles.muted, { fontSize: 12, color: '#fbbf24', marginVertical: 4 }]}>
                ⚠️ Importante: La captura debe mostrar claramente la FECHA y la REFERENCIA del pago.
              </Text>
              {manualProof?.uri ? <Image source={{ uri: manualProof.uri }} style={styles.proofImage} /> : <Text style={styles.muted}>Aún no has seleccionado imagen.</Text>}
              <Text style={styles.muted}>
                Método: {manualProvider || '—'} · Cantidad: {quantity} · Ref: {manualRef || '—'}
              </Text>
              <FilledButton
                title={manualLoading ? 'Enviando...' : 'Enviar comprobante'}
                onPress={submitManualPayment}
                loading={manualLoading}
                disabled={manualLoading || playDisabled}
                icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
              />
              <OutlineButton
                title="Volver al paso 1"
                onPress={() => setPaymentStep(1)}
                icon={<Ionicons name="arrow-back-outline" size={18} color={palette.primary} />}
              />
            </>
          )}
        </View>
        )}

        {ticket && (
          <View style={[styles.card, styles.glassCard, { borderColor: palette.primary, borderWidth: 1 }]}>
            <Text style={styles.section}>Tu Ticket</Text>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <Text style={{ color: palette.primary, fontSize: 32, fontWeight: 'bold' }}>
                #{formatTicketNumber(ticketNumber, current.digits)}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }}>Serial: {ticket.serialNumber}</Text>
              {mySecurityId ? (
                <Text style={{ color: palette.muted, fontSize: 12 }}>ID comprador: {mySecurityId}</Text>
              ) : null}
            </View>
          </View>
        )}

        {assignedNumbers.length ? (
          <Animated.View
            style={[
              styles.card,
              styles.glassCard,
              {
                transform: [
                  {
                    scale: numbersAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] })
                  }
                ],
                opacity: numbersAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] })
              }
            ]}
          >
            <Text style={styles.section}>Números asignados</Text>
            <Text style={styles.muted}>{assignedNumbers.length === 1 ? '¡Tu número ya está en juego!' : '¡Tus números ya están en juego!'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
              {assignedNumbers.map((n) => (
                <View key={n} style={styles.ticketGlow}>
                  <Text style={{ color: '#0b1224', fontWeight: '900' }}>#{formatTicketNumber(n, current.digits)}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#25D366', marginTop: 12 }]}
              onPress={() => Linking.openURL(`https://wa.me/${current.support?.whatsapp || ''}?text=Hola, ya tengo mis tickets para la rifa ${current.title}: ${assignedNumbers.map(n => formatTicketNumber(n, current.digits)).join(', ')}`)}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Confirmar por WhatsApp</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
      </ScrollView>
      <PublicProfileModal visible={!!viewProfileId} userId={viewProfileId} onClose={() => setViewProfileId(null)} api={api} />
    </SafeAreaView>
  );
}
