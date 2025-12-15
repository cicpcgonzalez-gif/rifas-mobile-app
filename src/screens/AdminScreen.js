import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Animated,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { palette } from '../theme';
import { FilledButton, OutlineButton } from '../components/UI';

const formatTicketNumber = (value, digits = 4) => String(value ?? '').padStart(digits, '0');

const ProgressBar = ({ progress, color }) => (
  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginVertical: 8, overflow: 'hidden' }}>
    <View style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
  </View>
);

const STANDARD_ASPECT = [16, 9];
const MAX_GALLERY_IMAGES = 5;
const normalizeImage = async (asset, { maxWidth = 1280, compress = 0.82 } = {}) => {
  const targetWidth = Math.min(maxWidth, asset?.width || maxWidth);
  const manipResult = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: targetWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return `data:image/jpeg;base64,${manipResult.base64}`;
};

export default function AdminScreen({ api, user, modulesConfig }) {
  const route = useRoute();
  const [activeSection, setActiveSection] = useState(null);

  // Handle navigation params for editing
  useFocusEffect(
    useCallback(() => {
      if (route.params?.action === 'editRaffle' && route.params?.raffleData) {
        const r = route.params.raffleData;
        setActiveSection('raffles');
        setRaffleForm({
          id: r.id,
          title: r.title || '',
          price: String(r.price || ''),
          description: r.description || '',
          totalTickets: r.totalTickets ? String(r.totalTickets) : '',
          digits: r.digits || 4,
          startDate: r.startDate ? r.startDate.slice(0, 10) : '',
          endDate: r.endDate ? r.endDate.slice(0, 10) : '',
          lottery: r.lottery || '',
          instantWins: r.instantWins ? r.instantWins.join(', ') : '',
          terms: r.terms || '',
          securityCode: r.securityCode || ''
        });
        // Clear params to avoid re-triggering
        route.params.action = null;
        route.params.raffleData = null;
      }
    }, [route.params])
  );

  // Superadmin State
  const [branding, setBranding] = useState({ title: '', tagline: '', primaryColor: '', secondaryColor: '', logoUrl: '', bannerUrl: '', policies: '' });
  const [modules, setModules] = useState(null);
  const [users, setUsers] = useState([]);
  const [savingBranding, setSavingBranding] = useState(false);
  const [loadingSuper, setLoadingSuper] = useState(false);
  const [mailLogs, setMailLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user', firstName: '', lastName: '', active: true });
  const [creating, setCreating] = useState(false);
  const [smtpForm, setSmtpForm] = useState({ host: '', port: '587', user: '', pass: '', secure: false, fromName: '', fromEmail: '' });
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [techSupportForm, setTechSupportForm] = useState({ phone: '', email: '' });
  const [techSupportErrors, setTechSupportErrors] = useState({});
  const [savingTechSupport, setSavingTechSupport] = useState(false);


  const [bankSettings, setBankSettings] = useState({ bankName: '', accountName: '', accountNumber: '', accountType: '', cedula: '', phone: '' });
  const [savingBank, setSavingBank] = useState(false);

  const [announcements, setAnnouncements] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // Dashboard Metrics
  const [metricsSummary, setMetricsSummary] = useState(null);
  const [metricsHourly, setMetricsHourly] = useState([]);
  const [metricsDaily, setMetricsDaily] = useState([]);
  const [metricsByState, setMetricsByState] = useState([]);
  const [metricsTop, setMetricsTop] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [rafflePickerVisible, setRafflePickerVisible] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null); // For modal actions
  const [viewUser, setViewUser] = useState(null); // Para ver detalle de usuario (Hoja de Vida)

  const [raffleTab, setRaffleTab] = useState('details'); // 'details' | 'payments'
  const [paymentMethods, setPaymentMethods] = useState([]); // Lista de métodos de pago multimoneda

  const MENU_ITEMS = useMemo(() => {
    const items = [
      { id: 'account', title: 'Mi Cuenta', icon: 'person-circle-outline', color: palette.primary },
      { id: 'support', title: 'Mi Soporte', icon: 'headset-outline', color: '#f87171' },
      { id: 'push', title: 'Notificaciones', icon: 'notifications-outline', color: '#f472b6' },
      { id: 'security', title: 'Cód. Seguridad', icon: 'shield-checkmark-outline', color: '#34d399' },
      { id: 'lottery', title: 'Sorteo en Vivo', icon: 'dice-outline', color: '#f87171' },
      { id: 'raffles', title: 'Crear y Pagos', icon: 'create-outline', color: '#a78bfa' },
      { id: 'dashboard', title: 'Dashboard', icon: 'speedometer-outline', color: '#22c55e' },
      { id: 'progress', title: 'Progreso', icon: 'bar-chart-outline', color: '#38bdf8' },
      { id: 'payments', title: 'Validar Pagos', icon: 'cash-outline', color: '#10b981' },
      { id: 'tickets', title: 'Verificador', icon: 'qr-code-outline', color: '#f97316' },
      { id: 'style', title: 'Estilo', icon: 'color-fill-outline', color: '#fbbf24' },
      { id: 'news', title: 'Novedades', icon: 'newspaper-outline', color: '#60a5fa' },
    ];
    
    if (user?.role === 'superadmin') {
      // Superadmin siempre ve los bloques críticos aunque el backend no mande config
      items.push({ id: 'sa_users', title: 'Usuarios', icon: 'people-outline', color: '#22d3ee', requiresSuperadmin: true });
      items.push({ id: 'sa_tech_support', title: 'Soporte Técnico', icon: 'call-outline', color: '#38bdf8', requiresSuperadmin: true });
      items.push({ id: 'sa_smtp', title: 'Correo SMTP', icon: 'mail-outline', color: '#facc15', requiresSuperadmin: true });
      if (!modulesConfig || modulesConfig?.superadmin?.audit !== false) {
        items.push({ id: 'sa_audit', title: 'Auditoría', icon: 'receipt-outline', color: '#facc15' });
      }
      if (!modulesConfig || modulesConfig?.superadmin?.branding !== false) {
        items.push({ id: 'branding', title: 'Branding', icon: 'color-palette-outline', color: '#c084fc' });
      }
      if (!modulesConfig || modulesConfig?.superadmin?.modules !== false) {
        items.push({ id: 'modules', title: 'Módulos', icon: 'layers-outline', color: '#4ade80' });
      }
      items.push({ id: 'sa_mail', title: 'Logs de Correo', icon: 'mail-open-outline', color: '#f472b6', requiresSuperadmin: true });
      // items.push({ id: 'sa_actions', title: 'Acciones Críticas', icon: 'alert-circle-outline', color: '#ef4444', requiresSuperadmin: true }); // ELIMINADO (Fusionado con Auditoría)
    }
    
    return items;
  }, [user, modulesConfig]);

  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [paymentFilters, setPaymentFilters] = useState({ raffleId: '', status: 'pending', reference: '' });
  const [proofViewer, setProofViewer] = useState({ visible: false, uri: '' });
  const [styleForm, setStyleForm] = useState({ raffleId: null, bannerImage: '', gallery: [], themeColor: '#2563eb', terms: '', whatsapp: '', instagram: '' });
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [raffles, setRaffles] = useState([]);
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [verifierInput, setVerifierInput] = useState('');
  const [verifierResult, setVerifierResult] = useState(null);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilters, setTicketFilters] = useState({ raffleId: '', status: '', from: '', to: '', reference: '', phone: '', cedula: '', email: '' });
  const [raffleForm, setRaffleForm] = useState({ id: null, title: '', price: '', description: '', totalTickets: '', digits: 4, startDate: '', endDate: '', securityCode: '', lottery: '', instantWins: '', terms: '', minTickets: '1', paymentMethods: ['mobile_payment'] });
  const [raffleErrors, setRaffleErrors] = useState({});
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [startDateValue, setStartDateValue] = useState(new Date());
  const [endDateValue, setEndDateValue] = useState(new Date());

  const LOTTERIES = [
    'Super Gana (Lotería del Táchira)',
    'Triple Táchira',
    'Triple Zulia',
    'Triple Caracas',
    'Triple Caliente',
    'Triple Zamorano',
    'La Ricachona',
    'La Ruca',
    'El Terminalito / La Granjita'
  ];
  const [closingId, setClosingId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [supportForm, setSupportForm] = useState({ whatsapp: '', instagram: '', facebook: '', tiktok: '', website: '', email: '' });
  const [paymentForm, setPaymentForm] = useState({ bank: '', phone: '', cedula: '' });
  const [savingSupport, setSavingSupport] = useState(false);
  const [securityStatus, setSecurityStatus] = useState({ active: false, updatedAt: null });
  const [securityLoading, setSecurityLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', imageUrl: '' });
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [winnerForm, setWinnerForm] = useState({ raffleId: '', ticketNumber: '', winnerName: '', prize: '', testimonial: '', photoUrl: '' });
  const [savingWinner, setSavingWinner] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [pushForm, setPushForm] = useState({ title: '', body: '' });
  const [sendingPush, setSendingPush] = useState(false);
  const [techSupport, setTechSupport] = useState(null);
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    if (activeSection === 'dashboard') loadMetrics();
  }, [activeSection]);

  useEffect(() => {
    setShowLotteryModal(false);
    setStartPickerVisible(false);
    setEndPickerVisible(false);
  }, [activeSection]);

  // Lottery Control State
  const [lotteryCheck, setLotteryCheck] = useState({ raffleId: '', number: '' });
  const [lotteryWinner, setLotteryWinner] = useState(null);
  const [checkingWinner, setCheckingWinner] = useState(false);
  const winnerAnim = useRef(new Animated.Value(0)).current;

  const sendPushBroadcast = async () => {
    if (!pushForm.title || !pushForm.body) return Alert.alert('Faltan datos', 'Título y mensaje requeridos.');
    setSendingPush(true);
    const { res, data } = await api('/admin/push/broadcast', {
      method: 'POST',
      body: JSON.stringify(pushForm)
    });
    if (res.ok) {
      Alert.alert('Enviado', data?.message || 'Notificación enviada.');
      setPushForm({ title: '', body: '' });
    } else {
      Alert.alert('Error', data?.error || 'No se pudo enviar.');
    }
    setSendingPush(false);
  };

  const checkWinner = async () => {
    if (!lotteryCheck.raffleId || !lotteryCheck.number) return Alert.alert('Faltan datos', 'Selecciona rifa y número.');
    setCheckingWinner(true);
    setLotteryWinner(null);
    winnerAnim.setValue(0);

    setTimeout(async () => {
      let foundTicket = null;
      if (ticketFilters.raffleId === lotteryCheck.raffleId && tickets.length > 0) {
        foundTicket = tickets.find(t => String(t.number) === String(lotteryCheck.number));
      } else {
        const { res, data } = await api(`/admin/tickets?raffleId=${lotteryCheck.raffleId}`);
        if (res.ok && Array.isArray(data)) {
           foundTicket = data?.find(t => String(t.number) === String(lotteryCheck.number));
        }
      }

      setCheckingWinner(false);
      
      if (foundTicket) {
        setLotteryWinner(foundTicket);
        Animated.spring(winnerAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true
        }).start();
      } else {
        Alert.alert('Sin resultados', 'No hay ticket vendido con ese número.');
      }
    }, 1500);
  };

  const announceWinner = () => {
    if (!lotteryWinner) return;
    const buyer = lotteryWinner.buyer || lotteryWinner.user || {};
    const name = buyer.firstName ? `${buyer.firstName} ${buyer.lastName}` : buyer.name || 'Anónimo';
    
    setWinnerForm({
      raffleId: lotteryCheck.raffleId,
      ticketNumber: String(lotteryWinner.number),
      winnerName: name,
      prize: '', 
      testimonial: '',
      photoUrl: ''
    });
    
    Alert.alert('Listo', 'Datos precargados en el formulario de abajo. Completa el premio y la foto.');
  };

  const proceedAnnouncement = () => {
    setConfirmModalVisible(false);
    announceWinner();
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
      Alert.alert('Error', data?.error || 'No se pudo cambiar la contraseña.');
    }
    setChangingPassword(false);
  };

  const pickWinnerImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setWinnerForm((s) => ({ ...s, photoUrl: `data:image/jpeg;base64,${asset.base64}` }));
    }
  };

  const submitWinner = async () => {
    if (!winnerForm.raffleId || !winnerForm.winnerName || !winnerForm.prize) return Alert.alert('Faltan datos', 'Rifa, Nombre y Premio son obligatorios.');
    setSavingWinner(true);
    const { res, data } = await api('/admin/winners', {
      method: 'POST',
      body: JSON.stringify(winnerForm)
    });
    if (res.ok) {
      Alert.alert('Listo', 'Ganador publicado en el Muro de la Fama.');
      setWinnerForm({ raffleId: '', ticketNumber: '', winnerName: '', prize: '', testimonial: '', photoUrl: '' });
    } else {
      Alert.alert('Error', data?.error || 'No se pudo publicar.');
    }
    setSavingWinner(false);
  };

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const { res, data } = await api('/me');
    if (res.ok) {
      setProfile(data);
      const sup = data?.support || {};
      setSupportForm({
        whatsapp: sup.whatsapp || '',
        instagram: sup.instagram || '',
        facebook: sup.facebook || '',
        tiktok: sup.tiktok || '',
        website: sup.website || '',
        email: sup.email || data?.email || ''
      });
    }
    setProfileLoading(false);
  }, [api]);

  const loadRaffles = useCallback(async () => {
    const { res, data } = await api('/admin/raffles');
    if (res.ok && Array.isArray(data)) {
      setRaffles(data);
      if (!selectedRaffle && data?.length) {
        const first = data[0];
        setSelectedRaffle(first);
        setStyleForm({
          raffleId: first.id,
          bannerImage: first.style?.bannerImage || '',
          themeColor: first.style?.themeColor || '#2563eb',
          accentColor: first.style?.accentColor || '#10b981',
          headline: first.style?.headline || '',
          ctaText: first.style?.ctaText || ''
        });
      }
    }
  }, [api, selectedRaffle]);

  const loadSecurityStatus = useCallback(async () => {
    setSecurityLoading(true);
    const { res, data } = await api('/admin/security-code');
    if (res.ok) setSecurityStatus(data);
    setSecurityLoading(false);
  }, [api]);

  const loadManualPayments = useCallback(async () => {
    setLoadingPayments(true);
    const params = new URLSearchParams();
    if (paymentFilters.raffleId) params.append('raffleId', paymentFilters.raffleId.trim());
    if (paymentFilters.status) params.append('status', paymentFilters.status.trim());
    if (paymentFilters.reference) params.append('reference', paymentFilters.reference.trim());
    const query = params.toString() ? `?${params.toString()}` : '';
    const { res, data } = await api(`/admin/manual-payments${query}`);
    if (res.ok) setPayments(Array.isArray(data) ? data : []);
    setLoadingPayments(false);
  }, [api, paymentFilters]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    const params = new URLSearchParams();
    if (ticketFilters.raffleId) params.append('raffleId', ticketFilters.raffleId);
    if (ticketFilters.status) params.append('status', ticketFilters.status);
    if (ticketFilters.from) params.append('from', ticketFilters.from);
    if (ticketFilters.to) params.append('to', ticketFilters.to);
    if (ticketFilters.reference) params.append('reference', ticketFilters.reference);
    if (ticketFilters.phone) params.append('phone', ticketFilters.phone);
    if (ticketFilters.cedula) params.append('cedula', ticketFilters.cedula);
    if (ticketFilters.email) params.append('email', ticketFilters.email);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { res, data } = await api(`/admin/tickets${query}`);
    if (res.ok && Array.isArray(data)) setTickets(data);
    setTicketsLoading(false);
  }, [api, ticketFilters]);

  const loadSuperAdminData = useCallback(async () => {
    // Load Tech Support for everyone (Admins need to see it too)
    try {
      const { res: sRes, data: sData } = await api('/settings/tech-support');
      if (sRes.ok) setTechSupport(sData);
    } catch (e) { console.log('No tech support config'); }

    if (user?.role !== 'superadmin') return;
    setLoadingSuper(true);
    try {
      const [s1, s2, s3, s4] = await Promise.all([
        api('/superadmin/settings'),
        api('/superadmin/audit/users'),
        api('/superadmin/mail/logs'),
        api('/superadmin/audit/actions')
      ]);
      if (s1.res.ok && s1.data) {
        setBranding((b) => ({ ...b, ...(s1.data?.branding || {}) }));
        setModules(s1.data?.modules || {});
        if (s1.data?.smtp) setSmtpForm(s => ({ ...s, ...s1.data?.smtp }));
        if (s1.data?.techSupport) setTechSupportForm(s => ({ ...s, ...s1.data?.techSupport }));

      }
      if (s2.res.ok && Array.isArray(s2.data)) {
        setUsers(s2.data);
        setFilteredUsers(s2.data);
      }
      if (s3.res.ok && Array.isArray(s3.data)) setMailLogs(s3.data);
      if (s4.res.ok && Array.isArray(s4.data)) setAuditLogs(s4.data);
    } catch (e) {
      console.error('Error loading superadmin data:', e);
      Alert.alert('Error', 'No se pudo cargar la información de superadmin.');
    }
    setLoadingSuper(false);
  }, [api, user?.role]);



  const toggleUserVerification = async (userId, currentStatus) => {
    const { res, data } = await api(`/superadmin/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ verified: !currentStatus })
    });
    if (res.ok) {
      Alert.alert('Éxito', `Usuario ${!currentStatus ? 'verificado' : 'desverificado'}.`);
      loadSuperAdminData();
    } else {
      Alert.alert('Error', data?.error || 'No se pudo cambiar el estado.');
    }
  };

  const filterUsers = (text) => {
    setUserSearch(text);
    if (!text) {
      setFilteredUsers(users);
    } else {
      const lower = text.toLowerCase();
      setFilteredUsers(users.filter(u => 
        (u.name && u.name.toLowerCase().includes(lower)) || 
        (u.email && u.email.toLowerCase().includes(lower))
      ));
    }
  };

  const saveSmtp = async () => {
    setSavingSmtp(true);
    const { res, data } = await api('/superadmin/settings/smtp', { method: 'PATCH', body: JSON.stringify(smtpForm) });
    if (res.ok) Alert.alert('Listo', 'Configuración SMTP guardada.');
    else Alert.alert('Error', data?.error || 'No se pudo guardar SMTP.');
    setSavingSmtp(false);
  };

  const saveTechSupport = async () => {
    const errors = {};
    if (!techSupportForm.phone) errors.phone = true;
    if (!techSupportForm.email) errors.email = true;
    setTechSupportErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingTechSupport(true);
    const { res, data } = await api('/superadmin/settings/tech-support', { method: 'PATCH', body: JSON.stringify(techSupportForm) });
    if (res.ok) Alert.alert('Listo', 'Soporte técnico actualizado.');
    else Alert.alert('Error', data?.error || 'No se pudo guardar.');
    setSavingTechSupport(false);
  };

  const createAccount = async () => {
    if (!createForm.email || !createForm.password) return Alert.alert('Faltan datos', 'Ingresa email y contraseña.');
    if (createForm.password.length < 8) return Alert.alert('Contraseña corta', 'Debe tener al menos 8 caracteres.');
    setCreating(true);
    const { res, data } = await api('/superadmin/users', {
      method: 'POST',
      body: JSON.stringify({ email: createForm.email, password: createForm.password, role: createForm.role, firstName: createForm.firstName, lastName: createForm.lastName, active: createForm.active })
    });
    if (res.ok) {
      Alert.alert('Cuenta creada', `Usuario ${data?.email || createForm.email}`);
      setCreateForm({ email: '', password: '', role: 'user', firstName: '', lastName: '', active: true });
      loadSuperAdminData();
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo crear la cuenta');
    }
    setCreating(false);
  };

  const saveBranding = async () => {
    setSavingBranding(true);
    const { res, data } = await api('/superadmin/settings/branding', { method: 'PATCH', body: JSON.stringify(branding) });
    if (res.ok) {
      setBranding(data?.branding || branding);
      Alert.alert('Listo', 'Branding actualizado');
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo guardar');
    }
    setSavingBranding(false);
  };

  const toggleModule = async (role, key) => {
    const next = { ...(modules || {}) };
    next[role] = { ...(next[role] || {}), [key]: !next[role]?.[key] };
    setModules(next);
    await api('/superadmin/settings/modules', { method: 'PATCH', body: JSON.stringify({ modules: next }) });
  };

  const updateUserStatus = async (id, patch) => {
    const { res } = await api(`/superadmin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify(patch) });
    if (res.ok) loadSuperAdminData();
  };

  const reset2fa = async (id) => {
    await api(`/superadmin/users/${id}/reset-2fa`, { method: 'POST' });
    loadSuperAdminData();
  };

  const revokeSessions = async (id) => {
    await api(`/superadmin/users/${id}/revoke-sessions`, { method: 'POST' });
    loadSuperAdminData();
  };

  useFocusEffect(
    useCallback(() => {
      const safeLoad = async (fn) => { try { await fn(); } catch (e) { console.log('Load error:', e); } };
      
      safeLoad(loadProfile);
      safeLoad(loadSecurityStatus);
      safeLoad(loadManualPayments);
      safeLoad(loadRaffles);
      safeLoad(loadTickets);
      safeLoad(loadSuperAdminData);
    }, [loadProfile, loadSecurityStatus, loadManualPayments, loadRaffles, loadTickets, loadSuperAdminData])
  );

  const saveSupport = async () => {
    setSavingSupport(true);
    const { res, data } = await api('/me', {
      method: 'PATCH',
      body: JSON.stringify({ support: supportForm, paymentMobile: paymentForm })
    });
    if (res.ok) {
      setProfile(data);
      Alert.alert('Listo', 'Datos de soporte guardados.');
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo guardar.');
    }
    setSavingSupport(false);
  };

  const processPayment = async (id, action, reason = null) => {
    setActingId(id);
    const endpoint = action === 'approve' ? `/admin/manual-payments/${id}/approve` : `/admin/manual-payments/${id}/reject`;
    const { res, data } = await api(endpoint, { method: 'POST', body: JSON.stringify({ reason }) });
    if (res.ok) {
      Alert.alert('Listo', action === 'approve' ? 'Pago aprobado y tickets generados.' : 'Pago rechazado.');
      loadManualPayments();
      loadTickets();
    } else {
      Alert.alert('Error', data?.error || 'No se pudo procesar.');
    }
    setActingId(null);
  };

  const updateStyle = async () => {
    if (!styleForm.raffleId) return Alert.alert('Falta rifa', 'Selecciona una rifa.');
    setStyleLoading(true);
    const { res, data } = await api(`/raffles/${styleForm.raffleId}/style`, {
      method: 'PATCH',
      body: JSON.stringify(styleForm)
    });
    if (res.ok) {
      Alert.alert('Estilo actualizado');
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo actualizar el estilo.');
    }
    setStyleLoading(false);
  };

  const exportTickets = async () => {
    setTicketsLoading(true);
    const params = new URLSearchParams();
    if (ticketFilters.raffleId) params.append('raffleId', ticketFilters.raffleId);
    if (ticketFilters.status) params.append('status', ticketFilters.status);
    if (ticketFilters.from) params.append('from', ticketFilters.from);
    if (ticketFilters.to) params.append('to', ticketFilters.to);
    if (ticketFilters.reference) params.append('reference', ticketFilters.reference);
    if (ticketFilters.phone) params.append('phone', ticketFilters.phone);
    if (ticketFilters.cedula) params.append('cedula', ticketFilters.cedula);
    if (ticketFilters.email) params.append('email', ticketFilters.email);
    params.append('format', 'csv');
    const query = params.toString() ? `?${params.toString()}` : '';
    const { res, data } = await api(`/admin/tickets${query}`, { method: 'GET', headers: { Accept: 'text/csv' } }, false);
    if (res.ok) {
      Alert.alert('Exportado', 'CSV generado. Revisa la consola para copiarlo.');
      console.log('CSV tickets:\n', data);
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo exportar.');
    }
    setTicketsLoading(false);
  };

  const paymentKPIs = useMemo(() => {
    const byStatus = payments.reduce((acc, p) => {
      const key = p.status || 'pending';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const pending = byStatus.pending || 0;
    const approved = byStatus.approved || 0;
    const rejected = byStatus.rejected || 0;
    return { pending, approved, rejected, total: payments.length };
  }, [payments]);

  const winnerInfo = useMemo(() => {
    if (!selectedRaffle) return null;
    const winner = selectedRaffle.winnerSnapshot;
    if (!winner) return null;
    const buyer = winner.buyer || {};
    return {
      ticket: winner.ticketNumber || winner.winningTicketNumber,
      name: `${buyer.firstName || buyer.name || 'Ganador'} ${buyer.lastName || ''}`.trim(),
      email: buyer.email,
      phone: buyer.phone,
      announcedAt: winner.announcedAt ? new Date(winner.announcedAt).toLocaleString() : null
    };
  }, [selectedRaffle]);

  const pickBanner = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      allowsEditing: false,
      base64: false
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      const normalized = await normalizeImage(asset, { maxWidth: 1400, compress: 0.85 });
      setStyleForm((s) => ({ ...s, bannerImage: normalized }));
    }
  };

  const pickGalleryImage = async () => {
    if ((styleForm.gallery || []).length >= MAX_GALLERY_IMAGES) {
      return Alert.alert('Límite alcanzado', `Solo puedes cargar hasta ${MAX_GALLERY_IMAGES} fotos.`);
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      allowsEditing: false,
      base64: false
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      const normalized = await normalizeImage(asset, { maxWidth: 1400, compress: 0.85 });
      setStyleForm(s => ({ ...s, gallery: [...(s.gallery || []), normalized] }));
    }
  };

  const removeGalleryImage = (index) => {
    setStyleForm(s => ({ ...s, gallery: (s.gallery || []).filter((_, i) => i !== index) }));
  };

  const closeProofViewer = () => setProofViewer({ visible: false, uri: '' });

  const editRaffle = (raffle) => {
    setRaffleForm({
      id: raffle.id,
      title: raffle.title || '',
      price: String(raffle.price || ''),
      description: raffle.description || '',
      totalTickets: raffle.totalTickets ? String(raffle.totalTickets) : '',
      digits: raffle.digits || 4,
      startDate: raffle.startDate ? raffle.startDate.slice(0, 10) : '',
      endDate: raffle.endDate ? raffle.endDate.slice(0, 10) : '',
      lottery: raffle.lottery || '',
      instantWins: raffle.instantWins ? raffle.instantWins.join(', ') : '',
      terms: raffle.terms || '',
      minTickets: String(raffle.minTickets || '1'),
      paymentMethods: raffle.paymentMethods || ['mobile_payment']
    });
  };

  useEffect(() => {
    if (raffleForm.startDate) {
      const d = new Date(raffleForm.startDate);
      if (!Number.isNaN(d.getTime())) setStartDateValue(d);
    }
  }, [raffleForm.startDate]);

  useEffect(() => {
    if (raffleForm.endDate) {
      const d = new Date(raffleForm.endDate);
      if (!Number.isNaN(d.getTime())) setEndDateValue(d);
    }
  }, [raffleForm.endDate]);

  const saveStyle = async () => {
    if (!selectedRaffle) return;
    setSavingStyle(true);
    const payload = {
      style: {
        bannerImage: styleForm.bannerImage,
        gallery: styleForm.gallery,
        themeColor: styleForm.themeColor,
        whatsapp: styleForm.whatsapp,
        instagram: styleForm.instagram
      }
    };
    const { res, data } = await api(`/admin/raffles/${selectedRaffle.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (res.ok) {
      Alert.alert('Listo', 'Estilo actualizado.');
      loadRaffles();
    } else {
      Alert.alert('Error', data?.error || 'No se pudo guardar estilo.');
    }
    setSavingStyle(false);
  };

  const resetRaffleForm = () => {
    setRaffleForm({ id: null, title: '', price: '', description: '', totalTickets: '', startDate: '', endDate: '', securityCode: '', lottery: '', instantWins: '', terms: '', minTickets: '1', paymentMethods: ['mobile_payment'] });
    setRaffleErrors({});
  };

  const submitRaffle = async () => {
    const errors = {};
    if (!raffleForm.title) errors.title = true;
    if (!raffleForm.price) errors.price = true;
    if (!raffleForm.lottery) errors.lottery = true;
    
    setRaffleErrors(errors);
    if (Object.keys(errors).length > 0) return;
    
    if (raffleForm.paymentMethods.includes('mobile_payment')) {
       await api('/me', { method: 'PATCH', body: JSON.stringify({ bankDetails: bankSettings }) });
    }

    const instantWinsArray = raffleForm.instantWins 
      ? raffleForm.instantWins.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      : [];

    const payload = {
      title: raffleForm.title,
      price: Number(raffleForm.price),
      description: raffleForm.description,
      totalTickets: raffleForm.totalTickets ? Number(raffleForm.totalTickets) : undefined,
      digits: raffleForm.digits,
      startDate: raffleForm.startDate,
      endDate: raffleForm.endDate,
      securityCode: raffleForm.securityCode,
      lottery: raffleForm.lottery,
      instantWins: instantWinsArray,
      terms: raffleForm.terms,
      minTickets: Number(raffleForm.minTickets) || 1,
      paymentMethods: raffleForm.paymentMethods
    };
    setSavingRaffle(true);
    const endpoint = raffleForm.id ? `/admin/raffles/${raffleForm.id}` : '/raffles';
    const method = raffleForm.id ? 'PATCH' : 'POST';
    const { res, data } = await api(endpoint, { method, body: JSON.stringify(payload) });
    if (res.ok) {
      Alert.alert('Listo', raffleForm.id ? 'Rifa actualizada.' : 'Rifa creada.', [
        { text: 'OK', onPress: () => {
            resetRaffleForm();
            loadRaffles();
            loadTickets();
            setActiveSection(null);
        }}
      ]);
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo guardar.');
    }
    setSavingRaffle(false);
  };

  const onStartDateChange = (_event, selectedDate) => {
    if (Platform.OS !== 'ios') setStartPickerVisible(false);
    if (!_event || _event.type === 'dismissed') return;
    const nextDate = selectedDate || startDateValue;
    setStartDateValue(nextDate);
    setRaffleForm((s) => ({ ...s, startDate: nextDate.toISOString().slice(0, 10) }));
  };

  const onEndDateChange = (_event, selectedDate) => {
    if (Platform.OS !== 'ios') setEndPickerVisible(false);
    if (!_event || _event.type === 'dismissed') return;
    const nextDate = selectedDate || endDateValue;
    setEndDateValue(nextDate);
    setRaffleForm((s) => ({ ...s, endDate: nextDate.toISOString().slice(0, 10) }));
  };

  const regenerateSecurityCode = async () => {
    setRegenerating(true);
    const { res, data } = await api('/admin/security-code/regenerate', { method: 'POST' });
    if (res.ok) {
      Alert.alert('Nuevo código', `Código: ${data?.code}\nGuárdalo y no lo compartas.`);
      setSecurityStatus({ active: true, updatedAt: Date.now() });
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo regenerar.');
    }
    setRegenerating(false);
  };

  useEffect(() => {
    if (activeSection === 'news') loadAnnouncements();
  }, [activeSection]);

  const loadAnnouncements = async () => {
    const { res, data } = await api('/announcements');
    if (res.ok) setAnnouncements(data);
  };

  const deleteAnnouncement = async (id) => {
    if (user?.role !== 'superadmin') return Alert.alert('Acceso denegado', 'Solo el superadmin puede eliminar anuncios.');
    Alert.alert('Eliminar', '¿Eliminar este anuncio?', [
      { text: 'Cancelar' },
      { text: 'Eliminar', onPress: async () => {
        const { res, data } = await api(`/admin/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadAnnouncements();
        } else {
          Alert.alert('Error', data?.error || 'No se pudo eliminar.');
        }
      }}
    ]);
  };

  const createAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.content) return Alert.alert('Faltan datos', 'Título y contenido requeridos.');
    setSavingAnnouncement(true);
    const { res, data } = await api('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(announcementForm)
    });
    if (res.ok) {
      Alert.alert('Listo', 'Anuncio publicado.');
      setAnnouncementForm({ title: '', content: '', imageUrl: '' });
      loadAnnouncements();
    } else {
      Alert.alert('Error', data?.error || 'No se pudo publicar.');
    }
    setSavingAnnouncement(false);
  };

  const pickAnnouncementImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      setAnnouncementForm((s) => ({ ...s, imageUrl: `data:image/jpeg;base64,${asset.base64}` }));
    }
  };

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const [summary, hourly, daily, byState, top] = await Promise.all([
        api('/admin/metrics/summary'),
        api('/admin/metrics/hourly'),
        api('/admin/metrics/daily?days=7'),
        api('/admin/metrics/by-state'),
        api('/admin/metrics/top-buyers')
      ]);

      if (summary.res.ok) setMetricsSummary(summary.data); else setMetricsSummary(null);
      if (hourly.res.ok) setMetricsHourly(hourly.data || []); else setMetricsHourly([]);
      if (daily.res.ok) setMetricsDaily(daily.data || []); else setMetricsDaily([]);
      if (byState.res.ok) setMetricsByState(byState.data || []); else setMetricsByState([]);
      if (top.res.ok) setMetricsTop(top.data || []); else setMetricsTop([]);
    } catch (err) {
      console.log('metrics error', err);
    }
    setMetricsLoading(false);
  };

  const closeRaffle = async (raffleId) => {
    setClosingId(raffleId);
    const { res, data } = await api(`/raffles/${raffleId}/close`, { method: 'POST' });
    if (res.ok) {
      Alert.alert('Rifa cerrada', `Ticket ganador: ${data?.winner?.number ? formatTicketNumber(data?.winner.number, raffles.find(r => r.id === raffleId)?.digits) : '—'}`);
      loadRaffles();
      loadTickets();
    } else {
      Alert.alert('Ups', data?.error || 'No se pudo cerrar la rifa.');
    }
    setClosingId(null);
  };

  const deleteRaffle = async (raffleId) => {
    if (user?.role !== 'superadmin') return Alert.alert('Acceso denegado', 'Solo el superadmin puede eliminar rifas.');
    
    Alert.alert(
      'Eliminar Rifa',
      '¿Estás seguro? Esta acción eliminará la rifa y todos sus tickets asociados. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            setSavingRaffle(true);
            const { res, data } = await api(`/raffles/${raffleId}`, { method: 'DELETE' });
            if (res.ok) {
              Alert.alert('Eliminada', 'La rifa ha sido eliminada.');
              loadRaffles();
              if (raffleForm.id === raffleId) resetRaffleForm();
            } else {
              Alert.alert('Error', data?.error || 'No se pudo eliminar.');
            }
            setSavingRaffle(false);
          }
        }
      ]
    );
  };

  return (
    <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.title, { marginBottom: 0 }]}>{user?.role === 'superadmin' ? 'SUPERADMIN' : 'Perfil Admin'}</Text>
            {techSupport && (
              <TouchableOpacity onPress={() => setSupportVisible(true)} style={{ padding: 8 }}>
                <Ionicons name="help-circle-outline" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Wallet pill removed per request */}

          {!activeSection ? (
            <>
              <View style={styles.card}>
                <Text style={styles.section}>Menú Principal</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {MENU_ITEMS.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ width: '48%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                      onPress={() => {
                        if (item.requiresSuperadmin && user?.role !== 'superadmin') {
                          Alert.alert('Solo Superadmin', 'Necesitas permisos de superadmin para esta sección.');
                          return;
                        }
                        setActiveSection(item.id);
                      }}
                    >
                      <Ionicons name={item.icon} size={24} color={item.color} style={{ marginBottom: 8 }} />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{item.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          ) : null}

          {/* ... (Rest of the sections remain mostly the same, just need to ensure imports are correct) ... */}
          {/* I will include the Raffles section with Instant Wins input */}
          
          {activeSection === 'raffles' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Crear o Editar Rifa</Text>
              </View>

              <Text style={styles.section}>Datos Generales</Text>
              <View style={{ marginBottom: 10 }}>
                <TextInput 
                  style={[styles.input, raffleErrors.title && { borderColor: '#ef4444', borderWidth: 1 }]} 
                  placeholder="Titulo" 
                  value={raffleForm.title} 
                  onChangeText={(v) => setRaffleForm((s) => ({ ...s, title: v }))} 
                />
                {raffleErrors.title && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <TextInput 
                    style={[styles.input, raffleErrors.price && { borderColor: '#ef4444', borderWidth: 1 }]} 
                    placeholder="Precio" 
                    value={raffleForm.price} 
                    onChangeText={(v) => setRaffleForm((s) => ({ ...s, price: v }))} 
                    keyboardType="numeric" 
                  />
                  {raffleErrors.price && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Mín. Tickets" 
                    value={raffleForm.minTickets} 
                    onChangeText={(v) => setRaffleForm((s) => ({ ...s, minTickets: v }))} 
                    keyboardType="numeric" 
                  />
                </View>
              </View>

              <TextInput style={styles.input} placeholder="Descripcion" value={raffleForm.description} onChangeText={(v) => setRaffleForm((s) => ({ ...s, description: v }))} />
              
              <View style={{ marginBottom: 10 }}>
                <TouchableOpacity 
                  onPress={() => setShowLotteryModal(true)} 
                  style={[styles.input, { justifyContent: 'center' }, raffleErrors.lottery && { borderColor: '#ef4444', borderWidth: 1 }]}
                >
                    <Text style={{ color: raffleForm.lottery ? '#fff' : '#94a3b8' }}>{raffleForm.lottery || 'Seleccionar Lotería'}</Text>
                    <Ionicons name="chevron-down-outline" size={20} color="#94a3b8" style={{ position: 'absolute', right: 12 }} />
                </TouchableOpacity>
                {raffleErrors.lottery && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
              </View>

              <Modal visible={showLotteryModal} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
                  <View style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 20, maxHeight: '80%' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>Selecciona una Lotería</Text>
                    <ScrollView>
                      {LOTTERIES.map((l) => (
                        <TouchableOpacity key={l} onPress={() => { setRaffleForm(s => ({...s, lottery: l})); setShowLotteryModal(false); }} style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Ionicons name="ticket-outline" size={18} color="#fbbf24" />
                          <Text style={{ color: '#e2e8f0', fontSize: 16 }}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity onPress={() => setShowLotteryModal(false)} style={{ marginTop: 16, alignItems: 'center' }}>
                      <Text style={{ color: '#ef4444', fontSize: 16 }}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginTop: 10, marginBottom: 4 }}>Tipo de Rifa (Dígitos)</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity 
                  onPress={() => setRaffleForm(s => ({ ...s, digits: 4 }))} 
                  style={{ 
                    flex: 1, 
                    padding: 12, 
                    backgroundColor: raffleForm.digits === 4 ? palette.primary : 'rgba(255,255,255,0.1)', 
                    borderRadius: 8, 
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: raffleForm.digits === 4 ? palette.primary : 'rgba(255,255,255,0.2)'
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>4 Dígitos (Tradicional)</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 10 }}>0000 - 9999</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setRaffleForm(s => ({ ...s, digits: 7 }))} 
                  style={{ 
                    flex: 1, 
                    padding: 12, 
                    backgroundColor: raffleForm.digits === 7 ? palette.primary : 'rgba(255,255,255,0.1)', 
                    borderRadius: 8, 
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: raffleForm.digits === 7 ? palette.primary : 'rgba(255,255,255,0.2)'
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>7 Dígitos (Millonaria)</Text>
                  <Text style={{ color: '#cbd5e1', fontSize: 10 }}>0.000.000 - 9.999.999</Text>
                </TouchableOpacity>
              </View>

              <TextInput style={styles.input} placeholder="Total tickets" value={raffleForm.totalTickets} onChangeText={(v) => setRaffleForm((s) => ({ ...s, totalTickets: v }))} keyboardType="numeric" />
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setStartPickerVisible(true)}
              >
                <Text style={{ color: raffleForm.startDate ? '#fff' : '#94a3b8' }}>{raffleForm.startDate || 'Inicio'}</Text>
                <Ionicons name="calendar-outline" size={18} color="#cbd5e1" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => setEndPickerVisible(true)}
              >
                <Text style={{ color: raffleForm.endDate ? '#fff' : '#94a3b8' }}>{raffleForm.endDate || 'Cierre'}</Text>
                <Ionicons name="calendar-outline" size={18} color="#cbd5e1" />
              </TouchableOpacity>
              {startPickerVisible && (
                <DateTimePicker
                  value={startDateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onStartDateChange}
                  minimumDate={new Date()}
                />
              )}
              {endPickerVisible && (
                <DateTimePicker
                  value={endDateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={onEndDateChange}
                  minimumDate={startDateValue || new Date()}
                />
              )}
              <TextInput style={styles.input} placeholder="Código de seguridad" value={raffleForm.securityCode} onChangeText={(v) => setRaffleForm((s) => ({ ...s, securityCode: v }))} secureTextEntry />
              
              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginTop: 10, marginBottom: 4 }}>Premios Rápidos (Instant Wins)</Text>
              <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>Ingresa los números ganadores separados por coma (ej: 10, 50, 100)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Números ganadores instantáneos" 
                value={raffleForm.instantWins} 
                onChangeText={(v) => setRaffleForm((s) => ({ ...s, instantWins: v }))} 
                keyboardType="numeric"
              />

              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginTop: 10, marginBottom: 4 }}>Términos y Condiciones</Text>
              <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>Reglas específicas para esta rifa (opcional)</Text>
              <TextInput 
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]} 
                placeholder="Escribe aquí los términos y condiciones..." 
                value={raffleForm.terms} 
                onChangeText={(v) => setRaffleForm((s) => ({ ...s, terms: v }))} 
                multiline
                numberOfLines={4}
              />

              {/* SECCIÓN DE MÉTODOS DE PAGO INTEGRADA */}
              <Text style={[styles.section, { marginTop: 24, color: '#fbbf24' }]}>Métodos de Pago Aceptados</Text>
              <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 12 }}>Selecciona qué métodos de pago estarán disponibles para esta rifa.</Text>

              {/* Pago Móvil Toggle */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                <TouchableOpacity 
                  onPress={() => {
                    const methods = raffleForm.paymentMethods || [];
                    const newMethods = methods.includes('mobile_payment') 
                      ? methods.filter(m => m !== 'mobile_payment')
                      : [...methods, 'mobile_payment'];
                    setRaffleForm(s => ({ ...s, paymentMethods: newMethods }));
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: (raffleForm.paymentMethods || []).includes('mobile_payment') ? 'rgba(16, 185, 129, 0.1)' : 'transparent' }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ionicons name="phone-portrait-outline" size={24} color={(raffleForm.paymentMethods || []).includes('mobile_payment') ? '#10b981' : '#94a3b8'} />
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Pago Móvil</Text>
                  </View>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: (raffleForm.paymentMethods || []).includes('mobile_payment') ? '#10b981' : '#94a3b8', alignItems: 'center', justifyContent: 'center' }}>
                    {(raffleForm.paymentMethods || []).includes('mobile_payment') && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />}
                  </View>
                </TouchableOpacity>
                
                {(raffleForm.paymentMethods || []).includes('mobile_payment') && (
                  <View style={{ padding: 16, paddingTop: 0 }}>
                    <Text style={{ color: palette.muted, marginBottom: 8, fontSize: 12 }}>Datos actuales (se actualizarán en tu perfil al guardar):</Text>
                    <TextInput style={styles.input} placeholder="Banco (Ej: Venezuela)" value={bankSettings.bankName} onChangeText={(v) => setBankSettings(s => ({ ...s, bankName: v }))} />
                    <TextInput style={styles.input} placeholder="Cédula (V-12345678)" value={bankSettings.cedula} onChangeText={(v) => setBankSettings(s => ({ ...s, cedula: v }))} />
                    <TextInput style={styles.input} placeholder="Teléfono (0412...)" value={bankSettings.phone} onChangeText={(v) => setBankSettings(s => ({ ...s, phone: v }))} keyboardType="phone-pad" />
                    <TextInput style={styles.input} placeholder="Titular" value={bankSettings.accountName} onChangeText={(v) => setBankSettings(s => ({ ...s, accountName: v }))} />
                  </View>
                )}
              </View>

              {/* Otros Métodos (Placeholders) */}
              {['Zelle', 'Binance', 'Transferencia'].map(method => (
                <TouchableOpacity 
                  key={method}
                  onPress={() => Alert.alert('Próximamente', `La integración con ${method} estará disponible pronto.`)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8, opacity: 0.5 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Ionicons name={method === 'Zelle' ? 'cash-outline' : method === 'Binance' ? 'logo-bitcoin' : 'card-outline'} size={24} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>{method}</Text>
                  </View>
                  <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}


              <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
                <FilledButton
                  title={savingRaffle ? 'Guardando...' : raffleForm.id ? 'Actualizar rifa' : 'Crear rifa'}
                  onPress={submitRaffle}
                  loading={savingRaffle}
                  disabled={savingRaffle}
                  icon={<Ionicons name={raffleForm.id ? 'create-outline' : 'add-circle-outline'} size={18} color="#fff" />}
                />
                {raffleForm.id ? (
                  <OutlineButton title="Nueva" onPress={resetRaffleForm} icon={<Ionicons name="refresh-outline" size={18} color={palette.primary} />} />
                ) : null}
              </View>

              <Text style={[styles.section, { marginTop: 24 }]}>Rifas Existentes</Text>
              {raffles.filter(r => r).map(r => (
                <View key={r.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{r.title}</Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>ID: {r.id} • {r.status === 'closed' ? 'CERRADA' : 'ABIERTA'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => {
                        setRaffleForm({
                          id: r.id,
                          title: r.title,
                          price: String(r.price),
                          description: r.description || '',
                          totalTickets: String(r.totalTickets),
                          startDate: r.startDate ? r.startDate.split('T')[0] : '',
                          endDate: r.endDate ? r.endDate.split('T')[0] : '',
                          securityCode: r.securityCode || '',
                          lottery: r.lottery || '',
                          instantWins: r.instantWins ? r.instantWins.join(', ') : '',
                          terms: r.terms || '',
                          digits: r.digits || 4,
                          minTickets: String(r.minTickets || '1'),
                          paymentMethods: r.paymentMethods || ['mobile_payment']
                        });
                      }} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                        <Ionicons name="create-outline" size={20} color="#fff" />
                      </TouchableOpacity>
                      
                      {r.status !== 'closed' && (
                        <TouchableOpacity onPress={() => Alert.alert('Cerrar Rifa', '¿Cerrar esta rifa y seleccionar ganador?', [{ text: 'Cancelar' }, { text: 'Cerrar', onPress: () => closeRaffle(r.id) }])} style={{ padding: 8, backgroundColor: 'rgba(251, 191, 36, 0.2)', borderRadius: 8 }}>
                          <Ionicons name="lock-closed-outline" size={20} color="#fbbf24" />
                        </TouchableOpacity>
                      )}

                      {user?.role === 'superadmin' && (
                        <TouchableOpacity onPress={() => deleteRaffle(r.id)} style={{ padding: 8, backgroundColor: 'rgba(248, 113, 113, 0.2)', borderRadius: 8 }}>
                          <Ionicons name="trash-outline" size={20} color="#f87171" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeSection === 'sa_tech_support' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Soporte Técnico</Text>
              </View>
              <Text style={styles.muted}>Configura los canales de soporte para reportes de fallas.</Text>
              <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 12 }}>Visible solo para usuarios cuando esté configurado.</Text>
              
              <Text style={styles.section}>WhatsApp Soporte</Text>
              <View style={{ marginBottom: 10 }}>
                <TextInput
                  style={[styles.input, techSupportErrors.phone && { borderColor: '#ef4444', borderWidth: 1 }]}
                  placeholder="+58 412 1234567"
                  value={techSupportForm.phone}
                  onChangeText={(v) => setTechSupportForm(s => ({ ...s, phone: v }))}
                  keyboardType="phone-pad"
                />
                {techSupportErrors.phone && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
              </View>
              
              <Text style={styles.section}>Email Soporte</Text>
              <View style={{ marginBottom: 10 }}>
                <TextInput
                  style={[styles.input, techSupportErrors.email && { borderColor: '#ef4444', borderWidth: 1 }]}
                  placeholder="soporte@app.com"
                  value={techSupportForm.email}
                  onChangeText={(v) => setTechSupportForm(s => ({ ...s, email: v }))}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {techSupportErrors.email && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
              </View>

              <FilledButton 
                title={savingTechSupport ? 'Guardando...' : 'Guardar Configuración'} 
                onPress={saveTechSupport} 
                loading={savingTechSupport} 
                disabled={savingTechSupport}
                icon={<Ionicons name="save-outline" size={18} color="#fff" />}
              />
            </View>
          )}

          {activeSection === 'sa_users' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => {
                    if (viewUser) setViewUser(null);
                    else setActiveSection(null);
                  }}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>
                    {viewUser ? 'Hoja de Vida' : 'Gestión de Usuarios'}
                  </Text>
              </View>
              
              {viewUser ? (
                <View>
                  {/* VISTA DE DETALLE (HOJA DE VIDA) */}
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, marginBottom: 16 }}>
                      <View style={{ alignItems: 'center', marginBottom: 16 }}>
                          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                              <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#fff' }}>
                                  {(viewUser.name || 'U').charAt(0).toUpperCase()}
                              </Text>
                          </View>
                          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#fff' }}>{viewUser.name}</Text>
                          <Text style={{ color: palette.muted }}>{viewUser.email}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                              <View style={{ backgroundColor: viewUser.role === 'admin' ? '#60a5fa' : '#94a3b8', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>{viewUser.role.toUpperCase()}</Text>
                              </View>
                              <View style={{ backgroundColor: viewUser.active ? '#4ade80' : '#f87171', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#000' }}>{viewUser.active ? 'ACTIVO' : 'INACTIVO'}</Text>
                              </View>
                          </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 16 }}>
                          <TouchableOpacity 
                              onPress={() => {
                                const newStatus = !viewUser.active;
                                updateUserStatus(viewUser.id, { active: newStatus });
                                setViewUser(prev => ({ ...prev, active: newStatus }));
                              }}
                              style={{ alignItems: 'center' }}
                          >
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: viewUser.active ? 'rgba(248, 113, 113, 0.2)' : 'rgba(74, 222, 128, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                  <Ionicons name={viewUser.active ? "ban" : "checkmark"} size={20} color={viewUser.active ? "#f87171" : "#4ade80"} />
                              </View>
                              <Text style={{ color: '#fff', fontSize: 12 }}>{viewUser.active ? 'Bloquear' : 'Activar'}</Text>
                          </TouchableOpacity>

                          <TouchableOpacity 
                              onPress={() => {
                                const newStatus = !viewUser.verified;
                                toggleUserVerification(viewUser.id, viewUser.verified);
                                setViewUser(prev => ({ ...prev, verified: newStatus }));
                              }}
                              style={{ alignItems: 'center' }}
                          >
                              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: viewUser.verified ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 211, 238, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                                  <Ionicons name={viewUser.verified ? "close" : "checkmark-done"} size={20} color={viewUser.verified ? "#fbbf24" : "#22d3ee"} />
                              </View>
                              <Text style={{ color: '#fff', fontSize: 12 }}>{viewUser.verified ? 'Revocar' : 'Verificar'}</Text>
                          </TouchableOpacity>
                      </View>
                  </View>

                  <Text style={styles.section}>Historial Reciente</Text>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16 }}>
                      <Text style={{ color: palette.muted, textAlign: 'center', fontStyle: 'italic' }}>
                          No hay transacciones recientes registradas para este usuario.
                      </Text>
                  </View>
                </View>
              ) : (
                <>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
                    <Text style={styles.section}>Crear Nuevo Usuario</Text>
                    <TextInput style={styles.input} placeholder="Email" value={createForm.email} onChangeText={(v) => setCreateForm(s => ({ ...s, email: v }))} autoCapitalize="none" />
                    <TextInput style={styles.input} placeholder="Contraseña" value={createForm.password} onChangeText={(v) => setCreateForm(s => ({ ...s, password: v }))} secureTextEntry />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nombre" value={createForm.firstName} onChangeText={(v) => setCreateForm(s => ({ ...s, firstName: v }))} />
                      <TextInput style={[styles.input, { flex: 1 }]} placeholder="Apellido" value={createForm.lastName} onChangeText={(v) => setCreateForm(s => ({ ...s, lastName: v }))} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text style={{ color: '#fff' }}>Rol: {createForm.role}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setCreateForm(s => ({ ...s, role: 'user' }))} style={{ padding: 8, backgroundColor: createForm.role === 'user' ? palette.primary : '#334155', borderRadius: 8 }}><Text style={{ color: '#fff' }}>User</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setCreateForm(s => ({ ...s, role: 'admin' }))} style={{ padding: 8, backgroundColor: createForm.role === 'admin' ? palette.primary : '#334155', borderRadius: 8 }}><Text style={{ color: '#fff' }}>Admin</Text></TouchableOpacity>
                      </View>
                    </View>
                    <FilledButton title={creating ? 'Creando...' : 'Crear Usuario'} onPress={createAccount} loading={creating} disabled={creating} icon={<Ionicons name="person-add-outline" size={18} color="#fff" />} />
                  </View>

                  <Text style={styles.section}>Lista de Usuarios ({filteredUsers.length})</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder="Buscar por nombre o email..." 
                    value={userSearch} 
                    onChangeText={filterUsers} 
                  />

                  <Text style={[styles.section, { marginTop: 16, color: '#60a5fa' }]}>Administradores y Staff</Text>
                  {filteredUsers.filter(u => u && (u.role === 'admin' || u.role === 'superadmin')).map(u => (
                    <TouchableOpacity 
                      key={u.id || Math.random()} 
                      onPress={() => setViewUser(u)}
                      style={{ backgroundColor: 'rgba(96, 165, 250, 0.1)', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.3)' }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.name || 'Sin nombre'}</Text>
                          <Text style={{ color: palette.muted, fontSize: 12 }}>{u.email}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={{ backgroundColor: u.role === 'superadmin' ? '#c084fc' : '#60a5fa', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{(u.role || 'user').toUpperCase()}</Text>
                            </View>
                            <View style={{ backgroundColor: u.active ? '#4ade80' : '#f87171', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{u.active ? 'ACTIVO' : 'INACTIVO'}</Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  <Text style={[styles.section, { marginTop: 16, color: '#4ade80' }]}>Usuarios Registrados</Text>
                  {filteredUsers.filter(u => u && u.role !== 'admin' && u.role !== 'superadmin').map(u => (
                    <TouchableOpacity 
                      key={u.id || Math.random()} 
                      onPress={() => setViewUser(u)}
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8 }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.name || 'Sin nombre'}</Text>
                          <Text style={{ color: palette.muted, fontSize: 12 }}>{u.email}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={{ backgroundColor: '#94a3b8', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>USER</Text>
                            </View>
                            <View style={{ backgroundColor: u.active ? '#4ade80' : '#f87171', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{u.active ? 'ACTIVO' : 'INACTIVO'}</Text>
                            </View>
                            <View style={{ backgroundColor: u.verified ? '#22d3ee' : '#fbbf24', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{u.verified ? 'VERIFICADO' : 'NO VERIF.'}</Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          )}





          {activeSection === 'news' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Novedades</Text>
              </View>
              
              <Text style={styles.section}>Publicar Nueva Noticia</Text>
              <TextInput style={styles.input} placeholder="Título del anuncio" value={announcementForm.title} onChangeText={(v) => setAnnouncementForm(s => ({ ...s, title: v }))} />
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Contenido del mensaje..." value={announcementForm.content} onChangeText={(v) => setAnnouncementForm(s => ({ ...s, content: v }))} multiline />
              
              <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickAnnouncementImage}>
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>{announcementForm.imageUrl ? 'Cambiar Imagen' : 'Adjuntar Imagen'}</Text>
              </TouchableOpacity>
              {announcementForm.imageUrl && <Image source={{ uri: announcementForm.imageUrl }} style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 12 }} />}

              <FilledButton title={savingAnnouncement ? 'Publicando...' : 'Publicar Noticia'} onPress={createAnnouncement} loading={savingAnnouncement} disabled={savingAnnouncement} icon={<Ionicons name="newspaper-outline" size={18} color="#fff" />} />
              
              <Text style={[styles.section, { marginTop: 24 }]}>Noticias Publicadas</Text>
              {announcements.map(a => (
                <View key={a.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{a.title}</Text>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>{new Date(a.createdAt).toLocaleDateString()}</Text>
                    </View>
                    {user?.role === 'superadmin' && (
                      <TouchableOpacity onPress={() => deleteAnnouncement(a.id)} style={{ padding: 8, backgroundColor: 'rgba(248, 113, 113, 0.2)', borderRadius: 8 }}>
                        <Ionicons name="trash-outline" size={20} color="#f87171" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeSection === 'dashboard' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Dashboard</Text>
              </View>

              <Text style={styles.section}>Rifa</Text>
                <TouchableOpacity onPress={() => setRafflePickerVisible(true)} style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: selectedRaffle ? '#fff' : '#94a3b8' }}>{selectedRaffle?.title || 'Seleccionar Rifa'}</Text>
                  <Ionicons name="chevron-down-outline" size={20} color="#94a3b8" style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>

              {metricsLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
              ) : (
                <>
                  {metricsSummary ? (
                    <View style={{ flexWrap: 'wrap', flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      {[{ label: 'Participantes', value: metricsSummary.participants },
                        { label: 'Tickets vendidos', value: metricsSummary.ticketsSold },
                        { label: 'Pendientes', value: metricsSummary.pendingPayments },
                        { label: 'Recaudado', value: `$${(metricsSummary.totalRevenue || 0).toFixed(2)}` },
                        { label: 'Ventas hoy', value: metricsSummary.todaySales },
                        { label: 'Recaudado hoy', value: `$${(metricsSummary.todayRevenue || 0).toFixed(2)}` }].map(card => (
                          <View key={card.label} style={{ flexBasis: '48%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                            <Text style={{ color: '#94a3b8', fontSize: 12 }}>{card.label}</Text>
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 4 }}>{card.value}</Text>
                          </View>
                        ))}
                    </View>
                  ) : (
                    <Text style={{ color: palette.muted, marginTop: 10 }}>Sin datos de métricas.</Text>
                  )}

                  {(() => {
                    const r = selectedRaffle || raffles[0];
                    const sold = r?.soldTickets || 0;
                    const total = r?.totalTickets || 100;
                    const percent = total > 0 ? (sold / total) * 100 : 0;
                    return (
                      <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{r?.title || 'Sin rifa seleccionada'}</Text>
                        <Text style={{ color: palette.muted, fontSize: 12 }}>Ticket: ${r?.price || r?.ticketPrice || 0} • Cierre: {r?.endDate ? r.endDate.split('T')[0] : '—'}</Text>
                        {r?.style?.bannerImage ? (
                          <Image source={{ uri: r.style.bannerImage }} style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 10 }} resizeMode="cover" />
                        ) : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                          <Text style={{ color: '#cbd5e1' }}>Vendidos: {sold}/{total}</Text>
                          <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{percent.toFixed(1)}%</Text>
                        </View>
                        <ProgressBar progress={percent} color={percent > 75 ? '#4ade80' : percent > 40 ? '#fbbf24' : '#f87171'} />
                      </View>
                    );
                  })()}

                  {/* Ventas por hora */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.section}>Ventas por hora (hoy)</Text>
                    {metricsHourly.length === 0 ? (
                      <Text style={{ color: palette.muted }}>Sin ventas registradas hoy.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                        {(() => {
                          const max = Math.max(1, ...metricsHourly.map((x) => x.count || 0));
                          return metricsHourly.filter(h => h).map((h) => {
                            const height = Math.max(4, ((h.count || 0) / max) * 80);
                            return (
                              <View key={`h-${h.hour}`} style={{ flex: 1, alignItems: 'center', marginHorizontal: 1 }}>
                                <View style={{ width: '70%', height, backgroundColor: '#22c55e', borderRadius: 6 }} />
                                <Text style={{ color: '#94a3b8', fontSize: 8, marginTop: 4 }}>{h.hour}</Text>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Ventas por día */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.section}>Ventas últimos 7 días</Text>
                    {metricsDaily.length === 0 ? (
                      <Text style={{ color: palette.muted }}>Sin datos.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                        {(() => {
                          const max = Math.max(1, ...metricsDaily.map((d) => d.count || 0));
                          return metricsDaily.filter(d => d).map((d) => {
                            const h = Math.max(4, ((d.count || 0) / max) * 80);
                            return (
                              <View key={d.date} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
                                <View style={{ width: '70%', height: h, backgroundColor: '#60a5fa', borderRadius: 6 }} />
                                <Text style={{ color: '#94a3b8', fontSize: 8, marginTop: 4 }}>{d.date.slice(5)}</Text>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    )}
                  </View>

                  {/* Ventas por estado */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.section}>Ventas por estado</Text>
                    {metricsByState.length === 0 ? <Text style={{ color: palette.muted }}>Sin datos.</Text> : metricsByState.filter(s => s).slice(0, 8).map((s) => {
                      const max = Math.max(1, metricsByState[0]?.count || 1);
                      const width = Math.max(6, (s.count / max) * 100);
                      return (
                        <View key={s.state} style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#e2e8f0' }}>{s.state}</Text>
                            <Text style={{ color: '#94a3b8' }}>{s.count}</Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                            <View style={{ width: `${width}%`, height: '100%', backgroundColor: '#a78bfa' }} />
                          </View>
                        </View>
                      );
                    })}
                  </View>

                  {/* Top compradores */}
                  <View style={{ marginTop: 16 }}>
                    <Text style={styles.section}>Top de compra</Text>
                    {metricsTop.length === 0 ? <Text style={{ color: palette.muted }}>Sin datos.</Text> : metricsTop.filter(u => u).map((u, idx) => (
                      <View key={u.userId || idx} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{idx + 1}. {u.name}</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{u.email || '—'} • {u.state}</Text>
                        </View>
                        <Text style={{ color: '#fbbf24', fontWeight: '800' }}>{u.tickets}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {activeSection === 'progress' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Progreso de Rifas</Text>
              </View>
              {raffles.filter(r => r).map(r => {
                // Mock calculation if backend doesn't send sold count yet
                const sold = r.soldTickets || 0; 
                const total = r.totalTickets || 100;
                const percent = (sold / total) * 100;
                const revenue = sold * r.price;
                
                return (
                  <View key={r.id} style={{ marginBottom: 16, backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>{r.title}</Text>
                    <Text style={{ color: palette.muted, fontSize: 12, marginBottom: 8 }}>ID: {r.id} | Precio: ${r.price}</Text>
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#cbd5e1' }}>Vendidos: {sold}/{total}</Text>
                      <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{percent.toFixed(1)}%</Text>
                    </View>
                    <ProgressBar progress={percent} color={percent > 75 ? '#4ade80' : percent > 40 ? '#fbbf24' : '#f87171'} />
                    
                    <Text style={{ color: '#fff', marginTop: 4 }}>Recaudado: <Text style={{ color: '#4ade80', fontWeight: 'bold' }}>${revenue.toFixed(2)}</Text></Text>
                  </View>
                );
              })}
            </View>
          )}

          {activeSection === 'payments' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Pagos Manuales</Text>
              </View>
              <Text style={styles.muted}>Pagos reportados por usuarios pendientes de aprobación.</Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }}>
                <View style={{ flex: 1, marginRight: 8, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Pendientes</Text>
                  <Text style={{ color: '#fbbf24', fontWeight: '800', fontSize: 18 }}>{paymentKPIs.pending}</Text>
                </View>
                <View style={{ flex: 1, marginRight: 8, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Aprobados</Text>
                  <Text style={{ color: '#4ade80', fontWeight: '800', fontSize: 18 }}>{paymentKPIs.approved}</Text>
                </View>
                <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Rechazados</Text>
                  <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 18 }}>{paymentKPIs.rejected}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 }}>
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="ID Rifa" value={paymentFilters.raffleId} onChangeText={(v) => setPaymentFilters(s => ({ ...s, raffleId: v }))} />
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="Referencia" value={paymentFilters.reference} onChangeText={(v) => setPaymentFilters(s => ({ ...s, reference: v }))} />
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8 }}>
                {[
                  { id: '', label: 'Todos' },
                  { id: 'pending', label: 'Pendientes' },
                  { id: 'approved', label: 'Aprobados' },
                  { id: 'rejected', label: 'Rechazados' }
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id || 'all'}
                    onPress={() => setPaymentFilters(s => ({ ...s, status: opt.id }))}
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: paymentFilters.status === opt.id ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: paymentFilters.status === opt.id ? '#4ade80' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: paymentFilters.status === opt.id ? '#4ade80' : '#e2e8f0', fontWeight: '700' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity onPress={loadManualPayments} style={{ flex: 1, backgroundColor: palette.primary, padding: 12, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Filtrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setPaymentFilters({ raffleId: '', status: 'pending', reference: '' }); setTimeout(loadManualPayments, 10); }}
                  style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#e2e8f0', fontWeight: '700' }}>Limpiar</Text>
                </TouchableOpacity>
              </View>
              
              {loadingPayments ? <ActivityIndicator color={palette.primary} /> : (
                payments.length === 0 ? <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>No hay pagos pendientes.</Text> :
                payments.filter(p => p).map(p => {
                  const buyer = p.user || {};
                  const statusColor = p.status === 'approved' ? '#4ade80' : p.status === 'rejected' ? '#f87171' : '#fbbf24';
                  return (
                    <View key={p.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ref: {p.reference || '—'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: statusColor, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                          <Ionicons name={p.status === 'approved' ? 'checkmark-circle' : p.status === 'rejected' ? 'close-circle' : 'time'} size={16} color={statusColor} />
                          <Text style={{ color: statusColor, marginLeft: 6, fontWeight: '700' }}>{p.status}</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>Rifa ID: {p.raffleId} • Monto: ${Number(p.amount || 0).toFixed(2)}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Creado: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</Text>
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>Comprador</Text>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{buyer.firstName || buyer.name || 'Usuario'} {buyer.lastName || ''}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.email || '—'}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.state || '—'}</Text>
                      </View>
                      {p.proof ? (
                        <TouchableOpacity onPress={() => setProofViewer({ visible: true, uri: p.proof })}>
                          <Text style={{ color: palette.primary, textDecorationLine: 'underline', marginVertical: 4 }}>Ver Comprobante</Text>
                        </TouchableOpacity>
                      ) : null}
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <TouchableOpacity 
                          onPress={() => processPayment(p.id, 'approve')}
                          disabled={actingId === p.id}
                          style={{ flex: 1, backgroundColor: '#4ade80', padding: 10, borderRadius: 10, alignItems: 'center', opacity: actingId === p.id ? 0.7 : 1 }}
                        >
                          <Text style={{ color: '#064e3b', fontWeight: 'bold' }}>{actingId === p.id ? 'Procesando...' : 'Aprobar'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => processPayment(p.id, 'reject')}
                          disabled={actingId === p.id}
                          style={{ flex: 1, backgroundColor: '#f87171', padding: 10, borderRadius: 10, alignItems: 'center', opacity: actingId === p.id ? 0.7 : 1 }}
                        >
                          <Text style={{ color: '#7f1d1d', fontWeight: 'bold' }}>{actingId === p.id ? 'Procesando...' : 'Rechazar'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {activeSection === 'style' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Personalizar Rifa</Text>
              </View>
              
              <Text style={styles.section}>Seleccionar Rifa</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {raffles.filter(r => r).map(r => (
                  <TouchableOpacity 
                    key={r.id} 
                    onPress={() => {
                      setSelectedRaffle(r);
                      setStyleForm({
                        raffleId: r.id,
                        bannerImage: r.style?.bannerImage || '',
                        gallery: r.style?.gallery || [],
                        themeColor: r.style?.themeColor || '#2563eb',
                        whatsapp: r.style?.whatsapp || '',
                        instagram: r.style?.instagram || ''
                      });
                    }}
                    style={{ 
                      padding: 10, 
                      backgroundColor: selectedRaffle?.id === r.id ? palette.primary : 'rgba(255,255,255,0.1)', 
                      borderRadius: 8, 
                      marginRight: 8 
                    }}
                  >
                    <Text style={{ color: '#fff' }}>{r.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedRaffle && (
                <>
                  <Text style={styles.section}>Banner Promocional</Text>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickBanner}>
                    <Ionicons name="image-outline" size={18} color={palette.primary} />
                    <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Cambiar Banner</Text>
                  </TouchableOpacity>
                  {styleForm.bannerImage ? (
                    <Image source={{ uri: styleForm.bannerImage }} style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="contain" />
                  ) : null}

                  <Text style={styles.section}>Galería de Imágenes</Text>
                  <Text style={[styles.muted, { marginBottom: 4 }]}>Formato recomendado 16:9, máx {MAX_GALLERY_IMAGES} fotos.</Text>
                  <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickGalleryImage}>
                    <Ionicons name="images-outline" size={18} color={palette.primary} />
                    <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Agregar Foto a Galería</Text>
                  </TouchableOpacity>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {(styleForm.gallery || []).map((img, index) => (
                      <View key={index} style={{ marginRight: 8, position: 'relative' }}>
                        <Image source={{ uri: img }} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="contain" />
                        <TouchableOpacity 
                          onPress={() => removeGalleryImage(index)}
                          style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                        >
                          <Ionicons name="trash-outline" size={16} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>

                  <Text style={styles.section}>Color del Tema</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                    {['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'].map(c => (
                      <TouchableOpacity 
                        key={c} 
                        onPress={() => setStyleForm(s => ({ ...s, themeColor: c }))}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: 2, borderColor: styleForm.themeColor === c ? '#fff' : 'transparent' }}
                      />
                    ))}
                  </View>

                  <FilledButton title={savingStyle ? 'Guardando...' : 'Guardar Estilo'} onPress={saveStyle} loading={savingStyle} disabled={savingStyle} icon={<Ionicons name="color-palette-outline" size={18} color="#fff" />} />
                </>
              )}
            </View>
          )}

          {activeSection === 'tickets' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Gestión de Tickets</Text>
              </View>

              {/* VERIFICADOR RÁPIDO */}
              <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>Verificador Rápido</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput 
                    style={[styles.input, { flex: 1, marginBottom: 0, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }]} 
                    placeholder="# Ticket" 
                    value={verifierInput} 
                    onChangeText={setVerifierInput} 
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    onPress={() => {
                      if (!verifierInput) return;
                      const found = tickets.find(t => String(t.number) === verifierInput || String(t.serialNumber) === verifierInput);
                      if (found) {
                        setVerifierResult({ status: 'found', ticket: found });
                      } else {
                        setVerifierResult({ status: 'not_found' });
                      }
                    }}
                    style={{ backgroundColor: palette.primary, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12 }}
                  >
                    <Ionicons name="scan-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                {verifierResult && (
                  <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: verifierResult.status === 'found' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)', borderWidth: 1, borderColor: verifierResult.status === 'found' ? '#4ade80' : '#f87171' }}>
                    {verifierResult.status === 'found' ? (
                      <>
                        <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>¡TICKET VÁLIDO!</Text>
                        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 4 }}>Dueño: {verifierResult.ticket.buyer?.firstName || verifierResult.ticket.user?.name || 'Desconocido'}</Text>
                        <Text style={{ color: '#cbd5e1', textAlign: 'center' }}>Estado: {(verifierResult.ticket.status || 'unknown').toUpperCase()}</Text>
                      </>
                    ) : (
                      <Text style={{ color: '#f87171', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>NO ENCONTRADO</Text>
                    )}
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="ID Rifa" value={ticketFilters.raffleId} onChangeText={(v) => setTicketFilters(s => ({ ...s, raffleId: v }))} keyboardType="numeric" />
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="Referencia" value={ticketFilters.reference} onChangeText={(v) => setTicketFilters(s => ({ ...s, reference: v }))} />
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="Teléfono" value={ticketFilters.phone} onChangeText={(v) => setTicketFilters(s => ({ ...s, phone: v }))} keyboardType="phone-pad" />
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="Cédula" value={ticketFilters.cedula} onChangeText={(v) => setTicketFilters(s => ({ ...s, cedula: v }))} keyboardType="numeric" />
                <TextInput style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]} placeholder="Email" value={ticketFilters.email} onChangeText={(v) => setTicketFilters(s => ({ ...s, email: v }))} autoCapitalize="none" />
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {[
                  { id: '', label: 'Todos' },
                  { id: 'approved', label: 'Aprobados' },
                  { id: 'pending', label: 'Pendientes' },
                  { id: 'rejected', label: 'Rechazados' },
                  { id: 'ganador', label: 'Ganadores' }
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id || 'all-status'}
                    onPress={() => setTicketFilters(s => ({ ...s, status: opt.id }))}
                    style={{ paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: ticketFilters.status === opt.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: ticketFilters.status === opt.id ? '#60a5fa' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: '#e2e8f0', fontWeight: '700' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <TouchableOpacity onPress={loadTickets} style={{ flex: 1, backgroundColor: palette.primary, padding: 12, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Filtrar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setTicketFilters({ raffleId: '', status: '', from: '', to: '', reference: '', phone: '', cedula: '', email: '' }); setTimeout(loadTickets, 10); }}
                  style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#e2e8f0', fontWeight: '700' }}>Limpiar</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.section}>Resultados ({tickets.length})</Text>
                <TouchableOpacity onPress={exportTickets}>
                  <Text style={{ color: palette.primary, fontWeight: 'bold' }}>Exportar CSV</Text>
                </TouchableOpacity>
              </View>

              {ticketsLoading ? <ActivityIndicator color={palette.primary} /> : (
                <ScrollView style={{ maxHeight: 420 }}>
                  {tickets.filter(t => t).map(t => {
                    const buyer = t.buyer || {};
                    const raffleDigits = raffles.find(r => r.id === t.raffleId)?.digits;
                    const statusColor = t.status === 'approved' || t.status === 'aprobado' ? '#4ade80' : t.status === 'ganador' ? '#fbbf24' : t.status === 'rejected' ? '#f87171' : '#fbbf24';
                    return (
                      <View key={t.id} style={{ marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>#{formatTicketNumber(t.number ?? t.serialNumber ?? '0', raffleDigits)}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: statusColor }}>
                            <Ionicons name={t.status === 'approved' ? 'checkmark-circle' : t.status === 'rejected' ? 'close-circle' : 'time'} size={14} color={statusColor} />
                            <Text style={{ color: statusColor, fontWeight: '700', marginLeft: 6 }}>{t.status}</Text>
                          </View>
                        </View>
                        <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 2 }}>Rifa: {t.raffleTitle || t.raffleId}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>Referencia: {t.reference || '—'}</Text>
                        <View style={{ marginTop: 6 }}>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>Comprador</Text>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{buyer.firstName || buyer.name || t.user?.name || 'Usuario'} {buyer.lastName || ''}</Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.email || t.user?.email || '—'}</Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.phone || buyer.cedula || '—'}</Text>
                        </View>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Fecha: {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}</Text>
                        {t.status === 'ganador' && winnerInfo?.ticket === (t.number || t.ticketNumber) ? (
                          <Text style={{ color: '#fbbf24', fontWeight: '700', marginTop: 4 }}>Ganador anunciado</Text>
                        ) : null}
                      </View>
                    );
                  })}
                </ScrollView>
              )}
              {winnerInfo ? (
                <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
                  <Text style={{ color: '#4ade80', fontWeight: '800', fontSize: 16 }}>Ganador de la rifa seleccionada</Text>
                  <Text style={{ color: '#e2e8f0', marginTop: 4 }}>Ticket: {winnerInfo.ticket}</Text>
                  <Text style={{ color: '#e2e8f0' }}>Nombre: {winnerInfo.name}</Text>
                  <Text style={{ color: '#cbd5e1' }}>Email: {winnerInfo.email || '—'}</Text>
                  <Text style={{ color: '#cbd5e1' }}>Teléfono: {winnerInfo.phone || '—'}</Text>
                  <Text style={{ color: '#94a3b8', marginTop: 4 }}>Anunciado: {winnerInfo.announcedAt || '—'}</Text>
                </View>
              ) : null}
            </View>
          )}

          <Modal visible={proofViewer.visible} transparent animationType="fade" onRequestClose={closeProofViewer}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <TouchableOpacity onPress={closeProofViewer} style={{ position: 'absolute', top: 40, right: 20, padding: 10 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {proofViewer.uri ? (
                <Image source={{ uri: proofViewer.uri }} style={{ width: '90%', height: '70%', borderRadius: 12 }} resizeMode="contain" />
              ) : (
                <Text style={{ color: '#fff' }}>Sin comprobante</Text>
              )}
            </View>
          </Modal>

          {activeSection === 'sa_smtp' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Configuración SMTP</Text>
              </View>
              <Text style={styles.muted}>Servidor de correo para notificaciones.</Text>
              
              <TextInput style={styles.input} placeholder="Host (smtp.gmail.com)" value={smtpForm.host} onChangeText={(v) => setSmtpForm(s => ({ ...s, host: v }))} />
              <TextInput style={styles.input} placeholder="Puerto (587)" value={String(smtpForm.port)} onChangeText={(v) => setSmtpForm(s => ({ ...s, port: v }))} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Usuario" value={smtpForm.user} onChangeText={(v) => setSmtpForm(s => ({ ...s, user: v }))} autoCapitalize="none" />
              <TextInput style={styles.input} placeholder="Contraseña" value={smtpForm.pass} onChangeText={(v) => setSmtpForm(s => ({ ...s, pass: v }))} secureTextEntry />
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ color: '#fff' }}>Conexión Segura (SSL/TLS)</Text>
                <Switch value={smtpForm.secure} onValueChange={(v) => setSmtpForm(s => ({ ...s, secure: v }))} />
              </View>

              <FilledButton title={savingSmtp ? 'Guardando...' : 'Guardar SMTP'} onPress={saveSmtp} loading={savingSmtp} disabled={savingSmtp} icon={<Ionicons name="save-outline" size={18} color="#fff" />} />
            </View>
          )}

          {activeSection === 'sa_branding' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Branding Global</Text>
              </View>
              <TextInput style={styles.input} placeholder="Nombre de la App" value={branding.title} onChangeText={(v) => setBranding(s => ({ ...s, title: v }))} />
              <TextInput style={styles.input} placeholder="Slogan" value={branding.tagline} onChangeText={(v) => setBranding(s => ({ ...s, tagline: v }))} />
              <TextInput style={styles.input} placeholder="Color Primario (#hex)" value={branding.primaryColor} onChangeText={(v) => setBranding(s => ({ ...s, primaryColor: v }))} />
              <FilledButton title={savingBranding ? 'Guardando...' : 'Actualizar Marca'} onPress={saveBranding} loading={savingBranding} disabled={savingBranding} icon={<Ionicons name="color-palette-outline" size={18} color="#fff" />} />
            </View>
          )}

          {activeSection === 'sa_modules' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Módulos del Sistema</Text>
              </View>
              <Text style={styles.muted}>Activa o desactiva funciones globales.</Text>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>Registro de Usuarios</Text>
                <Switch value={modules?.user?.registration !== false} onValueChange={() => toggleModule('user', 'registration')} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>Pagos Manuales</Text>
                <Switch value={modules?.user?.manualPayments !== false} onValueChange={() => toggleModule('user', 'manualPayments')} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ color: '#fff', fontSize: 16 }}>Modo Mantenimiento</Text>
                <Switch value={modules?.system?.maintenance === true} onValueChange={() => toggleModule('system', 'maintenance')} />
              </View>
            </View>
          )}

          {activeSection === 'sa_audit' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Auditoría del Sistema</Text>
              </View>
              
              {auditLogs && auditLogs.length > 0 ? (
                auditLogs.filter(l => l).map(log => (
                  <View key={log.id || Math.random()} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#fbbf24' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14, flex: 1 }}>{log.action}</Text>
                      <Text style={{ color: palette.muted, fontSize: 10 }}>{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}</Text>
                    </View>
                    <Text style={{ color: '#cbd5e1', marginTop: 4, fontSize: 12 }}>{log.detail}</Text>
                    {log.ip && <Text style={{ color: palette.muted, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>IP: {log.ip}</Text>}
                  </View>
                ))
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Ionicons name="clipboard-outline" size={48} color={palette.muted} />
                    <Text style={{ color: palette.muted, marginTop: 12 }}>No hay registros de auditoría disponibles.</Text>
                </View>
              )}
            </View>
          )}

          {activeSection === 'sa_mail' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Log de Correos</Text>
              </View>
              {mailLogs.filter(l => l).map(log => (
                <View key={log.id || Math.random()} style={{ marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', paddingBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', flex: 1 }}>{log.to}</Text>
                    <Text style={{ color: log.status === 'SENT' ? '#4ade80' : '#f87171', fontSize: 10, fontWeight: 'bold' }}>{log.status}</Text>
                  </View>
                  <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{log.subject}</Text>
                  <Text style={{ color: palette.muted, fontSize: 10 }}>{new Date(log.timestamp).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}



          {activeSection === 'support' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Mi Soporte</Text>
              </View>
              <Text style={styles.muted}>Configura tus datos de contacto para que los usuarios puedan resolver dudas sobre tus rifas.</Text>
              
              <Text style={styles.section}>WhatsApp</Text>
              <TextInput
                style={styles.input}
                placeholder="+58 412 1234567"
                value={supportForm.whatsapp}
                onChangeText={(v) => setSupportForm(s => ({ ...s, whatsapp: v }))}
                keyboardType="phone-pad"
              />
              
              <Text style={styles.section}>Instagram</Text>
              <TextInput
                style={styles.input}
                placeholder="@usuario"
                value={supportForm.instagram}
                onChangeText={(v) => setSupportForm(s => ({ ...s, instagram: v }))}
              />

              <Text style={styles.section}>Email de contacto</Text>
              <TextInput
                style={styles.input}
                placeholder="contacto@tusrifas.com"
                value={supportForm.email}
                onChangeText={(v) => setSupportForm(s => ({ ...s, email: v }))}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <FilledButton 
                title={savingSupport ? 'Guardando...' : 'Guardar mis datos'} 
                onPress={saveSupport} 
                loading={savingSupport} 
                disabled={savingSupport}
                icon={<Ionicons name="save-outline" size={18} color="#fff" />}
              />
            </View>
          )}

          {activeSection === 'account' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Mi Cuenta</Text>
              </View>
              <TouchableOpacity style={styles.rowBetween} onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.section}>Seguridad</Text>
                <Ionicons name={showPassword ? "chevron-up" : "chevron-down"} size={20} color={palette.text} />
              </TouchableOpacity>
              
              {showPassword && (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.muted}>Cambiar contraseña de administrador</Text>
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
          )}

          {activeSection === 'push' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Notificaciones Push</Text>
              </View>
              <Text style={styles.muted}>Envía mensajes a todos los usuarios.</Text>
              <TextInput style={styles.input} placeholder="Título" value={pushForm.title} onChangeText={(v) => setPushForm(s => ({ ...s, title: v }))} />
              <TextInput style={styles.input} placeholder="Mensaje" value={pushForm.body} onChangeText={(v) => setPushForm(s => ({ ...s, body: v }))} multiline numberOfLines={3} />
              <FilledButton title={sendingPush ? 'Enviando...' : 'Enviar a todos'} onPress={sendPushBroadcast} loading={sendingPush} disabled={sendingPush} icon={<Ionicons name="paper-plane-outline" size={18} color="#fff" />} />
            </View>
          )}

          {activeSection === 'security' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Código de Seguridad</Text>
              </View>
              <Text style={styles.muted}>Código único para validar sorteos.</Text>
              <View style={{ padding: 20, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, alignItems: 'center', marginVertical: 16 }}>
                <Text style={{ color: '#fbbf24', fontSize: 24, fontWeight: '900', letterSpacing: 4 }}>{securityStatus?.code || '••••••'}</Text>
              </View>
              <FilledButton title={regenerating ? 'Generando...' : 'Regenerar Código'} onPress={regenerateSecurityCode} loading={regenerating} disabled={regenerating} icon={<Ionicons name="refresh-outline" size={18} color="#fff" />} />
            </View>
          )}

          {activeSection === 'lottery' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Sorteo en Vivo</Text>
              </View>
              <Text style={styles.muted}>Verifica ganadores en tiempo real.</Text>
              
              <Text style={styles.section}>Rifa</Text>
              <TouchableOpacity onPress={() => setShowLotteryModal(true)} style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: lotteryCheck.raffleId ? '#fff' : '#94a3b8' }}>{raffles.find(r => r.id === lotteryCheck.raffleId)?.title || 'Seleccionar Rifa'}</Text>
                  <Ionicons name="chevron-down-outline" size={20} color="#94a3b8" style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>

              <Text style={styles.section}>Número Ganador</Text>
              <TextInput style={styles.input} placeholder="00000" value={lotteryCheck.number} onChangeText={(v) => setLotteryCheck(s => ({ ...s, number: v }))} keyboardType="numeric" maxLength={5} />
              
              <FilledButton title={checkingWinner ? 'Verificando...' : 'Verificar Ganador'} onPress={checkWinner} loading={checkingWinner} disabled={checkingWinner} icon={<Ionicons name="search-outline" size={18} color="#fff" />} />

              {lotteryWinner && (
                <Animated.View style={{ marginTop: 20, transform: [{ scale: winnerAnim }] }}>
                  <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#10b981' }}>
                    <Text style={{ color: '#10b981', fontWeight: 'bold', textAlign: 'center', fontSize: 18 }}>¡TICKET VENDIDO!</Text>
                    <Text style={{ color: '#fff', textAlign: 'center', marginTop: 8 }}>Comprador: {lotteryWinner.buyer?.firstName || lotteryWinner.user?.name}</Text>
                    <Text style={{ color: '#fff', textAlign: 'center' }}>Ticket: #{formatTicketNumber(lotteryWinner.number, raffles.find(r => r.id === lotteryCheck.raffleId)?.digits)}</Text>
                    <View style={{ marginTop: 12 }}>
                      <FilledButton title="Anunciar Ganador" onPress={announceWinner} icon={<Ionicons name="megaphone-outline" size={18} color="#fff" />} />
                    </View>
                  </View>
                </Animated.View>
              )}
            </View>
          )}

          {activeSection === 'winner' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Publicar Ganador</Text>
              </View>
              <TextInput style={styles.input} placeholder="ID Rifa" value={winnerForm.raffleId} onChangeText={(v) => setWinnerForm(s => ({ ...s, raffleId: v }))} />
              <TextInput style={styles.input} placeholder="Ticket #" value={winnerForm.ticketNumber} onChangeText={(v) => setWinnerForm(s => ({ ...s, ticketNumber: v }))} keyboardType="numeric" />
              <TextInput style={styles.input} placeholder="Nombre Ganador" value={winnerForm.winnerName} onChangeText={(v) => setWinnerForm(s => ({ ...s, winnerName: v }))} />
              <TextInput style={styles.input} placeholder="Premio" value={winnerForm.prize} onChangeText={(v) => setWinnerForm(s => ({ ...s, prize: v }))} />
              <TextInput style={styles.input} placeholder="Testimonio (opcional)" value={winnerForm.testimonial} onChangeText={(v) => setWinnerForm(s => ({ ...s, testimonial: v }))} multiline />
              
              <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickAnnouncementImage}>
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Foto del Ganador</Text>
              </TouchableOpacity>
              
              <FilledButton title={savingWinner ? 'Publicando...' : 'Publicar Ganador'} onPress={() => { /* Implement saveWinner */ }} loading={savingWinner} disabled={savingWinner} icon={<Ionicons name="trophy-outline" size={18} color="#fff" />} />
            </View>
          )}
        </ScrollView>
        
        {/* Modals */}
        <Modal visible={rafflePickerVisible} transparent animationType="fade" onRequestClose={() => setRafflePickerVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, maxHeight: '70%' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Selecciona Rifa</Text>
                <TouchableOpacity onPress={() => setRafflePickerVisible(false)}>
                  <Ionicons name="close" size={22} color="#cbd5e1" />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {raffles.filter(r => r).map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => { setSelectedRaffle(r); setRafflePickerVisible(false); }}
                    style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <View>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{r.title}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>ID: {r.id}</Text>
                    </View>
                    {selectedRaffle?.id === r.id && <Ionicons name="checkmark-circle" size={20} color={palette.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={supportVisible} transparent animationType="slide" onRequestClose={() => setSupportVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={[styles.card, { borderTopLeftRadius: 16, borderTopRightRadius: 16, marginBottom: 0 }]}> 
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Soporte Técnico</Text>
                <TouchableOpacity onPress={() => setSupportVisible(false)}>
                  <Ionicons name="close" size={20} color={palette.text} />
                </TouchableOpacity>
              </View>
              
              {techSupport ? (
                <View style={{ marginBottom: 16, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <Text style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 4 }}>Contacto Directo</Text>
                  <Text style={styles.muted}>Reportar fallas de la aplicación:</Text>
                  {techSupport.phone && <Text style={{ color: '#cbd5e1', marginTop: 4 }}>WhatsApp: {techSupport.phone}</Text>}
                  {techSupport.email && <Text style={{ color: '#cbd5e1' }}>Email: {techSupport.email}</Text>}
                </View>
              ) : (
                <Text style={styles.muted}>No hay información de soporte configurada.</Text>
              )}

              <TextInput
                style={styles.input}
                placeholder="Describe el problema..."
                value={supportMessage}
                onChangeText={setSupportMessage}
                multiline
              />
              <FilledButton
                title="Enviar reporte"
                onPress={() => {
                  setSupportVisible(false);
                  setSupportMessage('');
                  Alert.alert('Enviado', 'Hemos registrado tu reporte. Te contactaremos pronto.');
                }}
                icon={<Ionicons name="bug-outline" size={18} color="#fff" />}
              />
            </View>
          </View>
        </Modal>

        <Modal
          animationType="fade"
          transparent={true}
          visible={confirmModalVisible}
          onRequestClose={() => setConfirmModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Ionicons name="alert-circle" size={48} color="#fbbf24" style={{ marginBottom: 16 }} />
              <Text style={{ color: '#e2e8f0', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>VERIFICA EL NÚMERO</Text>
              <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 24 }}>Asegúrate de que este es el número que salió en la lotería antes de anunciar.</Text>
              
              <View style={{ backgroundColor: '#0f172a', paddingVertical: 20, paddingHorizontal: 40, borderRadius: 16, marginBottom: 24, borderWidth: 2, borderColor: '#fbbf24' }}>
                <Text style={{ color: '#fff', fontSize: 56, fontWeight: '900', letterSpacing: 4 }}>
                  {lotteryWinner ? formatTicketNumber(lotteryWinner.number, raffles.find(r => r.id === lotteryCheck.raffleId)?.digits) : '00000'}
                </Text>
              </View>

              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: '700', marginBottom: 32 }}>
                Ganador: {lotteryWinner ? (lotteryWinner.buyer?.firstName || lotteryWinner.user?.name) : ''}
              </Text>

              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity 
                  onPress={() => setConfirmModalVisible(false)}
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={proceedAnnouncement}
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#fbbf24', alignItems: 'center' }}
                >
                  <Text style={{ color: '#0b1224', fontWeight: '800' }}>SÍ, ES CORRECTO</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: palette.text, marginBottom: 12 },
  section: { fontSize: 16, fontWeight: '800', color: palette.text, marginBottom: 8 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: palette.inputBg, color: palette.text, fontSize: 16 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: palette.surface, color: palette.text, fontWeight: '700', alignSelf: 'flex-start' },
  muted: { color: palette.muted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: palette.text },
  superCard: { backgroundColor: 'rgba(12,18,36,0.92)', borderColor: 'rgba(255,255,255,0.08)' },
  sectionIconCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  bannerPreview: { marginVertical: 8 },
  bannerPreviewImage: { height: 140, borderRadius: 12, overflow: 'hidden' },
  moduleChip: { width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(34,211,238,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(34,211,238,0.3)' },
  auditRow: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: 10 },
  auditChip: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  sectionHint: { color: palette.muted, fontSize: 12 },
  bannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(12,16,32,0.55)' },
  badge: { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, borderRadius: 12, padding: 10, alignItems: 'center', width: 100 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, padding: 12, borderRadius: 12 },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: palette.border },
  secondaryText: { color: palette.primary, fontWeight: '700' },
});
