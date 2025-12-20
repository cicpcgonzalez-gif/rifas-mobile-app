import React, { useState, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';
import { FilledButton } from '../components/UI';
import { formatTicketNumber, formatMoneyVES } from '../utils';

import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation, api, onUserUpdate, pushToken, setPushToken, onLogout }) {
  const nav = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [myPublications, setMyPublications] = useState([]);
  const [myPublicationsLoading, setMyPublicationsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Admin Business State
  const [businessTab, setBusinessTab] = useState('personal'); // 'personal' | 'legal' | 'kyc' | 'subscription'
  const [kycStatus, setKycStatus] = useState('pending'); 
  const [kycImages, setKycImages] = useState({ front: null, back: null, selfie: null });
  const [kycUploading, setKycUploading] = useState(false);
  
  const [boostData, setBoostData] = useState(null);
  const [activatingBoost, setActivatingBoost] = useState(false);

  // const [myRaffles, setMyRaffles] = useState([]); // Removed as we use a separate screen now
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [panelVisible, setPanelVisible] = useState(false);
  const [movementsVisible, setMovementsVisible] = useState(false);
  const [walletData, setWalletData] = useState({ balance: 0, currency: 'USD', transactions: [] });
  const [movementsLoading, setMovementsLoading] = useState(false);

  const achievements = useMemo(() => {
    if (!profile) return [];
    const list = [];
    if (tickets.length > 0) list.push({ id: 'ach1', label: 'Explorador', icon: 'planet' });
    if (tickets.length >= 5) list.push({ id: 'ach2', label: 'Jugador fiel', icon: 'sparkles' });
    if (profile.referrals?.length >= 5) list.push({ id: 'ach3', label: 'Influencer', icon: 'people' });
    return list;
  }, [profile, tickets]);

  const [errorMsg, setErrorMsg] = useState('');

  const isOrganizerRole = useMemo(() => {
    const role = String(profile?.role || '').trim().toLowerCase();
    return role === 'admin' || role === 'superadmin' || role === 'organizer';
  }, [profile?.role]);

  const { activePublications, closedPublications } = useMemo(() => {
    const list = Array.isArray(myPublications) ? myPublications : [];
    const active = [];
    const closed = [];
    for (const item of list) {
      if (String(item?.status || '').toLowerCase() === 'active') active.push(item);
      else closed.push(item);
    }
    return { activePublications: active, closedPublications: closed };
  }, [myPublications]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { res: r1, data: d1 } = await api('/me');
      if (!r1.ok) {
        setErrorMsg(d1?.error || `Error ${r1.status}: No se pudo cargar el perfil`);
        setProfile(null);
        setTickets([]);
        setMyPublications([]);
        setLoading(false);
        return;
      }

      const user = d1;
      const role = String(user?.role || '').trim().toLowerCase();
  const isRifero = role === 'admin' || role === 'superadmin' || role === 'organizer';

      const requests = [api('/me/tickets'), api('/me/referrals')];
      if (isRifero && user?.id) requests.push(api(`/users/public/${user.id}/raffles`));
      const [ticketsResp, referralsResp, pubsResp] = await Promise.all(requests);

      const { res: r2, data: d2 } = ticketsResp;
      const { res: r4, data: d4 } = referralsResp;

      if (r4.ok) {
        user.referrals = d4.referrals;
        user.referralCode = d4.code;
      }

      setProfile(user);
      const kycVerified = !!user?.identityVerified;
      setKycStatus(kycVerified ? 'verified' : 'pending');

      if (r2.ok && Array.isArray(d2)) {
        setTickets(d2.filter((t) => t && typeof t === 'object'));
      } else {
        setTickets([]);
      }

      if (isRifero) {
        setMyPublicationsLoading(true);
        
        // Fetch Boost Data (solo para roles que publican)
        api('/boosts/me').then(({ res, data }) => {
          if (res.ok) setBoostData(data);
        });

        const pubs = pubsResp;
        if (pubs?.res?.ok && pubs?.data && (Array.isArray(pubs.data.active) || Array.isArray(pubs.data.closed))) {
          const active = Array.isArray(pubs.data.active) ? pubs.data.active : [];
          const closed = Array.isArray(pubs.data.closed) ? pubs.data.closed : [];
          const userStub = {
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            identityVerified: !!user.identityVerified
          };
          setMyPublications([...active, ...closed].map((r) => ({ ...r, user: userStub })));
        } else {
          setMyPublications([]);
        }
        setMyPublicationsLoading(false);
      } else {
        setMyPublications([]);
        setMyPublicationsLoading(false);
      }
    } catch (e) {
      console.error('Profile Load Error:', e);
      setErrorMsg(e.message || 'Error de conexión');
    }
    setLoading(false);
  }, [api]);

  const normalizeSocials = useCallback((socials) => {
    if (!socials || typeof socials !== 'object') return {};
    const clean = {};

    const setIf = (key, value) => {
      const v = String(value ?? '').trim();
      if (v) clean[key] = v;
    };

    if (socials.whatsapp != null) {
      const digits = String(socials.whatsapp).replace(/\D/g, '');
      if (digits) clean.whatsapp = digits;
    }
    if (socials.instagram != null) setIf('instagram', String(socials.instagram).replace(/^@/, ''));
    if (socials.tiktok != null) setIf('tiktok', String(socials.tiktok).replace(/^@/, ''));
    if (socials.telegram != null) setIf('telegram', String(socials.telegram).replace(/^@/, ''));

    return clean;
  }, []);

  const renderPublicationCard = useCallback((r) => {
    if (!r) return null;
    const stats = r?.stats || {};
    const total = Number(r?.totalTickets || stats.total || 0);
    const sold = Number(stats.sold || r?.soldTickets || 0);
    const remaining = Number(stats.remaining ?? (total ? Math.max(total - sold, 0) : 0));
    const status = String(r?.status || '').toLowerCase();
    const endMs = Date.parse(r?.endDate);
    const endedByTime = Number.isFinite(endMs) && endMs > 0 && endMs < Date.now();
    const isClosed = status !== 'active' || endedByTime;
    const isAgotada = !isClosed && remaining === 0;

    const gallery = Array.isArray(r?.style?.gallery) && r.style.gallery.length
      ? r.style.gallery
      : r?.style?.bannerImage
        ? [r.style.bannerImage]
        : [];

    return (
      <TouchableOpacity
        key={`pub-${r.id}`}
        activeOpacity={0.9}
        onPress={() => nav.navigate('RaffleDetail', { raffle: r })}
        style={{ marginBottom: 18, backgroundColor: '#1e293b', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>{String(profile?.name || 'M').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{profile?.name || 'Rifero'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              {!!profile?.identityVerified && (
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>Verificado</Text>
              )}
              {isClosed && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ color: '#fecaca', fontSize: 10, fontWeight: '900' }}>CERRADA</Text>
                </View>
              )}
              {isAgotada && (
                <View style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                  <Text style={{ color: '#fecaca', fontSize: 10, fontWeight: '900' }}>AGOTADA</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}>
          {gallery.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {gallery.map((img, idx) => (
                <Image
                  key={`${r.id}-img-${idx}`}
                  source={{ uri: img }}
                  style={{ width, height: '100%', backgroundColor: '#000' }}
                  resizeMode="contain"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.2)" />
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 12, paddingBottom: 16, paddingTop: 12 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{r.title}</Text>
          {String(r.description || '').trim() ? (
            <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
              {r.description}
            </Text>
          ) : null}

          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>
              {(r.price ?? r.ticketPrice) != null ? formatMoneyVES(r.price ?? r.ticketPrice, { decimals: 0 }) : '—'}
            </Text>
            {isClosed ? (
              <Text style={{ color: '#fecaca', fontSize: 12, fontWeight: '800' }}>CERRADA</Text>
            ) : isAgotada ? (
              <Text style={{ color: '#fecaca', fontSize: 12, fontWeight: '800' }}>AGOTADA</Text>
            ) : (
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>{remaining} tickets restantes</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [nav, profile, formatMoneyVES]);

  const pickKycImage = async (kind, { camera = false } = {}) => {
    try {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la cámara.');
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
      }

      const result = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.9, base64: false, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.9, base64: false, allowsEditing: false });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      const normalized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(1200, asset.width || 1200) } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      setKycImages((prev) => ({ ...prev, [kind]: { uri: normalized.uri, base64: normalized.base64 } }));
    } catch (e) {
      console.error('pickKycImage error:', e);
      Alert.alert('Error', e.message || 'No se pudo cargar la imagen.');
    }
  };

  const submitKyc = async () => {
    if (!api) return;
    if (!kycImages.front || !kycImages.back || !kycImages.selfie) {
      return Alert.alert('Faltan documentos', 'Sube frente, dorso y selfie para enviar tu verificación.');
    }
    setKycUploading(true);
    try {
      const payload = {
        documentType: 'cedula',
        frontImage: kycImages.front.base64,
        backImage: kycImages.back.base64,
        selfieImage: kycImages.selfie.base64
      };

      const { res, data } = await api('/kyc/submit', { 
        method: 'POST', 
        body: JSON.stringify(payload) 
      });

      if (res.ok) {
        Alert.alert('Enviado', 'Tu verificación fue enviada. Un superadmin la revisará.');
        setKycStatus('pending');
      } else {
        Alert.alert('Error', data?.error || 'No se pudo enviar tu verificación.');
      }
    } catch (e) {
      console.error('submitKyc error:', e);
      Alert.alert('Error', e.message || 'Error de conexión');
    } finally {
      setKycUploading(false);
    }
  };

  const activateBoost = async () => {
    setActivatingBoost(true);
    try {
      const { res, data } = await api('/boosts/activate', { method: 'POST' });
      if (res.ok) {
        Alert.alert('¡Éxito!', 'Tu perfil ha sido promocionado por 24 horas.');
        // Refresh boost data
        const { res: r2, data: d2 } = await api('/boosts/me');
        if (r2.ok) setBoostData(d2);
      } else {
        Alert.alert('No disponible', data?.error || 'No se pudo activar el boost.');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setActivatingBoost(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.9, base64: false, allowsEditing: false });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      const normalized = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: Math.min(800, asset.width || 800) } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setProfile((p) => ({ ...p, avatar: `data:image/jpeg;base64,${normalized.base64}` }));
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Evitar enviar campos que el backend suele bloquear (p.ej. email)
      // y normalizar redes para que no rompan el PATCH.
      const payload = {
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        cedula: profile.cedula,
        dob: profile.dob,
        bio: profile.bio,
        socials: normalizeSocials(profile.socials),
        companyName: profile.companyName,
        rif: profile.rif
      };

      // Enviar avatar solo si es un dataURL (cuando el usuario lo cambió localmente)
      if (typeof profile.avatar === 'string' && profile.avatar.startsWith('data:image/')) {
        payload.avatar = profile.avatar;
      }

      const { res, data } = await api('/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        Alert.alert('Guardado', 'Perfil actualizado correctamente.');
        setIsEditing(false);
        const updatedUser = data?.user || data;
        if (onUserUpdate) onUserUpdate(updatedUser);
      } else {
        // Log error for debugging
        console.log('Save Profile Error:', data);
        Alert.alert('Error', data.error || 'No se pudo actualizar el perfil.');
      }
    } catch (e) {
      console.error('Save Profile Exception:', e);
      Alert.alert('Error', e.message || 'Error de conexión al guardar.');
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!passwordForm.current || !passwordForm.new) return Alert.alert('Faltan datos', 'Ingresa ambas contraseñas.');
    setChangingPassword(true);
    const { res, data } = await api('/me/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.new })
    });
    if (res.ok) {
      Alert.alert('Éxito', 'Contraseña actualizada.');
      setPasswordForm({ current: '', new: '' });
      setShowPassword(false);
    } else {
      Alert.alert('Error', data.error || 'No se pudo cambiar la contraseña.');
    }
    setChangingPassword(false);
  };

  const deleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible y perderás acceso a tus tickets y datos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const { res, data } = await api('/me', { method: 'DELETE' });
              if (res.ok) {
                Alert.alert('Cuenta eliminada', 'Tu cuenta ha sido eliminada correctamente.');
                onLogout();
              } else {
                Alert.alert('Error', data.error || 'No se pudo eliminar la cuenta.');
              }
            } catch (e) {
              Alert.alert('Error', 'Error de conexión al eliminar la cuenta.');
            }
          }
        }
      ]
    );
  };

  const showReceipt = (item) => {
    Alert.alert(
      'Recibo',
      `Rifa: ${item.raffleTitle || ''}\nTicket: ${item.number ? formatTicketNumber(item.number, item.digits) : '—'}\nSerial: ${item.serial || item.serialNumber || '—'}\nID comprador: ${profile?.securityId || profile?.publicId || '—'}\nEstado: ${item.status}\nFecha: ${item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}\nVía: ${item.via || ''}`
    );
  };

  const loadMyMovements = useCallback(async () => {
    if (!api) return;
    setMovementsLoading(true);
    try {
      const { res, data } = await api('/wallet');
      if (res.ok) {
        setWalletData({
          balance: Number(data?.balance || 0),
          currency: data?.currency || 'USD',
          transactions: Array.isArray(data?.transactions) ? data.transactions : []
        });
      } else {
        Alert.alert('Error', data?.error || 'No se pudieron cargar tus movimientos.');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Error de conexión al cargar movimientos.');
    }
    setMovementsLoading(false);
  }, [api]);

  const statusPillStyle = useCallback((status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'approved') return styles.statusApproved;
    if (s === 'rejected') return styles.statusRejected;
    return styles.statusPending;
  }, []);

  const typeLabel = useCallback((type) => {
    const t = String(type || '').toLowerCase();
    if (!t) return 'Movimiento';
    if (t === 'manual_payment') return 'Pago manual';
    if (t === 'ticket_purchase') return 'Compra de tickets';
    if (t === 'topup') return 'Recarga';
    if (t === 'withdrawal') return 'Retiro';
    return t.replace(/_/g, ' ');
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.rowBetween, { marginBottom: 12 }]}>
          <Text style={[styles.title, { marginBottom: 0 }]}>Mi perfil</Text>
          <TouchableOpacity
            onPress={() => setPanelVisible(true)}
            style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel="Abrir panel de perfil"
          >
            <Ionicons name="grid-outline" size={20} color="#e2e8f0" />
          </TouchableOpacity>
        </View>

        <Modal
          visible={panelVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPanelVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => setPanelVisible(false)} style={styles.overlay} />
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '82%', backgroundColor: 'rgba(12,18,36,0.98)', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.10)', paddingTop: 48, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(124,58,237,0.18)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={18} color="#e2e8f0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }} numberOfLines={1}>{profile?.name || 'Usuario'}</Text>
                  <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>{profile?.email || ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setPanelVisible(false)} style={{ padding: 8 }}>
                <Ionicons name="close" size={22} color="#e2e8f0" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={async () => {
                setPanelVisible(false);
                setMovementsVisible(true);
                await loadMyMovements();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(34,211,238,0.14)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.35)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="swap-vertical-outline" size={18} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Transacciones / Movimientos</Text>
                <Text style={{ color: palette.subtext, fontSize: 12 }}>Ver tus últimos movimientos</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </Modal>

        <Modal
          visible={movementsVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMovementsVisible(false)}
        >
          <View style={[styles.overlay, { backgroundColor: 'rgba(10,12,24,0.72)' }]} />
          <View style={{ position: 'absolute', left: 14, right: 14, top: 70, bottom: 26, backgroundColor: 'rgba(15,23,42,0.96)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 14 }}>
            <View style={[styles.rowBetween, { marginBottom: 10 }]}>
              <View>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Movimientos</Text>
                <Text style={{ color: palette.muted, fontSize: 12 }}>
                  Saldo: {Number(walletData?.balance || 0).toFixed(2)} {walletData?.currency || 'USD'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={loadMyMovements}
                  disabled={movementsLoading}
                  style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', opacity: movementsLoading ? 0.7 : 1 }}
                >
                  <Ionicons name="refresh" size={18} color="#e2e8f0" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setMovementsVisible(false)}
                  style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="close" size={18} color="#e2e8f0" />
                </TouchableOpacity>
              </View>
            </View>

            {movementsLoading ? (
              <View style={{ paddingTop: 20, alignItems: 'center' }}>
                <ActivityIndicator color={palette.primary} />
                <Text style={[styles.muted, { marginTop: 8 }]}>Cargando movimientos...</Text>
              </View>
            ) : (
              <ScrollView>
                {Array.isArray(walletData?.transactions) && walletData.transactions.length > 0 ? (
                  walletData.transactions.map((tx) => {
                    const amount = Number(tx?.amount || 0);
                    const currency = tx?.currency || walletData?.currency || 'USD';
                    const status = String(tx?.status || 'pending').toLowerCase();
                    return (
                      <View key={String(tx?.id || Math.random())} style={styles.movementRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View style={[styles.movementBadge, { backgroundColor: 'rgba(34,211,238,0.10)', borderColor: 'rgba(34,211,238,0.25)' }]}>
                            <Ionicons name="swap-vertical-outline" size={16} color={palette.accent} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={1}>{typeLabel(tx?.type)}</Text>
                            <Text style={{ color: palette.muted, fontSize: 12 }} numberOfLines={1}>
                              {tx?.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}
                            </Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: '#fff', fontWeight: '900' }}>{amount.toFixed(2)} {currency}</Text>
                          <Text style={[styles.statusPill, statusPillStyle(status)]}>{status}</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 26 }}>
                    <Text style={{ color: '#94a3b8', textAlign: 'center' }}>Aún no tienes movimientos.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </Modal>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator color={palette.primary} size="large" />
            <Text style={styles.muted}>Cargando perfil...</Text>
          </View>
        ) : profile ? (
          <>
            {/* MURAL VIEW */}
            <View style={[styles.card, styles.profileHeader, { alignItems: 'center', paddingVertical: 30 }]}> 
              <View style={styles.avatarGlow}>
                <View style={styles.avatarRing}>
                  {profile.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person" size={36} color={palette.subtext} />
                    </View>
                  )}
                </View>
              </View>
              
              <Text style={[styles.itemTitle, { fontSize: 24, marginTop: 12 }]}>{profile.name || 'Usuario'}</Text>
              
              {/* STATS ROW */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', width: '100%', marginTop: 20, paddingHorizontal: 10, gap: 28 }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{tickets.length}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Tickets</Text>
                </View>
                <TouchableOpacity onPress={() => nav.navigate('Referrals')} style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>{profile.referrals?.length || 0}</Text>
                  <Text style={{ color: palette.subtext, fontSize: 12 }}>Referidos</Text>
                </TouchableOpacity>
              </View>

              {/* ACHIEVEMENTS */}
              {achievements.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                  {achievements.map(a => (
                    <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                      <Ionicons name={a.icon} size={14} color="#fbbf24" />
                      <Text style={{ color: '#e2e8f0', fontSize: 12, marginLeft: 6, fontWeight: '600' }}>{a.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {(!!profile.identityVerified || !!profile.verified) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                  {!!profile.verified && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(59, 130, 246, 0.12)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                      <Ionicons name="star-outline" size={16} color={palette.primary} />
                      <Text style={{ color: palette.primary, fontWeight: 'bold' }}>Email verificado</Text>
                    </View>
                  )}

                  {!!profile.identityVerified && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(251, 191, 36, 0.12)', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.25)' }}>
                      <Ionicons name="star" size={16} color="#fbbf24" />
                      <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>KYC verificado</Text>
                    </View>
                  )}
                </View>
              )}

              {(profile.securityId || profile.publicId) ? (
                <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>ID: {profile.securityId || profile.publicId}</Text>
              ) : null}
              
              <Text style={[styles.muted, { textAlign: 'center', marginTop: 8, paddingHorizontal: 20 }]}>
                {profile.bio || 'Sin biografía.'}
              </Text>

              <View style={{ flexDirection: 'row', gap: 16, marginTop: 16 }}>
                {profile.socials?.whatsapp ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${profile.socials.whatsapp}`)}>
                    <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                  </TouchableOpacity>
                ) : null}
                {profile.socials?.instagram ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${profile.socials.instagram.replace('@','')}`)}>
                    <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                  </TouchableOpacity>
                ) : null}
                {profile.socials?.tiktok ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://www.tiktok.com/@${String(profile.socials.tiktok).replace('@','')}`)}>
                    <Ionicons name="logo-tiktok" size={24} color="#e2e8f0" />
                  </TouchableOpacity>
                ) : null}
                {profile.socials?.telegram ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${String(profile.socials.telegram).replace('@','')}`)}>
                    <Ionicons name="paper-plane-outline" size={24} color="#60a5fa" />
                  </TouchableOpacity>
                ) : null}
              </View>

            </View>

            {/* EDIT FORM */}
            {isEditing && (
              <View style={[styles.card, styles.glassCard]}>
                {(profile.role === 'admin' || profile.role === 'superadmin' || profile.role === 'organizer') ? (
                  <>
                    <View style={{ flexDirection: 'row', marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 4 }}>
                      <TouchableOpacity onPress={() => setBusinessTab('personal')} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: businessTab === 'personal' ? palette.primary : 'transparent', borderRadius: 6 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>Personal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setBusinessTab('legal')} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: businessTab === 'legal' ? palette.primary : 'transparent', borderRadius: 6 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>Legal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setBusinessTab('kyc')} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: businessTab === 'kyc' ? palette.primary : 'transparent', borderRadius: 6 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>KYC</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setBusinessTab('subscription')} style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: businessTab === 'subscription' ? palette.primary : 'transparent', borderRadius: 6 }}>
                          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 10 }}>Plan</Text>
                      </TouchableOpacity>
                    </View>

                    {businessTab === 'personal' && (
                      <>
                        <Text style={styles.section}>Información Pública</Text>
                        <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={pickAvatar}>
                          <Text style={{ color: palette.primary }}>Cambiar Logo / Foto</Text>
                        </TouchableOpacity>

                        <Text style={styles.muted}>Nombre Visible</Text>
                        <TextInput style={styles.input} value={profile.name} onChangeText={(v) => setProfile(p => ({...p, name: v}))} />

                        <Text style={styles.muted}>Bio / Descripción</Text>
                        <TextInput style={[styles.input, { height: 80 }]} multiline value={profile.bio} onChangeText={(v) => setProfile(p => ({...p, bio: v}))} />

                        <Text style={styles.muted}>Teléfono Contacto</Text>
                        <TextInput style={styles.input} value={profile.phone} onChangeText={(v) => setProfile(p => ({...p, phone: v}))} keyboardType="phone-pad" />

                        <Text style={styles.muted}>WhatsApp (Solo números)</Text>
                        <TextInput style={styles.input} value={profile.socials?.whatsapp} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, whatsapp: v}}))} keyboardType="phone-pad" />

                        <Text style={styles.muted}>Instagram (@usuario)</Text>
                        <TextInput style={styles.input} value={profile.socials?.instagram} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, instagram: v}}))} />

                        <Text style={styles.muted}>TikTok (@usuario)</Text>
                        <TextInput style={styles.input} value={profile.socials?.tiktok} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, tiktok: v}}))} />

                        <Text style={styles.muted}>Telegram (@usuario o usuario)</Text>
                        <TextInput style={styles.input} value={profile.socials?.telegram} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, telegram: v}}))} />
                      </>
                    )}

                    {businessTab === 'legal' && (
                      <>
                        <Text style={styles.muted}>Información para recibos y facturación.</Text>
                        <Text style={styles.section}>Nombre Legal / Razón Social</Text>
                        <TextInput style={styles.input} placeholder="Ej: Inversiones MegaRifas C.A." value={profile.companyName} onChangeText={(v) => setProfile(p => ({...p, companyName: v}))} />
                        <Text style={styles.section}>RIF / Cédula</Text>
                        <TextInput style={styles.input} placeholder="J-12345678-9" value={profile.rif} onChangeText={(v) => setProfile(p => ({...p, rif: v}))} />
                        <Text style={styles.section}>Dirección Fiscal</Text>
                        <TextInput style={styles.input} placeholder="Av. Principal..." value={profile.address} onChangeText={(v) => setProfile(p => ({...p, address: v}))} multiline />
                      </>
                    )}

                    {businessTab === 'kyc' && (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: kycStatus === 'verified' ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 191, 36, 0.2)', padding: 12, borderRadius: 8 }}>
                            <Ionicons name={kycStatus === 'verified' ? "checkmark-circle" : "time"} size={24} color={kycStatus === 'verified' ? "#4ade80" : "#fbbf24"} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Estado: {kycStatus === 'verified' ? 'VERIFICADO' : 'PENDIENTE'}</Text>
                                <Text style={{ color: palette.muted, fontSize: 12 }}>{kycStatus === 'verified' ? 'Puedes operar sin límites.' : 'Sube tus documentos para activar pagos.'}</Text>
                            </View>
                        </View>

                        <Text style={styles.section}>Documento de Identidad (Frente)</Text>
                        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} onPress={() => pickKycImage('front')}>
                            <Ionicons name="id-card-outline" size={24} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 8 }}>Subir Foto</Text>
                        </TouchableOpacity>
                        {kycImages.front ? (
                          <Image source={{ uri: kycImages.front.uri }} style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10 }} resizeMode="contain" />
                        ) : null}

                        <Text style={styles.section}>Documento de Identidad (Dorso)</Text>
                        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} onPress={() => pickKycImage('back')}>
                            <Ionicons name="id-card-outline" size={24} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 8 }}>Subir Foto</Text>
                        </TouchableOpacity>
                        {kycImages.back ? (
                          <Image source={{ uri: kycImages.back.uri }} style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10 }} resizeMode="contain" />
                        ) : null}

                        <Text style={styles.section}>Selfie con Cédula</Text>
                        <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} onPress={() => pickKycImage('selfie', { camera: true })}>
                            <Ionicons name="camera-outline" size={24} color="#fff" />
                            <Text style={{ color: '#fff', marginLeft: 8 }}>Tomar Selfie</Text>
                        </TouchableOpacity>
                        {kycImages.selfie ? (
                          <Image source={{ uri: kycImages.selfie.uri }} style={{ width: '100%', height: 180, borderRadius: 12, marginTop: 10 }} resizeMode="contain" />
                        ) : null}

                        <View style={{ marginTop: 14 }}>
                          <FilledButton
                            title={kycUploading ? 'Enviando...' : 'Enviar verificación'}
                            onPress={submitKyc}
                            loading={kycUploading}
                            disabled={kycUploading}
                            icon={<Ionicons name="cloud-upload-outline" size={18} color="#fff" />}
                          />
                        </View>
                      </>
                    )}

                    {businessTab === 'subscription' && (
                      <>
                        <View style={{ backgroundColor: 'rgba(34, 211, 238, 0.1)', padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.3)' }}>
                            <Text style={{ color: '#22d3ee', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>PLAN ACTUAL</Text>
                            <Text style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', marginVertical: 8 }}>GRATUITO</Text>
                            <Text style={{ color: palette.muted, textAlign: 'center' }}>Tienes acceso básico para crear rifas limitadas.</Text>
                        </View>

                        {boostData && (
                          <View style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <Ionicons name="flash" size={24} color="#fbbf24" />
                              <Text style={{ color: '#fbbf24', fontSize: 16, fontWeight: 'bold' }}>BOOST SEMANAL</Text>
                            </View>
                            <Text style={{ color: '#fff', marginBottom: 12 }}>
                              {boostData.isBoosted 
                                ? `¡Tu perfil está destacado hasta el ${new Date(boostData.activeBoosts[0].endAt).toLocaleString()}!`
                                : 'Destaca tu perfil en la página principal por 24 horas. Tienes 1 boost gratis cada semana.'}
                            </Text>
                            
                            {!boostData.isBoosted && (
                              <FilledButton 
                                title={activatingBoost ? 'Activando...' : 'Activar Boost Gratis'} 
                                onPress={activateBoost} 
                                loading={activatingBoost} 
                                disabled={activatingBoost || (new Date() < new Date(boostData.nextEligibleAt))}
                                style={{ backgroundColor: '#fbbf24' }}
                                textStyle={{ color: '#000' }}
                              />
                            )}
                            
                            {!boostData.isBoosted && new Date() < new Date(boostData.nextEligibleAt) && (
                              <Text style={{ color: palette.muted, fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                                Disponible nuevamente el {new Date(boostData.nextEligibleAt).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        )}

                        <Text style={styles.section}>Mejorar mi Plan</Text>
                        <TouchableOpacity onPress={() => Alert.alert('Contactar Ventas', 'Te redirigiremos a WhatsApp para activar tu plan PRO.')} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 18 }}>Plan PRO</Text>
                                <Text style={{ color: '#fff', fontSize: 12 }}>Rifas ilimitadas + Menor comisión</Text>
                            </View>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>$29/mes</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => Alert.alert('Contactar Ventas', 'Te redirigiremos a WhatsApp para activar tu plan EMPRESA.')} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                                <Text style={{ color: '#c084fc', fontWeight: 'bold', fontSize: 18 }}>Plan EMPRESA</Text>
                                <Text style={{ color: '#fff', fontSize: 12 }}>Marca Blanca + Soporte Prioritario</Text>
                            </View>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>$99/mes</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.section}>Editar Información</Text>
                    <TouchableOpacity style={{ alignItems: 'center', marginBottom: 16 }} onPress={pickAvatar}>
                      <Text style={{ color: palette.primary }}>Cambiar Foto de Perfil</Text>
                    </TouchableOpacity>

                    <Text style={styles.muted}>Nombre</Text>
                    <TextInput style={styles.input} value={profile.name} onChangeText={(v) => setProfile(p => ({...p, name: v}))} />

                    <Text style={styles.muted}>Biografía</Text>
                    <TextInput style={[styles.input, { height: 80 }]} multiline value={profile.bio} onChangeText={(v) => setProfile(p => ({...p, bio: v}))} />

                    <Text style={styles.muted}>Teléfono</Text>
                    <TextInput style={styles.input} value={profile.phone} onChangeText={(v) => setProfile(p => ({...p, phone: v}))} keyboardType="phone-pad" />

                    <Text style={styles.muted}>WhatsApp (Solo números)</Text>
                    <TextInput style={styles.input} value={profile.socials?.whatsapp} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, whatsapp: v}}))} keyboardType="phone-pad" />

                    <Text style={styles.muted}>Instagram (@usuario)</Text>
                    <TextInput style={styles.input} value={profile.socials?.instagram} onChangeText={(v) => setProfile(p => ({...p, socials: {...p.socials, instagram: v}}))} />
                  </>
                )}

                <FilledButton title={saving ? 'Guardando...' : 'Guardar Cambios'} onPress={saveProfile} loading={saving} disabled={saving} />
              </View>
            )}

            {/* REMOVED INLINE ADMIN RAFFLES */}

            {(profile.role === 'admin' || profile.role === 'superadmin' || profile.role === 'organizer') && (
              <View style={[styles.card, styles.glassCard]}>
                <Text style={[styles.section, { marginBottom: 10 }]}>Mis publicaciones</Text>

                {myPublicationsLoading ? (
                  <ActivityIndicator color={palette.primary} />
                ) : (
                  <>
                    <Text style={[styles.muted, { marginBottom: 8 }]}>Activas: {activePublications.length}</Text>
                    {activePublications.length === 0 ? <Text style={styles.muted}>No tienes publicaciones activas.</Text> : null}
                    {activePublications.map(renderPublicationCard)}

                    <View style={{ height: 14 }} />

                    <Text style={[styles.muted, { marginBottom: 8 }]}>Cerradas: {closedPublications.length}</Text>
                    {closedPublications.length === 0 ? <Text style={styles.muted}>No tienes publicaciones cerradas.</Text> : null}
                    {closedPublications.map(renderPublicationCard)}
                  </>
                )}
              </View>
            )}

            {/* ACTIVIDAD PARA USUARIOS (tickets) */}
            {!isOrganizerRole && (
              <View style={[styles.card, styles.glassCard]}>
                <Text style={styles.section}>Actividad</Text>
                {tickets.length === 0 ? (
                  <Text style={styles.muted}>Aún no tienes actividad.</Text>
                ) : (
                  tickets.slice(0, 12).map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => showReceipt(t)}
                      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}
                    >
                      <Text style={[styles.itemTitle, { color: '#fff', marginBottom: 2 }]} numberOfLines={1}>{t.raffleTitle || 'Rifa'}</Text>
                      <Text style={styles.muted}>
                        {t.status || '—'} • {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* Botón Editar Perfil debe ir debajo de la vista previa/actividad */}
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton, { marginTop: 12, width: 'auto', paddingHorizontal: 24, alignSelf: 'center' }]} 
              onPress={() => setIsEditing(!isEditing)}
            >
              <Ionicons name={isEditing ? "close-outline" : "create-outline"} size={18} color={palette.primary} />
              <Text style={[styles.secondaryText, { marginLeft: 8 }]}>{isEditing ? 'Cancelar Edición' : 'Editar Perfil'}</Text>
            </TouchableOpacity>

            {!isAdminOrSuperadmin && (
              <>
                <View style={[styles.card, styles.glassCard]}>
                  <Text style={styles.section}>Legal</Text>
                  <TouchableOpacity 
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                    onPress={() => nav.navigate('Legal')}
                  >
                    <Ionicons name="document-text-outline" size={24} color={palette.primary} />
                    <Text style={{ color: palette.text, marginLeft: 12, fontSize: 16 }}>Términos, Privacidad y Marco Legal</Text>
                    <Ionicons name="chevron-forward" size={20} color={palette.muted} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.card, styles.glassCard]}>
                  <TouchableOpacity style={styles.rowBetween} onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.section}>Seguridad</Text>
                    <Ionicons name={showPassword ? "chevron-up" : "chevron-down"} size={20} color={palette.text} />
                  </TouchableOpacity>
                  
                  {showPassword && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={styles.muted}>Cambiar contraseña</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Contraseña actual"
                        secureTextEntry
                        value={passwordForm.current}
                        onChangeText={(v) => setPasswordForm(s => ({ ...s, current: v }))}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Nueva contraseña"
                        secureTextEntry
                        value={passwordForm.new}
                        onChangeText={(v) => setPasswordForm(s => ({ ...s, new: v }))}
                      />
                      <FilledButton 
                        title={changingPassword ? 'Actualizando...' : 'Actualizar contraseña'} 
                        onPress={changePassword} 
                        loading={changingPassword} 
                        disabled={changingPassword}
                        icon={<Ionicons name="lock-closed-outline" size={18} color="#fff" />}
                      />
                    </View>
                  )}
                </View>

                <View style={{ marginTop: 20, gap: 12, marginBottom: 40 }}>
                  <FilledButton 
                    title="Cerrar sesión" 
                    onPress={onLogout} 
                    style={{ backgroundColor: '#ef4444' }} 
                    icon={<Ionicons name="log-out-outline" size={18} color="#fff" />} 
                  />
                  
                  <TouchableOpacity 
                    onPress={deleteAccount}
                    style={{ padding: 12, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#94a3b8', fontSize: 14, textDecorationLine: 'underline' }}>
                      Eliminar mi cuenta
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : (
          <Text style={{ color: palette.error, textAlign: 'center' }}>{errorMsg || 'No se pudo cargar el perfil.'}</Text>
        )}
      </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
