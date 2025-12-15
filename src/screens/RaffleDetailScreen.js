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
import { formatTicketNumber } from '../utils';
import PublicProfileModal from '../components/PublicProfileModal';

const { width } = Dimensions.get('window');

export default function RaffleDetailScreen({ route, navigation, api }) {
  const { raffle, ticket } = route.params || {};
  // Local state to hold the raffle data, initialized with param but updatable
  const [current, setCurrent] = useState(raffle || {});
  const [quantity, setQuantity] = useState('1');
  const [buying, setBuying] = useState(false);
  const [manualRef, setManualRef] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualProof, setManualProof] = useState(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState(1);
  const [assignedNumbers, setAssignedNumbers] = useState([]);
  const numbersAnim = useRef(new Animated.Value(0)).current;
  const [supportVisible, setSupportVisible] = useState(false);
  const [bankDetails, setBankDetails] = useState(null);
  const stats = current?.stats || {};
  const style = current?.style || {};
  const themeColor = style?.themeColor || palette.primary;
  const [viewProfileId, setViewProfileId] = useState(null);
  const [termsVisible, setTermsVisible] = useState(false);
  const totalTickets = current?.totalTickets || stats?.total || 0;
  const sold = stats?.sold || 0;
  const remaining = stats?.remaining ?? (totalTickets ? Math.max(totalTickets - sold, 0) : 0);
  const percentLeft = totalTickets ? Math.max(0, Math.min(100, (remaining / totalTickets) * 100)) : 0;

  // Fetch full raffle details if missing critical data
  useEffect(() => {
    if (!current || !current.id) return;
    // If stats or style are missing, fetch fresh data
    if (!current.stats || !current.style) {
      api(`/raffles/${current.id}`).then(({ res, data }) => {
        if (res.ok && data) {
          setCurrent(prev => ({ ...prev, ...data }));
        }
      });
    }
  }, [current?.id, api]);

  useEffect(() => {
    if (api) {
      api('/admin/bank-details').then(({ res, data }) => {
        if (res.ok && data.bankDetails) setBankDetails(data.bankDetails);
      });
    }
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

  const purchase = async () => {
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) return Alert.alert('Cantidad invalida', 'Ingresa una cantidad mayor a 0.');
    
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setManualProof({ uri: asset.uri, base64: asset.base64 });
    }
  };

  const submitManualPayment = async () => {
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) return Alert.alert('Cantidad invalida', 'Ingresa una cantidad mayor a 0.');
    if (!manualProof?.base64) return Alert.alert('Falta comprobante', 'Adjunta la captura del pago.');
    setManualLoading(true);
    const { res, data } = await api(`/raffles/${current.id}/manual-payments`, {
      method: 'POST',
      body: JSON.stringify({
        quantity: qty,
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
        {style.gallery && style.gallery.length > 0 ? (
          <View style={{ height: 260, marginBottom: 16 }}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {style.gallery.map((img, index) => (
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
              {style.gallery.map((_, i) => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' }} />
              ))}
            </View>
          </View>
        ) : style.bannerImage ? (
          <View style={{ height: 220, marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            <ImageBackground source={{ uri: style.bannerImage }} style={{ flex: 1 }} blurRadius={12}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                <Image source={{ uri: style.bannerImage }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
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
               {current.user?.avatar ? (
                 <Image source={{ uri: current.user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />
               ) : (
                 <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>{current.user?.name?.charAt(0).toUpperCase() || 'M'}</Text>
               )}
            </View>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16, marginRight: 4 }}>
                  {current.user?.name || 'MegaRifas Oficial'}
                </Text>
                {current.user?.identityVerified && <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600' }}>ID: {current.user?.securityId ? current.user.securityId.slice(-8).toUpperCase() : 'VERIFICADO'}</Text>
              </View>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
               <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </View>
          </TouchableOpacity>

          <View style={{ marginBottom: 8 }}>
            <Text style={styles.muted}>
              Precio VES {current.price} • Disponibles {remaining} / {totalTickets || '∞'} ({percentLeft.toFixed(0)}%)
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

          <TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="Cantidad (Aleatoria)" />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <OutlineButton title={buying ? 'Procesando...' : 'Comprar con Saldo'} onPress={purchase} disabled={buying} icon={<Ionicons name="wallet-outline" size={18} color={themeColor} />} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: themeColor }]}>Pago móvil guiado</Text>
            <TouchableOpacity onPress={() => setSupportVisible(true)} style={[styles.pill, { backgroundColor: 'rgba(34,211,238,0.14)' }]}> 
              <Ionicons name="help-circle-outline" size={16} color={palette.accent} />
              <Text style={{ color: palette.text, fontWeight: '700' }}>Ayuda</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.muted}>2 pasos: completa datos y sube comprobante. Asignamos números aleatorios 1-10000 tras validar.</Text>
          
          {bankDetails && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginVertical: 8 }}>
              <Text style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 4 }}>Datos para el pago:</Text>
              <Text style={styles.muted}>Banco: <Text style={{ color: '#fff' }}>{bankDetails.bank}</Text></Text>
              <Text style={styles.muted}>Teléfono: <Text style={{ color: '#fff' }}>{bankDetails.phone}</Text></Text>
              <Text style={styles.muted}>Cédula: <Text style={{ color: '#fff' }}>{bankDetails.cedula}</Text></Text>
              {bankDetails.type && <Text style={styles.muted}>Tipo: <Text style={{ color: '#fff' }}>{bankDetails.type}</Text></Text>}
              {bankDetails.account && <Text style={styles.muted}>Cuenta: <Text style={{ color: '#fff' }}>{bankDetails.account}</Text></Text>}
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
              <TextInput style={styles.input} value={manualRef} onChangeText={setManualRef} placeholder="Referencia (últimos 4 dígitos)" />
              <TextInput style={styles.input} value={manualNote} onChangeText={setManualNote} placeholder="Nota (opcional)" />
              <OutlineButton
                title="Continuar"
                onPress={() => setPaymentStep(2)}
                icon={<Ionicons name="arrow-forward-outline" size={18} color={palette.primary} />}
              />
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={pickProof} activeOpacity={0.85}>
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Adjuntar captura</Text>
              </TouchableOpacity>
              <Text style={[styles.muted, { fontSize: 12, color: '#fbbf24', marginVertical: 4 }]}>
                ⚠️ Importante: La captura debe mostrar claramente la FECHA y la REFERENCIA del pago.
              </Text>
              {manualProof?.uri ? <Image source={{ uri: manualProof.uri }} style={styles.proofImage} /> : <Text style={styles.muted}>Aún no has seleccionado imagen.</Text>}
              <Text style={styles.muted}>Cantidad: {quantity} · Ref: {manualRef || '—'}</Text>
              <FilledButton
                title={manualLoading ? 'Enviando...' : 'Enviar comprobante'}
                onPress={submitManualPayment}
                loading={manualLoading}
                disabled={manualLoading}
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

        {ticket && (
          <View style={[styles.card, styles.glassCard, { borderColor: palette.primary, borderWidth: 1 }]}>
            <Text style={styles.section}>Tu Ticket</Text>
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <Text style={{ color: palette.primary, fontSize: 32, fontWeight: 'bold' }}>
                #{formatTicketNumber(ticket.number, current.digits)}
              </Text>
              <Text style={{ color: palette.muted, fontSize: 12 }}>Serial: {ticket.serialNumber}</Text>
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
