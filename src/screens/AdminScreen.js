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
  Linking,
  ToastAndroid,
  StyleSheet,
  Switch,
  Animated,
  Dimensions,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { palette } from '../theme';
import { FilledButton, OutlineButton } from '../components/UI';
import { ENV } from '../config/env';
import { formatMoneyVES } from '../utils';

const formatTicketNumber = (value, digits = 4) => String(value ?? '').padStart(digits, '0');

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const splitCsv = (value) => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const normalizePaymentMethods = (value) => {
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  if (typeof value === 'string') return splitCsv(value);
  return [];
};

const normalizeRemoteUri = (uri) => {
  const raw = typeof uri === 'string' ? uri.trim() : String(uri || '').trim();
  if (!raw) return '';

  if (/^(https?:|file:|content:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;

  const base = String(ENV?.apiUrl || '').replace(/\/+$/, '');
  if (!base) return raw;
  if (raw.startsWith('/')) return `${base}${raw}`;
  return `${base}/${raw}`;
};

const formatTxTypeLabel = (rawType) => {
  const t = String(rawType || '').trim().toLowerCase();
  if (!t) return 'Movimiento';
  if (t === 'manual_payment') return 'Pago manual';
  if (t === 'deposit') return 'Depósito';
  if (t === 'withdrawal') return 'Retiro';
  if (t === 'purchase') return 'Compra';
  if (t === 'refund') return 'Reembolso';
  return t.replace(/_/g, ' ');
};

const isSuperadminRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'superadmin' || normalized === 'super_admin' || normalized === 'super-admin';
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  if (typeof value === 'number') return value === 1;
  return false;
};

const normalizeSmtpFromServer = (smtp) => {
  const safe = smtp && typeof smtp === 'object' ? smtp : {};
  const portNumber = Number(safe.port);
  return {
    host: typeof safe.host === 'string' ? safe.host : '',
    port: Number.isFinite(portNumber) && portNumber > 0 ? String(portNumber) : '587',
    user: typeof safe.user === 'string' ? safe.user : '',
    pass: typeof safe.pass === 'string' ? safe.pass : '',
    secure: normalizeBoolean(safe.secure),
    fromName: typeof safe.fromName === 'string' ? safe.fromName : '',
    fromEmail: typeof safe.fromEmail === 'string' ? safe.fromEmail : ''
  };
};

const normalizeRaffle = (raffle) => {
  const safe = raffle && typeof raffle === 'object' ? raffle : null;
  if (!safe) return null;

  const instantWins = Array.isArray(safe.instantWins)
    ? safe.instantWins
    : typeof safe.instantWins === 'string'
      ? splitCsv(safe.instantWins)
      : [];

  const paymentMethods = Array.isArray(safe.paymentMethods)
    ? safe.paymentMethods
    : typeof safe.paymentMethods === 'string'
      ? splitCsv(safe.paymentMethods)
      : [];

  const styleSafe = safe.style && typeof safe.style === 'object' ? safe.style : {};
  const style = {
    ...styleSafe,
    gallery: ensureArray(styleSafe.gallery)
  };

  return {
    ...safe,
    instantWins,
    paymentMethods,
    style
  };
};

const formatInstantWinsForInput = (instantWins) => {
  if (Array.isArray(instantWins)) return instantWins.join(', ');
  if (typeof instantWins === 'string') return instantWins;
  return '';
};

const ProgressBar = ({ progress, color }) => (
  <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, marginVertical: 8, overflow: 'hidden' }}>
    <View style={{ width: `${Math.min(Math.max(progress, 0), 100)}%`, height: '100%', backgroundColor: color, borderRadius: 3 }} />
  </View>
);

const CollapsibleCard = ({ title, rightText, expanded, onToggle, children }) => (
  <View style={{ marginTop: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
    <TouchableOpacity
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 }}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{title}</Text>
        {!!rightText && <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{rightText}</Text>}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{expanded ? 'Ocultar' : 'Ver'}</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={'#94a3b8'} />
      </View>
    </TouchableOpacity>
    {expanded ? <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>{children}</View> : null}
  </View>
);

const STANDARD_ASPECT = [16, 9];
const MAX_GALLERY_IMAGES = 5;

class AdminScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // In release builds the stack is limited; keep a small hint for debugging.
    console.error('AdminScreen render error:', error);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const errorMessage =
        this.state?.error?.message ||
        (typeof this.state?.error === 'string' ? this.state.error : '') ||
        String(this.state?.error || '');

      const componentStack = this.state?.errorInfo?.componentStack
        ? String(this.state.errorInfo.componentStack).trim()
        : '';

      const errorStack = this.state?.error?.stack
        ? String(this.state.error.stack).trim()
        : '';

      return (
        <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
            Ocurrió un error al cargar esta pantalla
          </Text>
          <Text style={{ color: '#94a3b8', marginTop: 10, textAlign: 'center' }}>
            Si el problema persiste, vuelve al menú e inténtalo nuevamente.
          </Text>

          {(errorMessage || componentStack || errorStack) ? (
            <ScrollView style={{ marginTop: 14, maxHeight: 260 }}>
              {!!errorMessage && (
                <Text selectable style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 16 }}>
                  Detalle: {errorMessage}
                </Text>
              )}
              {!!errorStack && (
                <Text selectable style={{ color: '#94a3b8', marginTop: 10, fontSize: 11, lineHeight: 14 }}>
                  Stack: {errorStack}
                </Text>
              )}
              {!!componentStack && (
                <Text selectable style={{ color: '#64748b', marginTop: 10, fontSize: 11, lineHeight: 14 }}>
                  {componentStack}
                </Text>
              )}
            </ScrollView>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    console.error('AdminScreen section error:', this.props?.label, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const message = this.state?.error?.message ? String(this.state.error.message) : String(this.state.error || '');
    return (
      <View style={{ padding: 12, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Error en sección</Text>
        <Text style={{ color: '#e2e8f0', marginTop: 6 }}>{String(this.props?.label || '')}</Text>
        <Text selectable style={{ color: '#cbd5e1', marginTop: 10, fontSize: 11, lineHeight: 14 }}>Detalle: {message}</Text>
      </View>
    );
  }
}

const normalizeImage = async (
  asset,
  {
    maxWidth = 1024,
    compress = 0.7,
    maxChars = 600_000,
    minCompress = 0.35,
    maxIterations = 4
  } = {}
) => {
  const uri = asset?.uri;
  if (!uri) return null;

  const baseWidth = Number(asset?.width) || maxWidth;
  let currentWidth = Math.min(maxWidth, baseWidth);
  let currentCompress = compress;
  let lastDataUrl = null;

  for (let i = 0; i < maxIterations; i += 1) {
    const width = Math.max(320, Math.round(currentWidth));
    const jpegCompress = Math.max(minCompress, currentCompress);

    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width } }],
      { compress: jpegCompress, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipResult?.base64) return null;
    const dataUrl = `data:image/jpeg;base64,${manipResult.base64}`;
    lastDataUrl = dataUrl;

    // En JSON, el tamaño real del request crece con la longitud del string.
    if (dataUrl.length <= maxChars) return dataUrl;

    // Reducir progresivamente hasta entrar en el límite.
    currentWidth = Math.max(320, currentWidth * 0.82);
    currentCompress = Math.max(minCompress, currentCompress - 0.15);
  }

  return lastDataUrl;
};

export default function AdminScreen({ api, user, modulesConfig, onLogout }) {
  const route = useRoute();
  const navigation = useNavigation();
  const lastEditHandledRef = useRef(null);
  const bannerAssetRef = useRef(null);
  const galleryAssetsRef = useRef([]);
  const [activeSection, setActiveSection] = useState(null);
  const isSuperadmin = isSuperadminRole(user?.role);

  const normalizeDigits = useCallback((value) => String(value || '').replace(/\D/g, ''), []);
  const normalizeLooseText = useCallback(
    (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' '),
    []
  );
  
  // Reports System
  const [legacyReports, setLegacyReports] = useState([]);
  const [legacyReportsLoading, setLegacyReportsLoading] = useState(false);

  const loadLegacyReports = useCallback(async () => {
    setLegacyReportsLoading(true);
    try {
      const { res, data } = await api('/superadmin/reports?status=open');
      if (res.ok) {
        setLegacyReports(data);
      }
    } catch (err) {
      console.log('Error loading reports', err);
    }
    setLegacyReportsLoading(false);
  }, [api]);

  const resolveLegacyReport = async (reportId, action) => {
    // action: 'resolved' | 'dismissed'
    const { res, data } = await api(`/superadmin/reports/${reportId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: action })
    });
    if (res.ok) {
      Alert.alert('Éxito', `Reporte ${action === 'resolved' ? 'resuelto' : 'desestimado'}.`);
      loadLegacyReports();
    } else {
      Alert.alert('Error', data.error || 'No se pudo actualizar el reporte.');
    }
  };

  const quickNotify = useCallback((message) => {
    const text = String(message || '').trim();
    if (!text) return;
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(text, ToastAndroid.SHORT);
        return;
      } catch (_e) {
        // fallback below
      }
    }
    Alert.alert('Info', text);
  }, []);

  const uploadImageAsset = useCallback(
    async (asset) => {
      if (!asset?.uri) return null;
      const form = new FormData();

      const rawType = asset?.mimeType || asset?.type;
      const type = typeof rawType === 'string' && rawType.includes('/') ? rawType : 'image/jpeg';
      const name =
        (typeof asset?.fileName === 'string' && asset.fileName) ||
        (typeof asset?.filename === 'string' && asset.filename) ||
        `image_${Date.now()}.jpg`;

      form.append('file', { uri: asset.uri, name, type });

      const { res, data } = await api('/admin/uploads/image', {
        method: 'POST',
        body: form
      });

      if (!res.ok) throw new Error(data?.error || 'No se pudo subir/procesar la imagen.');
      return data?.dataUrl || null;
    },
    [api]
  );

  // Handle navigation params for editing
  useFocusEffect(
    useCallback(() => {
      const action = route.params?.action;
      const raffleData = route.params?.raffleData;
      const raffleId = raffleData?.id || null;

      if (action === 'editRaffle' && raffleData && raffleId && lastEditHandledRef.current !== raffleId) {
        lastEditHandledRef.current = raffleId;
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
          instantWins: formatInstantWinsForInput(r.instantWins),
          terms: r.terms || '',
          securityCode: r.securityCode || ''
        });

        // Clear params to avoid re-triggering (route.params es read-only)
        try {
          navigation.setParams({ action: undefined, raffleData: undefined });
        } catch (_err) {
          // Si el navigator no soporta setParams aquí, al menos no crashear.
        }
      }
    }, [route.params?.action, route.params?.raffleData, navigation])
  );

  // Superadmin State
  const [branding, setBranding] = useState({ title: '', tagline: '', primaryColor: '', secondaryColor: '', logoUrl: '', bannerUrl: '', policies: '' });
  const [modules, setModules] = useState(null);
  const [users, setUsers] = useState([]);
  const [savingBranding, setSavingBranding] = useState(false);
  const [loadingSuper, setLoadingSuper] = useState(false);
  const [mailLogs, setMailLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [actingReportId, setActingReportId] = useState(null);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'user', firstName: '', lastName: '', active: true });
  const [creating, setCreating] = useState(false);

  const loadReports = useCallback(async () => {
    if (!isSuperadmin) return;
    setReportsLoading(true);
    try {
      const { res, data } = await api('/superadmin/reports?status=open');
      if (res.ok && Array.isArray(data)) setReports(data);
      else setReports([]);
    } catch (e) {
      setReports([]);
      Alert.alert('Error', e?.message || 'No se pudieron cargar los reportes.');
    } finally {
      setReportsLoading(false);
    }
  }, [api, isSuperadmin]);

  const loadAuditLogs = useCallback(async () => {
    if (!isSuperadmin) return;
    try {
      const { res, data } = await api('/superadmin/audit/actions');
      if (res.ok && Array.isArray(data)) setAuditLogs(data);
    } catch (_e) {
      // Silenciar
    }
  }, [api, isSuperadmin]);

  const loadMailLogs = useCallback(async () => {
    if (!isSuperadmin) return;
    try {
      const { res, data } = await api('/superadmin/mail/logs');
      if (res.ok && Array.isArray(data)) setMailLogs(data);
    } catch (_e) {
      // Silenciar
    }
  }, [api, isSuperadmin]);

  const setReportStatus = useCallback(async (reportId, status) => {
    if (!reportId) return;
    if (!isSuperadmin) return;
    setActingReportId(reportId);
    try {
      const { res, data } = await api(`/superadmin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (res.ok) {
        quickNotify('Actualizado');
        loadReports();
      } else {
        Alert.alert('Error', data?.error || 'No se pudo actualizar el reporte.');
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo actualizar el reporte.');
    } finally {
      setActingReportId(null);
    }
  }, [api, isSuperadmin, loadReports, quickNotify]);

  useEffect(() => {
    if (!isSuperadmin) return;
    if (!activeSection) return;

    const section = String(activeSection);
    const shouldPoll = section === 'sa_reports' || section === 'sa_audit' || section === 'sa_mail';
    if (!shouldPoll) return;

    const intervalMs = section === 'sa_reports' ? 15_000 : 20_000;
    const tick = () => {
      if (section === 'sa_reports') loadReports();
      if (section === 'sa_audit') loadAuditLogs();
      if (section === 'sa_mail') loadMailLogs();
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [activeSection, isSuperadmin, loadReports, loadAuditLogs, loadMailLogs]);
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

  const [dashboardPanels, setDashboardPanels] = useState({
    summary: false,
    raffle: false,
    hourly: false,
    daily: false,
    byState: false,
    top: false
  });

  const [userSearch, setUserSearch] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null); // For modal actions
  const [viewUser, setViewUser] = useState(null); // Para ver detalle de usuario (Hoja de Vida)

  const [planConfigForm, setPlanConfigForm] = useState({ unlimitedWeeklyRaffleLimit: '3' });
  const [savingPlanConfig, setSavingPlanConfig] = useState(false);
  const [userPlanForm, setUserPlanForm] = useState({ tier: 'starter', raffleCreditsRemaining: '', boostCreditsRemaining: '' });
  const [savingUserPlan, setSavingUserPlan] = useState(false);

  const [raffleTab, setRaffleTab] = useState('details'); // 'details' | 'payments'
  const [paymentMethods, setPaymentMethods] = useState([]); // Lista de métodos de pago multimoneda

  const MENU_ITEMS = useMemo(() => {
    const items = [
      { id: 'account', title: 'Perfil', icon: 'person-circle-outline', color: palette.primary },
      { id: 'support', title: 'Mi Soporte', icon: 'headset-outline', color: '#f87171' },
      { id: 'push', title: 'Notificaciones', icon: 'notifications-outline', color: '#f472b6' },
      { id: 'security', title: 'Cód. Seguridad', icon: 'shield-checkmark-outline', color: '#34d399' },
      { id: 'lottery', title: 'Sorteo en Vivo', icon: 'dice-outline', color: '#f87171' },
      { id: 'raffles', title: 'Gestión de Rifas', icon: 'create-outline', color: '#a78bfa' },
      { id: 'dashboard', title: 'Dashboard', icon: 'speedometer-outline', color: '#22c55e' },
      { id: 'payments', title: 'Validar Pagos', icon: 'cash-outline', color: '#10b981' },
      { id: 'movements', title: 'Movimientos', icon: 'swap-vertical-outline', color: palette.accent },
      { id: 'tickets', title: 'Verificador', icon: 'qr-code-outline', color: '#f97316' },
      { id: 'news', title: 'Novedades', icon: 'newspaper-outline', color: '#60a5fa' },
    ];
    
    if (isSuperadmin) {
      // Superadmin siempre ve los bloques críticos aunque el backend no mande config
      items.push({ id: 'sa_users', title: 'Usuarios', icon: 'people-outline', color: '#22d3ee', requiresSuperadmin: true });
      items.push({ id: 'sa_tech_support', title: 'Soporte Técnico', icon: 'call-outline', color: '#38bdf8', requiresSuperadmin: true });
      items.push({ id: 'sa_smtp', title: 'Correo SMTP', icon: 'mail-outline', color: '#facc15', requiresSuperadmin: true });
      if (!modulesConfig || modulesConfig?.superadmin?.audit !== false) {
        items.push({ id: 'sa_audit', title: 'Auditoría', icon: 'receipt-outline', color: '#facc15' });
      }
      if (!modulesConfig || modulesConfig?.superadmin?.branding !== false) {
        items.push({ id: 'sa_branding', title: 'Branding', icon: 'color-palette-outline', color: '#c084fc' });
      }
      if (!modulesConfig || modulesConfig?.superadmin?.modules !== false) {
        items.push({ id: 'sa_modules', title: 'Módulos', icon: 'layers-outline', color: '#4ade80' });
      }
      items.push({ id: 'sa_mail', title: 'Logs de Correo', icon: 'mail-open-outline', color: '#f472b6', requiresSuperadmin: true });
      items.push({ id: 'sa_reports', title: 'Denuncias y reportes', icon: 'flag-outline', color: '#fb7185', requiresSuperadmin: true });
      // items.push({ id: 'sa_actions', title: 'Acciones Críticas', icon: 'alert-circle-outline', color: '#ef4444', requiresSuperadmin: true }); // ELIMINADO (Fusionado con Auditoría)
    }
    
    return items;
  }, [isSuperadmin, modulesConfig]);

  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [paymentFilters, setPaymentFilters] = useState({ raffleId: '', status: 'pending', reference: '' });
  const [proofViewer, setProofViewer] = useState({ visible: false, uri: '' });
  const [proofImageLoading, setProofImageLoading] = useState(false);
  const [proofImageError, setProofImageError] = useState(false);

  const [adminTransactions, setAdminTransactions] = useState([]);
  const [adminTxLoading, setAdminTxLoading] = useState(false);
  const [adminTxFilters, setAdminTxFilters] = useState({ status: '', q: '' });
  const [styleForm, setStyleForm] = useState({ raffleId: null, bannerImage: '', gallery: [], themeColor: '#2563eb', terms: '', whatsapp: '', instagram: '' });
  const [savingStyle, setSavingStyle] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [raffles, setRaffles] = useState([]);
  const [selectedRaffle, setSelectedRaffle] = useState(null);
  const [boostingRaffleId, setBoostingRaffleId] = useState(null);
  const [activatingRaffleId, setActivatingRaffleId] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [verifierInput, setVerifierInput] = useState('');
  const [verifierResult, setVerifierResult] = useState(null);
  const [verifierLoading, setVerifierLoading] = useState(false);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilters, setTicketFilters] = useState({ raffleId: '', status: '', from: '', to: '', number: '', serial: '' });
  const [rafflePickerVisible, setRafflePickerVisible] = useState(false);
  const [quickVerifierForm, setQuickVerifierForm] = useState({ cedula: '', firstName: '', lastName: '', phone: '', email: '' });
  const [raffleForm, setRaffleForm] = useState({ id: null, title: '', price: '', description: '', totalTickets: '', digits: 4, startDate: '', endDate: '', securityCode: '', lottery: '', instantWins: '', terms: '', minTickets: '', paymentMethods: ['mobile_payment'] });
  const [raffleErrors, setRaffleErrors] = useState({});
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [publishPreviewVisible, setPublishPreviewVisible] = useState(false);
  const [showLotteryModal, setShowLotteryModal] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);
  const [startDateValue, setStartDateValue] = useState(new Date());
  const [endDateValue, setEndDateValue] = useState(new Date());
  
  // Winner Declaration State
  const [winnerModalVisible, setWinnerModalVisible] = useState(false);
  const [winningNumberInput, setWinningNumberInput] = useState('');
  const [winnerRaffleId, setWinnerRaffleId] = useState(null);
  const [declaringWinner, setDeclaringWinner] = useState(false);

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
  }, [activeSection, selectedRaffle?.id]);

  const deleteAccount = useCallback(() => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible.',
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
                if (typeof onLogout === 'function') onLogout();
              } else {
                Alert.alert('Error', data?.error || 'No se pudo eliminar la cuenta.');
              }
            } catch (e) {
              Alert.alert('Error', e?.message || 'Error de conexión al eliminar la cuenta.');
            }
          }
        }
      ]
    );
  }, [api, onLogout]);

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

  const loadAdminTransactions = useCallback(async () => {
    setAdminTxLoading(true);
    try {
      const params = [];
      if (adminTxFilters.status) params.push(`status=${encodeURIComponent(adminTxFilters.status)}`);
      if (adminTxFilters.q) params.push(`q=${encodeURIComponent(adminTxFilters.q)}`);
      params.push('limit=200');

      const query = params.length ? `?${params.join('&')}` : '';
      const { res, data } = await api(`/admin/transactions${query}`);
      if (res.ok && Array.isArray(data)) setAdminTransactions(data);
      else setAdminTransactions([]);
    } catch (e) {
      setAdminTransactions([]);
      Alert.alert('Error', e?.message || 'No se pudieron cargar los movimientos.');
    }
    setAdminTxLoading(false);
  }, [api, adminTxFilters.q, adminTxFilters.status]);

  useEffect(() => {
    if (activeSection === 'movements') loadAdminTransactions();
  }, [activeSection, loadAdminTransactions]);

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
        const params = new URLSearchParams();
        params.append('raffleId', String(lotteryCheck.raffleId));
        params.append('number', String(lotteryCheck.number));
        params.append('take', '5');
        const { res, data } = await api(`/admin/tickets?${params.toString()}`);
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
    setWinnerRaffleId(lotteryCheck.raffleId);
    setWinningNumberInput(String(lotteryWinner.number));
    setWinnerPhoto(null);
    setWinnerModalVisible(true);
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

  const boostRaffle = useCallback((raffleId) => {
    if (!raffleId) return;

    Alert.alert(
      'Destacar rifa',
      'Elige la duración del boost.',
      [
        {
          text: '24 horas',
          onPress: async () => {
            setBoostingRaffleId(raffleId);
            const { res, data } = await api(`/admin/raffles/${raffleId}/boost`, {
              method: 'POST',
              body: JSON.stringify({ duration: '24h' })
            });
            setBoostingRaffleId(null);
            if (res.ok) {
              Alert.alert('Listo', data?.message || 'Rifa destacada.');
              loadProfile();
              loadRaffles();
            } else {
              Alert.alert('Error', data?.error || 'No se pudo destacar la rifa.');
            }
          }
        },
        {
          text: '7 días',
          onPress: async () => {
            setBoostingRaffleId(raffleId);
            const { res, data } = await api(`/admin/raffles/${raffleId}/boost`, {
              method: 'POST',
              body: JSON.stringify({ duration: '7d' })
            });
            setBoostingRaffleId(null);
            if (res.ok) {
              Alert.alert('Listo', data?.message || 'Rifa destacada.');
              loadProfile();
              loadRaffles();
            } else {
              Alert.alert('Error', data?.error || 'No se pudo destacar la rifa.');
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  }, [api, loadProfile, loadRaffles]);

  const activateRaffle = useCallback((raffleId) => {
    if (!raffleId) return;
    Alert.alert(
      'Activar rifa',
      'Al activar se consume cupo (si aplica) y la rifa se publica.',
      [
        {
          text: 'Activar',
          onPress: async () => {
            setActivatingRaffleId(raffleId);
            const { res, data } = await api(`/admin/raffles/${raffleId}/activate`, { method: 'POST' });
            setActivatingRaffleId(null);
            if (res.ok) {
              Alert.alert('Listo', data?.message || 'Rifa activada.');
              loadProfile();
              loadRaffles();
            } else {
              Alert.alert('Error', data?.error || 'No se pudo activar la rifa.');
            }
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  }, [api, loadProfile, loadRaffles]);

  const loadRaffles = useCallback(async () => {
    try {
      const { res, data } = await api('/admin/raffles');
      if (res.ok && Array.isArray(data)) {
        const normalized = data.map(normalizeRaffle).filter(Boolean);
        setRaffles(normalized);
      } else {
        setRaffles([]);
      }
    } catch (_err) {
      setRaffles([]);
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
    if (!isSuperadmin && !String(ticketFilters?.raffleId || '').trim()) {
      Alert.alert('Selecciona una rifa', 'Para ver/gestionar tickets debes elegir una rifa.');
      return;
    }
    setTicketsLoading(true);
    const params = new URLSearchParams();
    if (ticketFilters.raffleId) params.append('raffleId', ticketFilters.raffleId);
    if (ticketFilters.status) params.append('status', ticketFilters.status);
    if (ticketFilters.from) params.append('from', ticketFilters.from);
    if (ticketFilters.to) params.append('to', ticketFilters.to);
    if (String(ticketFilters.number || '').trim()) params.append('number', String(ticketFilters.number).trim());
    if (String(ticketFilters.serial || '').trim()) params.append('serial', String(ticketFilters.serial).trim());
    params.append('take', '200');
    const query = params.toString() ? `?${params.toString()}` : '';
    const { res, data } = await api(`/admin/tickets${query}`);
    if (res.ok && Array.isArray(data)) setTickets(data.filter((t) => t && typeof t === 'object'));
    setTicketsLoading(false);
  }, [api, ticketFilters, isSuperadmin]);

  const activeRafflesForTickets = useMemo(() => {
    const list = Array.isArray(raffles) ? raffles : [];
    return list
      .filter((r) => {
        const st = String(r?.status || 'active').toLowerCase();
        return st === 'active';
      })
      .sort((a, b) => {
        const ad = a?.activatedAt || a?.createdAt;
        const bd = b?.activatedAt || b?.createdAt;
        return new Date(bd || 0).getTime() - new Date(ad || 0).getTime();
      });
  }, [raffles]);

  useEffect(() => {
    if (activeSection !== 'tickets') return;
    if (isSuperadmin) return;
    if (String(ticketFilters?.raffleId || '').trim()) return;
    if (!activeRafflesForTickets.length) return;
    setTicketFilters((s) => ({ ...s, raffleId: String(activeRafflesForTickets[0].id) }));
  }, [activeSection, isSuperadmin, ticketFilters?.raffleId, activeRafflesForTickets]);

  const selectedTicketRaffleLabel = useMemo(() => {
    const id = String(ticketFilters?.raffleId || '').trim();
    if (!id) return 'Todas las rifas activas';
    const found = activeRafflesForTickets.find((r) => String(r?.id) === id);
    if (!found) return `Rifa #${id}`;
    const title = String(found.title || '').trim();
    return title ? `${title} (#${found.id})` : `Rifa #${found.id}`;
  }, [ticketFilters?.raffleId, activeRafflesForTickets]);

  const allowedTicketRaffleIds = useMemo(() => {
    const ids = new Set();
    (Array.isArray(raffles) ? raffles : []).forEach((r) => {
      if (r?.id != null) ids.add(String(r.id));
    });
    return ids;
  }, [raffles]);

  const getTicketSerial = useCallback((ticket) => {
    const t = ticket && typeof ticket === 'object' ? ticket : {};
    return t.serial || t.serialNumber || t.ticketSerial || t.id || '';
  }, []);

  const verifyQuickIdentity = useCallback(async () => {
    const raffleId = String(ticketFilters?.raffleId || '').trim();
    if (!raffleId) {
      Alert.alert('Selecciona una rifa', 'El verificador requiere una rifa específica.');
      return;
    }

    if (!isSuperadmin && !allowedTicketRaffleIds.has(raffleId)) {
      Alert.alert('Acceso denegado', 'Solo puedes verificar tickets de tus propias rifas.');
      return;
    }

    const cedula = normalizeDigits(quickVerifierForm.cedula);
    const phone = normalizeDigits(quickVerifierForm.phone);
    const email = normalizeLooseText(quickVerifierForm.email);
    const firstName = normalizeLooseText(quickVerifierForm.firstName);
    const lastName = normalizeLooseText(quickVerifierForm.lastName);

    const hasAny = Boolean(cedula || phone || email || firstName || lastName);
    if (!hasAny) {
      Alert.alert('Completa un dato', 'Ingresa cédula, nombres, teléfono o email para verificar.');
      return;
    }

    setVerifierLoading(true);
    setVerifierResult(null);

    try {
      const params = new URLSearchParams();
      params.append('raffleId', raffleId);
      if (cedula) params.append('cedula', cedula);
      if (phone) params.append('phone', phone);
      if (email) params.append('email', email);
      params.append('take', '500');
      const query = params.toString() ? `?${params.toString()}` : '';
      const { res, data } = await api(`/admin/tickets${query}`);

      if (!res.ok || !Array.isArray(data)) {
        setVerifierResult({ status: 'not_found', matches: [] });
        return;
      }

      const safeTickets = data.filter((t) => t && typeof t === 'object');

      const matches = safeTickets.filter((t) => {
        const buyer = t?.buyer || t?.user || {};
        const bCedula = normalizeDigits(buyer.cedula || buyer.phone || buyer.document || t.cedula);
        const bPhone = normalizeDigits(buyer.phone || t.phone);
        const bEmail = normalizeLooseText(buyer.email || t.email);
        const bFirst = normalizeLooseText(buyer.firstName || buyer.name);
        const bLast = normalizeLooseText(buyer.lastName);

        if (cedula && bCedula !== cedula) return false;
        if (phone && bPhone !== phone) return false;
        if (email && bEmail !== email) return false;
        if (firstName && (!bFirst || bFirst !== firstName)) return false;
        if (lastName && (!bLast || bLast !== lastName)) return false;
        return true;
      });

      if (matches.length) setVerifierResult({ status: 'found', matches });
      else setVerifierResult({ status: 'not_found', matches: [] });
    } catch (_e) {
      setVerifierResult({ status: 'not_found', matches: [] });
    } finally {
      setVerifierLoading(false);
    }
  }, [
    api,
    ticketFilters?.raffleId,
    allowedTicketRaffleIds,
    isSuperadmin,
    quickVerifierForm,
    normalizeDigits,
    normalizeLooseText
  ]);

  const verifyQuickTicket = useCallback(async () => {
    const input = String(verifierInput || '').trim();
    if (!input) return;

    setVerifierLoading(true);
    setVerifierResult(null);

    try {
      // 1) Verificación remota (soporta serial, número, email, cédula, nombre)
      const { res, data } = await api(`/admin/verify-ticket/${encodeURIComponent(input)}?take=200`);
      if (res.ok && data?.valid) {
        const matches = Array.isArray(data?.matches)
          ? data.matches
          : data?.ticket
            ? [data.ticket]
            : [];
        if (matches.length) {
          setVerifierResult({ status: 'found', matches });
          return;
        }
      }

      // 2) Fallback: si el input es número, intentar encontrarlo en la lista cargada.
      const localFound = tickets.find(
        (t) => String(t.number) === input || String(t.serialNumber) === input
      );

      if (localFound) {
        // Si tenemos serial, volvemos a consultar para obtener comprador desencriptado.
        const serial = localFound.serialNumber;
        if (serial) {
          const remote = await api(`/admin/verify-ticket/${encodeURIComponent(String(serial))}?take=200`);
          if (remote.res.ok && remote.data?.valid) {
            const matches = Array.isArray(remote.data?.matches)
              ? remote.data.matches
              : remote.data?.ticket
                ? [remote.data.ticket]
                : [];
            if (matches.length) {
              setVerifierResult({ status: 'found', matches });
              return;
            }
          }
        }

        setVerifierResult({ status: 'found', matches: [localFound] });
        return;
      }

      setVerifierResult({ status: 'not_found' });
    } catch (e) {
      setVerifierResult({ status: 'not_found' });
    } finally {
      setVerifierLoading(false);
    }
  }, [api, tickets, verifierInput]);

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
        if (s1.data?.smtp) setSmtpForm(s => ({ ...s, ...normalizeSmtpFromServer(s1.data.smtp) }));
        if (s1.data?.techSupport) setTechSupportForm(s => ({ ...s, ...s1.data?.techSupport }));

        const limit = s1.data?.company?.planConfig?.unlimitedWeeklyRaffleLimit;
        if (typeof limit === 'number' && Number.isFinite(limit)) {
          setPlanConfigForm({ unlimitedWeeklyRaffleLimit: String(limit) });
        }

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

  useEffect(() => {
    if (!viewUser) return;
    const p = viewUser?.adminPlan || null;
    const tier = String(p?.tier || '').toLowerCase();
    setUserPlanForm({
      tier: ['starter', 'pro', 'unlimited'].includes(tier) ? tier : 'starter',
      raffleCreditsRemaining: typeof p?.raffleCreditsRemaining === 'number' ? String(p.raffleCreditsRemaining) : '',
      boostCreditsRemaining: typeof p?.boostCreditsRemaining === 'number' ? String(p.boostCreditsRemaining) : ''
    });
  }, [viewUser?.id]);



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
    const portNumber = Number(String(smtpForm.port || '').trim());
    const payload = {
      host: String(smtpForm.host || '').trim(),
      port: Number.isFinite(portNumber) ? portNumber : 587,
      secure: !!smtpForm.secure,
      user: String(smtpForm.user || '').trim(),
      pass: String(smtpForm.pass || ''),
      fromName: String(smtpForm.fromName || '').trim(),
      fromEmail: String(smtpForm.fromEmail || '').trim()
    };

    const { res, data } = await api('/superadmin/settings/smtp', { method: 'PATCH', body: JSON.stringify(payload) });
    if (res.ok) Alert.alert('Listo', 'Configuración SMTP guardada.');
    else Alert.alert('Error', data?.error || 'No se pudo guardar SMTP.');
    setSavingSmtp(false);
  };

  const savePlanConfig = async () => {
    const raw = String(planConfigForm.unlimitedWeeklyRaffleLimit ?? '').trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      return Alert.alert('Dato inválido', 'El límite semanal debe ser un número mayor o igual a 0.');
    }

    setSavingPlanConfig(true);
    const { res, data } = await api('/superadmin/settings/company', {
      method: 'PATCH',
      body: JSON.stringify({ planConfig: { unlimitedWeeklyRaffleLimit: Math.floor(value) } })
    });
    if (res.ok) {
      Alert.alert('Listo', 'Configuración de planes actualizada.');
      const limit = data?.company?.planConfig?.unlimitedWeeklyRaffleLimit;
      if (typeof limit === 'number' && Number.isFinite(limit)) {
        setPlanConfigForm({ unlimitedWeeklyRaffleLimit: String(limit) });
      }
    } else {
      Alert.alert('Error', data?.error || 'No se pudo guardar la configuración de planes.');
    }
    setSavingPlanConfig(false);
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

  const saveUserPlan = async () => {
    if (!viewUser?.id) return;
    if (viewUser.role !== 'admin') {
      return Alert.alert('No aplica', 'El plan solo se asigna a usuarios con rol admin.');
    }

    const tier = String(userPlanForm.tier || '').toLowerCase();
    if (!['starter', 'pro', 'unlimited'].includes(tier)) {
      return Alert.alert('Plan inválido', 'Selecciona Starter, Pro o Unlimited.');
    }

    const payload = { tier };

    if (tier !== 'unlimited') {
      const rawCredits = String(userPlanForm.raffleCreditsRemaining ?? '').trim();
      if (rawCredits !== '') {
        const credits = Number(rawCredits);
        if (!Number.isFinite(credits) || credits < 0) {
          return Alert.alert('Dato inválido', 'Los cupos de rifas deben ser un número mayor o igual a 0.');
        }
        payload.raffleCreditsRemaining = Math.floor(credits);
      }
    }

    const rawBoosts = String(userPlanForm.boostCreditsRemaining ?? '').trim();
    if (rawBoosts !== '') {
      const boosts = Number(rawBoosts);
      if (!Number.isFinite(boosts) || boosts < 0) {
        return Alert.alert('Dato inválido', 'Los boosts deben ser un número mayor o igual a 0.');
      }
      payload.boostCreditsRemaining = Math.floor(boosts);
    }

    setSavingUserPlan(true);
    const { res, data } = await api(`/superadmin/users/${viewUser.id}/plan`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      Alert.alert('Listo', 'Plan actualizado.');
      if (data) {
        setViewUser(data);
        setUsers(prev => prev.map(u => (u.id === data.id ? data : u)));
        setFilteredUsers(prev => prev.map(u => (u.id === data.id ? data : u)));
      }
    } else {
      Alert.alert('Error', data?.error || 'No se pudo actualizar el plan.');
    }
    setSavingUserPlan(false);
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
    const current = payments.find((p) => p?.id === id);
    const currentStatus = String(current?.status || 'pending').toLowerCase();
    if (current && currentStatus !== 'pending') {
      Alert.alert('Sin acciones', `Este pago ya está ${currentStatus}.`);
      return;
    }
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

  useEffect(() => {
    if (activeSection === 'payments') loadManualPayments();
  }, [activeSection, paymentFilters.status, loadManualPayments]);

  const updateStyle = async () => {
    if (!styleForm.raffleId) return Alert.alert('Falta rifa', 'Selecciona una rifa.');
    setStyleLoading(true);
    const { raffleId, ...styleData } = styleForm;
    const { res, data } = await api(`/admin/raffles/${styleForm.raffleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ style: styleData })
    });
    if (res.ok) {
      Alert.alert('Estilo actualizado');
      loadRaffles();
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
    if (String(ticketFilters.number || '').trim()) params.append('number', String(ticketFilters.number).trim());
    if (String(ticketFilters.serial || '').trim()) params.append('serial', String(ticketFilters.serial).trim());
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
      quality: 1,
      allowsEditing: false,
      base64: false
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      try {
        bannerAssetRef.current = asset;
        // Para rifas: evitar fallas del endpoint de uploads. Normalizar localmente a dataURL.
        const processed = await normalizeImage(asset, {
          maxWidth: 900,
          compress: 0.6,
          maxChars: 320_000,
          maxIterations: 6
        });
        if (processed) setStyleForm((s) => ({ ...s, bannerImage: processed }));
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo subir la imagen.');
      }
    }
  };

  const pickGalleryImage = async () => {
    if ((styleForm.gallery || []).length >= MAX_GALLERY_IMAGES) {
      return Alert.alert('Límite alcanzado', `Solo puedes cargar hasta ${MAX_GALLERY_IMAGES} fotos.`);
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permiso requerido', 'Autoriza el acceso a la galería.');
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsEditing: false,
      base64: false
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      try {
        // Para rifas: evitar fallas del endpoint de uploads. Normalizar localmente a dataURL.
        const processed = await normalizeImage(asset, {
          maxWidth: 820,
          compress: 0.55,
          maxChars: 260_000,
          maxIterations: 6
        });
        if (processed) {
          galleryAssetsRef.current = [...ensureArray(galleryAssetsRef.current), asset];
          setStyleForm((s) => ({ ...s, gallery: [...ensureArray(s.gallery), processed] }));
        }
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo subir la imagen.');
      }
    }
  };

  const removeGalleryImage = (index) => {
    galleryAssetsRef.current = ensureArray(galleryAssetsRef.current).filter((_, i) => i !== index);
    setStyleForm((s) => ({ ...s, gallery: ensureArray(s.gallery).filter((_, i) => i !== index) }));
  };

  const closeProofViewer = () => {
    setProofViewer({ visible: false, uri: '' });
    setProofImageLoading(false);
    setProofImageError(false);
  };

  const editRaffle = (raffle) => {
    // Al editar una rifa existente, no tenemos los assets originales locales.
    bannerAssetRef.current = null;
    galleryAssetsRef.current = [];
    const stylePaymentMethods = normalizePaymentMethods(raffle?.style?.paymentMethods);
    const directPaymentMethods = normalizePaymentMethods(raffle?.paymentMethods);
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
      paymentMethods: directPaymentMethods.length ? directPaymentMethods : (stylePaymentMethods.length ? stylePaymentMethods : ['mobile_payment'])
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
        instagram: styleForm.instagram,
        paymentMethods: normalizePaymentMethods(raffleForm.paymentMethods)
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
    setRaffleForm({ id: null, title: '', price: '', description: '', totalTickets: '', digits: 4, startDate: '', endDate: '', securityCode: '', lottery: '', instantWins: '', terms: '', minTickets: '', paymentMethods: ['mobile_payment'] });
    setRaffleErrors({});
  };

  const resetRaffleDraft = () => {
    resetRaffleForm();
    setStyleForm({ raffleId: null, bannerImage: '', gallery: [], themeColor: '#2563eb', terms: '', whatsapp: '', instagram: '' });
    bannerAssetRef.current = null;
    galleryAssetsRef.current = [];
    setBankSettings({ bankName: '', accountName: '', accountNumber: '', accountType: '', cedula: '', phone: '' });
    setStartDateValue(new Date());
    setEndDateValue(new Date());
  };

  const submitRaffle = async () => {
    const errors = {};
    if (!raffleForm.title) errors.title = true;
    if (!raffleForm.price) errors.price = true;
    if (!raffleForm.lottery) errors.lottery = true;
    if (!raffleForm.description) errors.description = true;
    
    setRaffleErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const isCreate = !raffleForm.id;

    // No permitir crear/publicar rifas nuevas sin imágenes
    const galleryImages = ensureArray(styleForm.gallery).filter(Boolean);
    const bannerImage = styleForm.bannerImage || galleryImages[0] || '';
    if (isCreate && !bannerImage && galleryImages.length === 0) {
      return Alert.alert('Faltan imágenes', 'Debes subir al menos 1 imagen antes de publicar la rifa.');
    }
    
      quickNotify('Guardando rifa...');

     const paymentMethods = normalizePaymentMethods(raffleForm.paymentMethods);
     if (paymentMethods.includes('mobile_payment')) {
       await api('/me', { method: 'PATCH', body: JSON.stringify({ bankDetails: bankSettings }) });
    }

    const instantWinsArray = raffleForm.instantWins 
      ? raffleForm.instantWins.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
      : [];

    const createPayload = {
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
      paymentMethods
    };

    const updatePayload = {
      title: raffleForm.title,
      prize: raffleForm.description,
      ticketPrice: Number(raffleForm.price),
      totalTickets: raffleForm.totalTickets ? Number(raffleForm.totalTickets) : undefined,
      lottery: raffleForm.lottery,
      terms: raffleForm.terms || null
    };

    const payload = isCreate ? createPayload : updatePayload;

    if (isCreate) {
      const confirmed = await new Promise(resolve => {
        Alert.alert(
          'Confirmar publicación',
          'Una vez publicada, no podrás eliminar la rifa (solo cerrarla). ¿Deseas continuar?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Publicar', onPress: () => resolve(true) }
          ]
        );
      });
      if (!confirmed) return;
    }

    setSavingRaffle(true);
    // Crear: el backend usa POST /raffles. Editar: PATCH /admin/raffles/:id
    const endpoint = isCreate ? '/raffles' : `/admin/raffles/${raffleForm.id}`;
    const method = isCreate ? 'POST' : 'PATCH';
    const { res, data } = await api(endpoint, { method, body: JSON.stringify(payload) });
    
    if (res.ok) {
      // Save style if we have style data
      const raffleId = raffleForm.id || data.id || data.raffle?.id || data?.raffle?.id;
      let styleError = null;
      let activationError = null;
      
      if (raffleId) {
        const buildStylePayload = (nextBannerImage, nextGalleryImages) => ({
          style: {
            bannerImage: nextBannerImage || '',
            gallery: ensureArray(nextGalleryImages).filter(Boolean),
            themeColor: styleForm.themeColor,
            whatsapp: styleForm.whatsapp,
            instagram: styleForm.instagram,
            paymentMethods
          }
        });

        const clampNumber = (n, min, max) => Math.max(min, Math.min(max, n));
        const hasLocalAssets = () => {
          const bannerAsset = bannerAssetRef.current;
          const galleryAssets = ensureArray(galleryAssetsRef.current);
          const hasBanner = !!bannerAsset?.uri;
          const hasAnyGallery = galleryAssets.some((a) => !!a?.uri);
          return hasBanner || hasAnyGallery;
        };

        const recompressFromAssets = async ({ targetTotalChars }) => {
          const bannerAsset = bannerAssetRef.current;
          const galleryAssets = ensureArray(galleryAssetsRef.current).filter((a) => !!a?.uri);
          const count = (bannerAsset?.uri ? 1 : 0) + galleryAssets.length;

          const safeTotal = Number.isFinite(Number(targetTotalChars)) ? Number(targetTotalChars) : 800_000;
          const perImageMax = clampNumber(Math.floor(safeTotal / Math.max(1, count)), 110_000, 260_000);
          const bannerMax = clampNumber(perImageMax + 60_000, 140_000, 320_000);

          let nextBanner = finalBannerImage;
          let nextGallery = finalGalleryImages;

          if (bannerAsset?.uri) {
            nextBanner = await normalizeImage(bannerAsset, {
              maxWidth: 900,
              compress: 0.58,
              maxChars: bannerMax,
              maxIterations: 7
            });
          }

          if (galleryAssets.length) {
            nextGallery = [];
            for (const asset of galleryAssets) {
              const img = await normalizeImage(asset, {
                maxWidth: 820,
                compress: 0.52,
                maxChars: perImageMax,
                maxIterations: 7
              });
              if (img) nextGallery.push(img);
            }
          }

          // Persistir la nueva compresión en el estado (para que al editar quede igual)
          setStyleForm((s) => ({
            ...s,
            ...(nextBanner ? { bannerImage: nextBanner } : {}),
            ...(Array.isArray(nextGallery) ? { gallery: nextGallery } : {})
          }));

          finalBannerImage = nextBanner;
          finalGalleryImages = nextGallery;
        };

        quickNotify('Subiendo imágenes...');
        let finalBannerImage = bannerImage;
        let finalGalleryImages = galleryImages;

        // Intento 1: subir con lo ya procesado
        let styleRes = await api(`/admin/raffles/${raffleId}`, { method: 'PATCH', body: JSON.stringify(buildStylePayload(finalBannerImage, finalGalleryImages)) });

        // Si falla (por tamaño u otra validación), recomprimir automáticamente y reintentar 1 vez.
        // Así el usuario puede subir fotos grandes y la app se encarga de optimizarlas.
        if (!styleRes.res.ok && isCreate && hasLocalAssets()) {
          quickNotify('Optimizando imágenes...');
          try {
            const totalImages = (bannerAssetRef.current?.uri ? 1 : 0) + ensureArray(galleryAssetsRef.current).filter((a) => !!a?.uri).length;
            // Mantener el JSON en un tamaño razonable ajustando el máximo por imagen según cantidad.
            const targetTotalChars = totalImages >= 6 ? 650_000 : totalImages >= 3 ? 750_000 : 850_000;
            await recompressFromAssets({ targetTotalChars });
          } catch (e) {
            console.log('Auto-compress retry failed:', e);
          }
          styleRes = await api(`/admin/raffles/${raffleId}`, { method: 'PATCH', body: JSON.stringify(buildStylePayload(finalBannerImage, finalGalleryImages)) });
        }

        if (!styleRes.res.ok) {
          console.log('Style upload failed:', styleRes.res.status, styleRes.data);
          if (styleRes.res.status === 413 || /entity too large|request entity too large/i.test(String(styleRes.data?.error || ''))) {
            styleError = 'Las imágenes aún son demasiado pesadas. El sistema intentó reducirlas automáticamente. Prueba con fotos más ligeras.';
          } else {
            styleError = styleRes.data?.error || 'Error al guardar las imágenes.';
          }
          console.log('Style upload error:', styleError);
        }

        // Para que la rifa se vea en el listado público (/raffles), activar al crear.
        // Requisito: no activar si falló la subida de imágenes.
        if (isCreate && !styleError) {
          quickNotify('Publicando rifa...');
          const actRes = await api(`/admin/raffles/${raffleId}/activate`, { method: 'POST' });
          if (!actRes.res.ok) {
            activationError = actRes.data?.error || 'No se pudo activar la rifa.';
            console.log('Activation error:', activationError);
          }
        }
      }

      if (styleError || activationError) {
        const parts = [];
        if (styleError) parts.push(`Imágenes: ${styleError}`);
        if (activationError) parts.push(`Publicación: ${activationError}`);
        Alert.alert('Rifa guardada con advertencia', `La rifa se guardó, pero hubo un problema:\n\n- ${parts.join('\n- ')}\n\nPuedes intentar editar la rifa nuevamente.`);
      } else {
        // Al publicar (crear) queremos dejar el formulario limpio inmediatamente,
        // sin esperar el OK del usuario.
        if (isCreate) {
          setPublishPreviewVisible(false);
          resetRaffleDraft();
          loadRaffles();
          loadTickets();
          Alert.alert('Listo', 'Rifa creada correctamente.');
        } else {
          Alert.alert('Listo', 'Rifa actualizada correctamente.', [
            {
              text: 'OK',
              onPress: () => {
                setPublishPreviewVisible(false);
                resetRaffleDraft();
                loadRaffles();
                loadTickets();
              }
            }
          ]);
        }
      }
    } else {
      if (res.status === 413 || /entity too large|request entity too large/i.test(String(data?.error || ''))) {
        Alert.alert(
          'Imágenes muy pesadas',
          'La solicitud excede el límite del servidor. Usa fotos más ligeras (o recórtalas) y vuelve a intentarlo; la app las comprimirá automáticamente.'
        );
      } else {
        Alert.alert('Ups', data?.error || 'No se pudo guardar.');
      }
    }
    setSavingRaffle(false);
  };

  const validateRaffleForPreview = () => {
    const errors = {};
    if (!raffleForm.title) errors.title = true;
    if (!raffleForm.price) errors.price = true;
    if (!raffleForm.lottery) errors.lottery = true;
    if (!raffleForm.description) errors.description = true;
    setRaffleErrors(errors);
    if (Object.keys(errors).length > 0) return false;

    const isCreate = !raffleForm.id;
    const galleryImages = ensureArray(styleForm.gallery).filter(Boolean);
    const bannerImage = styleForm.bannerImage || galleryImages[0] || '';
    if (isCreate && !bannerImage && galleryImages.length === 0) {
      Alert.alert('Faltan imágenes', 'Debes subir al menos 1 imagen antes de publicar la rifa.');
      return false;
    }
    return true;
  };

  const openPublishPreview = () => {
    const isCreate = !raffleForm.id;
    if (!isCreate) return submitRaffle();
    if (!validateRaffleForPreview()) return;
    setPublishPreviewVisible(true);
  };

  const buildPreviewRaffle = () => {
    const galleryImages = ensureArray(styleForm.gallery).filter(Boolean);
    const bannerImage = styleForm.bannerImage || galleryImages[0] || '';
    const gallery = galleryImages.length ? galleryImages : (bannerImage ? [bannerImage] : []);
    const price = raffleForm.price ? Number(raffleForm.price) : 0;
    const totalTickets = raffleForm.totalTickets ? Number(raffleForm.totalTickets) : 0;
    return {
      id: 'preview',
      title: raffleForm.title,
      description: raffleForm.description,
      price,
      totalTickets,
      stats: { total: totalTickets, sold: 0, remaining: totalTickets },
      style: { bannerImage, gallery, themeColor: styleForm.themeColor },
      user: {
        id: profile?.id,
        name: profile?.name,
        avatar: profile?.avatar,
        identityVerified: !!profile?.identityVerified,
        isBoosted: !!profile?.isBoosted,
        boostEndsAt: profile?.boostEndsAt
      }
    };
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
    if (!isSuperadmin) return Alert.alert('Acceso denegado', 'Solo el superadmin puede eliminar anuncios.');
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
    const result = await ImagePicker.launchImageLibraryAsync({ base64: false, quality: 1, allowsEditing: false });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      try {
        const processed = await uploadImageAsset(asset);
        if (processed) setAnnouncementForm((s) => ({ ...s, imageUrl: processed }));
      } catch (e) {
        Alert.alert('Error', e?.message || 'No se pudo subir la imagen.');
      }
    }
  };

  const loadMetrics = async () => {
    setMetricsLoading(true);
    try {
      const raffleId = selectedRaffle?.id ? String(selectedRaffle.id) : '';
      const q = raffleId ? `?raffleId=${encodeURIComponent(raffleId)}` : '';
      const q7 = raffleId ? `?days=7&raffleId=${encodeURIComponent(raffleId)}` : '?days=7';
      const [summary, hourly, daily, byState, top] = await Promise.all([
        api(`/admin/metrics/summary${q}`),
        api(`/admin/metrics/hourly${q}`),
        api(`/admin/metrics/daily${q7}`),
        api(`/admin/metrics/by-state${q}`),
        api(`/admin/metrics/top-buyers${q}`)
      ]);

      if (summary.res.ok) setMetricsSummary(summary.data); else setMetricsSummary(null);
      if (hourly.res.ok) setMetricsHourly(hourly.data || []); else setMetricsHourly([]);
      if (daily.res.ok) setMetricsDaily(daily.data || []); else setMetricsDaily([]);
      if (byState.res.ok) setMetricsByState(byState.data || []); else setMetricsByState([]);
      if (top.res.ok) setMetricsTop(top.data || []); else setMetricsTop([]);
    } catch (err) {
      console.log('metrics error', err);
      setMetricsSummary(null);
      setMetricsHourly([]);
      setMetricsDaily([]);
      setMetricsByState([]);
      setMetricsTop([]);
    }
    setMetricsLoading(false);
  };

  const [winnerPhoto, setWinnerPhoto] = useState(null);

  const pickWinnerPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
      base64: false,
    });

    if (!result.canceled) {
      setWinnerPhoto(result.assets[0]);
    }
  };

  const openWinnerModal = (raffleId) => {
    setWinnerRaffleId(raffleId);
    setWinningNumberInput('');
    setWinnerPhoto(null);
    setWinnerModalVisible(true);
  };

  const declareWinner = async () => {
    if (!winningNumberInput) return Alert.alert('Error', 'Ingresa el número ganador');
    
    setDeclaringWinner(true);

    let proof = null;
    if (winnerPhoto?.uri) {
      try {
        proof = await uploadImageAsset(winnerPhoto);
      } catch (e) {
        setDeclaringWinner(false);
        return Alert.alert('Error', e?.message || 'No se pudo subir la foto del ganador.');
      }
    }

    const body = {
      winningNumber: winningNumberInput,
      proof
    };

    const { res, data } = await api(`/raffles/${winnerRaffleId}/declare-winner`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    setDeclaringWinner(false);
    setWinnerModalVisible(false);
    
    if (res.ok) {
      Alert.alert('Éxito', data.message);
      loadRaffles();
      loadTickets();
    } else {
      Alert.alert('Error', data.error || 'No se pudo declarar el ganador');
    }
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
    if (!isSuperadmin) return Alert.alert('Acceso denegado', 'Solo el superadmin puede eliminar rifas.');
    
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
      <AdminScreenErrorBoundary>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>
                {isSuperadmin ? 'Superadmin' : 'Admin'}
              </Text>
            </View>
            {techSupport && (
              <TouchableOpacity onPress={() => setSupportVisible(true)} style={{ padding: 8 }}>
                <Ionicons name="help-circle-outline" size={28} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

        {/* Nota: la vista antigua activeSection === 'reports' se mantiene en una sola instancia arriba.
            El acceso principal para superadmin es 'sa_reports' (Denuncias y reportes). */}

        {activeSection === 'reports' && (
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setActiveSection(null)} style={{ marginRight: 12, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { marginBottom: 0 }]}>Reportes y Denuncias</Text>
            </View>

            {legacyReportsLoading ? (
              <ActivityIndicator size="large" color={palette.primary} />
            ) : (
              <FlatList
                data={legacyReports}
                keyExtractor={(item) => String(item.id)}
                ListEmptyComponent={<Text style={styles.muted}>No hay reportes pendientes.</Text>}
                renderItem={({ item }) => (
                  <View style={[styles.card, { marginBottom: 12 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="alert-circle" size={20} color="#ef4444" />
                        <Text style={{ color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase' }}>{item.category || 'Reporte'}</Text>
                      </View>
                      <Text style={{ color: palette.muted, fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                    </View>
                    
                    <Text style={{ color: '#fff', marginBottom: 8 }}>{item.comment || 'Sin detalles.'}</Text>
                    
                    {item.raffle && (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                        <Text style={{ color: palette.muted, fontSize: 12 }}>Rifa Reportada:</Text>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.raffle.title}</Text>
                        <Text style={{ color: palette.muted, fontSize: 12 }}>ID: {item.raffle.id}</Text>
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                      <TouchableOpacity 
                        onPress={() => resolveLegacyReport(item.id, 'dismissed')}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12 }}>Desestimar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => resolveLegacyReport(item.id, 'resolved')}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ef4444' }}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Resolver (Ban/Borrar)</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </View>
        )}

        {activeSection === 'sa_users' ? (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (viewUser) setViewUser(null);
                      else setActiveSection(null);
                    }}
                    style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>
                    {viewUser ? 'Hoja de Vida' : 'Gestión de Usuarios'}
                  </Text>
              </View>
              
              {viewUser ? (
                <ScrollView>
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

                  {viewUser.role === 'admin' && (
                    <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                      <Text style={styles.section}>Plan de Admin</Text>
                      <Text style={[styles.muted, { marginBottom: 10 }]}>Asignación hecha por superadmin. El consumo aplica al activar (draft → activa).</Text>

                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        {[
                          { id: 'starter', label: 'Starter' },
                          { id: 'pro', label: 'Pro' },
                          { id: 'unlimited', label: 'Unlimited' }
                        ].map(opt => (
                          <TouchableOpacity
                            key={opt.id}
                            onPress={() => setUserPlanForm(s => ({ ...s, tier: opt.id }))}
                            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: userPlanForm.tier === opt.id ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: userPlanForm.tier === opt.id ? '#60a5fa' : 'rgba(255,255,255,0.08)', alignItems: 'center' }}
                          >
                            <Text style={{ color: '#e2e8f0', fontWeight: '800' }}>{opt.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={styles.section}>Cupos de rifas (Starter/Pro)</Text>
                      <TextInput
                        style={[styles.input, { opacity: userPlanForm.tier === 'unlimited' ? 0.6 : 1 }]}
                        placeholder="Ej: 5 o 10"
                        value={userPlanForm.raffleCreditsRemaining}
                        onChangeText={(v) => setUserPlanForm(s => ({ ...s, raffleCreditsRemaining: v }))}
                        keyboardType="numeric"
                        editable={userPlanForm.tier !== 'unlimited'}
                      />
                      {userPlanForm.tier === 'unlimited' && (
                        <Text style={[styles.muted, { marginTop: -6, marginBottom: 10 }]}>
                          Unlimited no usa cupos. Límite semanal actual: {planConfigForm.unlimitedWeeklyRaffleLimit || '3'} activaciones/7 días.
                        </Text>
                      )}

                      <Text style={styles.section}>Boosts (opcional)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: 0, 2, 8"
                        value={userPlanForm.boostCreditsRemaining}
                        onChangeText={(v) => setUserPlanForm(s => ({ ...s, boostCreditsRemaining: v }))}
                        keyboardType="numeric"
                      />

                      <FilledButton
                        title={savingUserPlan ? 'Guardando...' : 'Guardar Plan'}
                        onPress={saveUserPlan}
                        loading={savingUserPlan}
                        disabled={savingUserPlan}
                        icon={<Ionicons name="pricetag-outline" size={18} color="#fff" />}
                      />
                    </View>
                  )}

                  <Text style={styles.section}>Historial Reciente</Text>
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16 }}>
                      <Text style={{ color: palette.muted, textAlign: 'center', fontStyle: 'italic' }}>
                          No hay transacciones recientes registradas para este usuario.
                      </Text>
                  </View>
                </ScrollView>
              ) : (
                <FlatList
                  data={filteredUsers}
                  keyExtractor={(item) => item.id || Math.random().toString()}
                  renderItem={({ item: u }) => (
                    <TouchableOpacity 
                      onPress={() => setViewUser(u)}
                      style={{ backgroundColor: u.role === 'admin' || u.role === 'superadmin' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: u.role === 'admin' || u.role === 'superadmin' ? 1 : 0, borderColor: 'rgba(96, 165, 250, 0.3)' }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.name || 'Sin nombre'}</Text>
                          <Text style={{ color: palette.muted, fontSize: 12 }}>{u.email}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={{ backgroundColor: u.role === 'superadmin' ? '#c084fc' : u.role === 'admin' ? '#60a5fa' : '#94a3b8', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{(u.role || 'user').toUpperCase()}</Text>
                            </View>
                            <View style={{ backgroundColor: u.active ? '#4ade80' : '#f87171', paddingHorizontal: 6, borderRadius: 4 }}>
                              <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{u.active ? 'ACTIVO' : 'INACTIVO'}</Text>
                            </View>
                            {u.role !== 'admin' && u.role !== 'superadmin' && (
                              <View style={{ backgroundColor: u.verified ? '#22d3ee' : '#fbbf24', paddingHorizontal: 6, borderRadius: 4 }}>
                                <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>{u.verified ? 'VERIFICADO' : 'NO VERIF.'}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={palette.muted} />
                      </View>
                    </TouchableOpacity>
                  )}
                  ListHeaderComponent={
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

                      <View style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={styles.section}>Configuración de Planes</Text>
                        <Text style={styles.muted}>Afecta a Unlimited (activaciones/7 días).</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Límite semanal unlimited"
                          value={planConfigForm.unlimitedWeeklyRaffleLimit}
                          onChangeText={(v) => setPlanConfigForm(s => ({ ...s, unlimitedWeeklyRaffleLimit: v }))}
                          keyboardType="numeric"
                        />
                        <FilledButton
                          title={savingPlanConfig ? 'Guardando...' : 'Guardar Configuración'}
                          onPress={savePlanConfig}
                          loading={savingPlanConfig}
                          disabled={savingPlanConfig}
                          icon={<Ionicons name="settings-outline" size={18} color="#fff" />}
                        />
                      </View>

                      <Text style={styles.section}>Lista de Usuarios ({filteredUsers.length})</Text>
                      <TextInput 
                        style={styles.input} 
                        placeholder="Buscar por nombre o email..." 
                        value={userSearch} 
                        onChangeText={filterUsers} 
                      />
                    </>
                  }
                />
              )}
            </View>
        ) : activeSection === 'tickets' ? (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Gestión de Tickets</Text>
              </View>
              
              <FlatList
                data={tickets}
                keyExtractor={(item) => String(item?.id ?? Math.random())}
                renderItem={({ item: t }) => {
                    const buyer = t.buyer || t.user || {};
                    const raffleDigits = raffles.find(r => r.id === t.raffleId)?.digits;
                    const statusColor = t.status === 'approved' || t.status === 'aprobado' ? '#4ade80' : t.status === 'ganador' ? '#fbbf24' : t.status === 'rejected' ? '#f87171' : '#fbbf24';
                    return (
                      <View style={{ marginBottom: 10, backgroundColor: 'rgba(255,255,255,0.04)', padding: 12, borderRadius: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>#{formatTicketNumber(t.number ?? '0', raffleDigits)}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: statusColor }}>
                            <Ionicons name={t.status === 'approved' ? 'checkmark-circle' : t.status === 'rejected' ? 'close-circle' : 'time-outline'} size={14} color={statusColor} />
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
                }}
                ListHeaderComponent={
                  <>
                    {/* VERIFICADOR RÁPIDO */}
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                        <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>Verificador rápido</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>Coincidencias 100% exactas por identidad (requiere rifa).</Text>

                        <TouchableOpacity
                          onPress={() => setRafflePickerVisible(true)}
                          style={[
                            styles.input,
                            {
                              marginBottom: 10,
                              justifyContent: 'center'
                            }
                          ]}
                        >
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Rifa (obligatoria)</Text>
                          <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={1}>
                            {selectedTicketRaffleLabel}
                          </Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Cédula"
                            value={quickVerifierForm.cedula}
                            onChangeText={(v) => setQuickVerifierForm((s) => ({ ...s, cedula: v }))}
                            keyboardType="numeric"
                          />
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Teléfono"
                            value={quickVerifierForm.phone}
                            onChangeText={(v) => setQuickVerifierForm((s) => ({ ...s, phone: v }))}
                            keyboardType="phone-pad"
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Nombres"
                            value={quickVerifierForm.firstName}
                            onChangeText={(v) => setQuickVerifierForm((s) => ({ ...s, firstName: v }))}
                          />
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Apellidos"
                            value={quickVerifierForm.lastName}
                            onChangeText={(v) => setQuickVerifierForm((s) => ({ ...s, lastName: v }))}
                          />
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                          <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Email"
                            value={quickVerifierForm.email}
                            onChangeText={(v) => setQuickVerifierForm((s) => ({ ...s, email: v }))}
                            autoCapitalize="none"
                          />
                          <TouchableOpacity
                            onPress={verifyQuickIdentity}
                            disabled={verifierLoading}
                            style={{ backgroundColor: palette.primary, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12, opacity: verifierLoading ? 0.7 : 1 }}
                          >
                            {verifierLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>Verificar</Text>}
                          </TouchableOpacity>
                        </View>
                        
                        {verifierResult && (
                        <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: verifierResult.status === 'found' ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)', borderWidth: 1, borderColor: verifierResult.status === 'found' ? '#4ade80' : '#f87171' }}>
                            {verifierResult.status === 'found' ? (
                            <>
                                <Text style={{ color: '#4ade80', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>¡COINCIDENCIAS ENCONTRADAS!</Text>
                                <Text style={{ color: '#cbd5e1', textAlign: 'center', marginTop: 4, fontSize: 12 }}>
                                  {Array.isArray(verifierResult.matches) ? verifierResult.matches.length : 1} resultado(s)
                                </Text>

                                <View style={{ marginTop: 10, gap: 10 }}>
                                  {(Array.isArray(verifierResult.matches) ? verifierResult.matches : []).map((t, idx) => {
                                    const buyer = t?.buyer || t?.user || {};
                                    const seller = t?.seller || {};
                                    const buyerName = buyer.firstName || buyer.name || t.holder || 'Desconocido';
                                    const buyerEmail = buyer.email || '—';
                                    const buyerPhone = buyer.phone || buyer.cedula || '—';
                                    const raffleTitle = t.raffle?.title || t.raffle || t.raffleTitle || '—';
                                    const sellerName = seller.name || seller.email || '—';
                                    const createdAt = t.createdAt ? new Date(t.createdAt).toLocaleString() : '—';
                                    const serial = getTicketSerial(t) || '—';
                                    const numLabel = t.number != null ? `#${formatTicketNumber(t.number)}` : '—';

                                    return (
                                      <View key={`${serial}-${idx}`} style={{ padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
                                        <Text style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>{numLabel}</Text>
                                        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginTop: 2 }}>Serial: {serial}</Text>
                                        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center' }}>Fecha/Hora: {createdAt}</Text>
                                        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center' }}>Rifa: {raffleTitle}</Text>
                                        <Text style={{ color: '#cbd5e1', fontSize: 12, textAlign: 'center' }}>Vendedor: {sellerName}</Text>
                                        <View style={{ marginTop: 8 }}>
                                          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>Comprador</Text>
                                          <Text style={{ color: '#fff', textAlign: 'center', marginTop: 2 }}>{buyerName}</Text>
                                          <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 12 }}>Email: {buyerEmail}</Text>
                                          <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 12 }}>Tel/Cédula: {buyerPhone}</Text>
                                          <Text style={{ color: '#cbd5e1', textAlign: 'center', fontSize: 12 }}>Estado: {(t.status || 'unknown').toUpperCase()}</Text>
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                            </>
                            ) : (
                            <Text style={{ color: '#f87171', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>NO ENCONTRADO</Text>
                            )}
                        </View>
                        )}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                        <TouchableOpacity
                          onPress={() => setRafflePickerVisible(true)}
                          style={[
                            styles.input,
                            {
                              flexGrow: 1,
                              flexBasis: '45%',
                              marginBottom: 0,
                              justifyContent: 'center'
                            }
                          ]}
                        >
                          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>Rifa (activa)</Text>
                          <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={1}>
                            {selectedTicketRaffleLabel}
                          </Text>
                        </TouchableOpacity>

                        {isSuperadmin ? (
                          <TouchableOpacity
                            onPress={loadTickets}
                            style={[
                              styles.input,
                              {
                                flexGrow: 1,
                                flexBasis: '45%',
                                marginBottom: 0,
                                justifyContent: 'center',
                                alignItems: 'center'
                              }
                            ]}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800' }}>Verificar</Text>
                          </TouchableOpacity>
                        ) : null}

                        <TextInput
                          style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]}
                          placeholder="Ticket #"
                          value={ticketFilters.number}
                          onChangeText={(v) => setTicketFilters((s) => ({ ...s, number: v }))}
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={[styles.input, { flexGrow: 1, flexBasis: '45%', marginBottom: 0 }]}
                          placeholder="Serial"
                          value={ticketFilters.serial}
                          onChangeText={(v) => setTicketFilters((s) => ({ ...s, serial: v }))}
                          autoCapitalize="none"
                        />
                    </View>

                    <Modal visible={rafflePickerVisible} transparent animationType="fade">
                      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 }}>
                        <View style={{ backgroundColor: '#0b1224', borderRadius: 16, padding: 14, maxHeight: '80%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, textAlign: 'center' }}>Selecciona una rifa activa</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 6 }}>Esto llena el filtro automáticamente</Text>

                          <ScrollView style={{ marginTop: 12 }}>
                            {isSuperadmin ? (
                              <TouchableOpacity
                                onPress={() => {
                                  setTicketFilters((s) => ({ ...s, raffleId: '' }));
                                  setRafflePickerVisible(false);
                                }}
                                style={{ paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10 }}
                              >
                                <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>Todas las rifas activas</Text>
                              </TouchableOpacity>
                            ) : null}

                            {activeRafflesForTickets.map((r) => (
                              <TouchableOpacity
                                key={String(r.id)}
                                onPress={() => {
                                  setTicketFilters((s) => ({ ...s, raffleId: String(r.id) }));
                                  setRafflePickerVisible(false);
                                }}
                                style={{ paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 10 }}
                              >
                                <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={2}>{String(r.title || `Rifa #${r.id}`)}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>#{r.id}</Text>
                              </TouchableOpacity>
                            ))}

                            {!activeRafflesForTickets.length ? (
                              <View style={{ paddingVertical: 18 }}>
                                <Text style={{ color: '#94a3b8', textAlign: 'center' }}>No hay rifas activas para mostrar.</Text>
                              </View>
                            ) : null}
                          </ScrollView>

                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                            <TouchableOpacity
                              onPress={() => setRafflePickerVisible(false)}
                              style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    </Modal>

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
                        <Text style={{ color: '#fff', fontWeight: '700' }}>Verificar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                        onPress={() => {
                          setTicketFilters((s) => ({
                            raffleId: isSuperadmin ? '' : String(s?.raffleId || ''),
                            status: '',
                            from: '',
                            to: '',
                            number: '',
                            serial: ''
                          }));
                          setTimeout(loadTickets, 10);
                        }}
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
                    {ticketsLoading && <ActivityIndicator color={palette.primary} />}
                    {!ticketsLoading && tickets.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>No hay tickets.</Text>}
                  </>
                }
              />
            </View>
        ) : activeSection === 'payments' ? (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Pagos Manuales</Text>
              </View>
              
              <FlatList
                data={payments}
                keyExtractor={(item) => item.id || Math.random().toString()}
                renderItem={({ item: p }) => {
                  const buyer = p.user || {};
                  const status = String(p.status || 'pending').toLowerCase();
                  const statusColor = status === 'approved' ? '#4ade80' : status === 'rejected' ? '#f87171' : '#fbbf24';
                  const canAct = status === 'pending';
                  return (
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Ref: {p.reference || '—'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: statusColor, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                          <Ionicons name={status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time'} size={16} color={statusColor} />
                          <Text style={{ color: statusColor, marginLeft: 6, fontWeight: '700' }}>{status}</Text>
                        </View>
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }}>Rifa ID: {p.raffleId} • Monto: Bs. {Number(p.amount || 0).toFixed(2)}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>Creado: {p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</Text>
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>Comprador</Text>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>{buyer.firstName || buyer.name || 'Usuario'} {buyer.lastName || ''}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.email || '—'}</Text>
                        <Text style={{ color: '#cbd5e1', fontSize: 12 }}>{buyer.state || '—'}</Text>
                      </View>
                      {p.proof ? (
                        <TouchableOpacity
                          onPress={() => {
                            setProofImageLoading(true);
                            setProofImageError(false);
                            setProofViewer({ visible: true, uri: normalizeRemoteUri(p.proof) });
                          }}
                        >
                          <Text style={{ color: palette.primary, textDecorationLine: 'underline', marginVertical: 4 }}>Ver Comprobante</Text>
                        </TouchableOpacity>
                      ) : null}
                      {canAct ? (
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
                      ) : null}
                    </View>
                  );
                }}
                ListHeaderComponent={
                  <>
                    <Text style={styles.muted}>Pagos reportados por usuarios.</Text>

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
                    
                    {loadingPayments && <ActivityIndicator color={palette.primary} />}
                    {!loadingPayments && payments.length === 0 && (
                      <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>
                        {paymentFilters.status === 'approved'
                          ? 'No hay pagos aprobados.'
                          : paymentFilters.status === 'rejected'
                            ? 'No hay pagos rechazados.'
                            : paymentFilters.status === 'pending'
                              ? 'No hay pagos pendientes.'
                              : 'No hay pagos.'}
                      </Text>
                    )}
                  </>
                }
              />
            </View>
        ) : activeSection === 'movements' ? (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Movimientos</Text>
              </View>

              <View style={{ marginBottom: 10 }}>
                <Text style={styles.muted}>Lista de transacciones del sistema.</Text>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <TextInput
                  style={[styles.input, { flexGrow: 1, flexBasis: '55%', marginBottom: 0 }]}
                  placeholder="Buscar (email, referencia...)"
                  value={adminTxFilters.q}
                  onChangeText={(v) => setAdminTxFilters(s => ({ ...s, q: v }))}
                />
                <View style={{ flexGrow: 1, flexBasis: '40%', flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={loadAdminTransactions}
                    style={{ flex: 1, backgroundColor: palette.primary, padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Actualizar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setAdminTxFilters({ status: '', q: '' }); setTimeout(loadAdminTransactions, 10); }}
                    style={{ flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#e2e8f0', fontWeight: '800' }}>Limpiar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: '', label: 'Todos' },
                  { id: 'pending', label: 'Pendiente' },
                  { id: 'approved', label: 'Aprobado' },
                  { id: 'rejected', label: 'Rechazado' }
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.id || 'all'}
                    onPress={() => setAdminTxFilters(s => ({ ...s, status: opt.id }))}
                    style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: adminTxFilters.status === opt.id ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: adminTxFilters.status === opt.id ? 'rgba(34,211,238,0.45)' : 'rgba(255,255,255,0.08)' }}
                  >
                    <Text style={{ color: adminTxFilters.status === opt.id ? '#22d3ee' : '#e2e8f0', fontWeight: '800' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {adminTxLoading ? (
                <View style={{ paddingTop: 20, alignItems: 'center' }}>
                  <ActivityIndicator color={palette.primary} />
                  <Text style={[styles.muted, { marginTop: 8 }]}>Cargando movimientos...</Text>
                </View>
              ) : (
                <FlatList
                  data={adminTransactions}
                  keyExtractor={(item) => String(item?.txCode || item?.id || Math.random())}
                  renderItem={({ item: tx }) => {
                    const status = String(tx?.status || 'pending').toLowerCase();
                    const statusColor = status === 'approved' ? '#4ade80' : status === 'rejected' ? '#f87171' : '#fbbf24';
                    const txLabel = formatTxTypeLabel(tx?.type);
                    const txCode = String(tx?.txCode || '').trim();
                    const txCodeDisplay = txCode || (tx?.id ? `#${tx.id}` : '—');
                    return (
                      <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#fff', fontWeight: '900' }} numberOfLines={1}>{txLabel}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: statusColor, backgroundColor: 'rgba(255,255,255,0.04)' }}>
                            <Ionicons name={status === 'approved' ? 'checkmark-circle' : status === 'rejected' ? 'close-circle' : 'time'} size={16} color={statusColor} />
                            <Text style={{ color: statusColor, marginLeft: 6, fontWeight: '800' }}>{status}</Text>
                          </View>
                        </View>

                        <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                          {tx?.createdAt ? new Date(tx.createdAt).toLocaleString() : '—'}
                          {tx?.raffleId ? ` • Rifa ID: ${tx.raffleId}` : ''}
                        </Text>

                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <Text style={{ color: '#cbd5e1', fontSize: 12 }} numberOfLines={1}>
                            Transacción: <Text style={{ color: '#fff', fontWeight: '900' }}>{txCodeDisplay}</Text>
                          </Text>
                          <TouchableOpacity
                            onPress={async () => {
                              try {
                                await Clipboard.setStringAsync(txCodeDisplay);
                                if (Platform.OS === 'android') ToastAndroid.show('Transacción copiada', ToastAndroid.SHORT);
                              } catch (_e) {
                                // ignore
                              }
                            }}
                            style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}
                            activeOpacity={0.85}
                          >
                            <Ionicons name="copy-outline" size={16} color="#e2e8f0" />
                          </TouchableOpacity>
                        </View>

                        <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#cbd5e1', fontSize: 12 }}>Usuario</Text>
                            <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={1}>{tx?.user?.name || '—'}</Text>
                            <Text style={{ color: '#cbd5e1', fontSize: 12 }} numberOfLines={1}>{tx?.user?.email || '—'}</Text>
                            {tx?.reference ? (
                              <Text style={{ color: '#cbd5e1', fontSize: 12 }} numberOfLines={1}>Ref: {tx.reference}</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: '#fff', fontWeight: '900' }}>{Number(tx?.amount || 0).toFixed(2)} {tx?.currency || 'USD'}</Text>
                            {tx?.provider ? (
                              <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={1}>{tx.provider}</Text>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={{ color: '#94a3b8', textAlign: 'center', marginVertical: 20 }}>No hay movimientos.</Text>
                  }
                />
              )}
            </View>
        ) : (
        <>
        <ScrollView contentContainerStyle={styles.scroll}>
          
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
                        if (item.requiresSuperadmin && !isSuperadmin) {
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
              <SectionErrorBoundary label="Gestión de Rifas: formulario">
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                      </TouchableOpacity>
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

              <TextInput
                style={styles.input}
                placeholder="Total tickets"
                value={raffleForm.totalTickets}
                onChangeText={(v) => setRaffleForm((s) => ({ ...s, totalTickets: v }))}
                keyboardType="numeric"
                autoComplete="off"
                importantForAutofill="no"
                autoCorrect={false}
                autoCapitalize="none"
              />
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
                placeholder="Números ganadores instantáneos (ej: 10, 50, 100)"
                value={raffleForm.instantWins}
                onChangeText={(v) => setRaffleForm((s) => ({ ...s, instantWins: v }))}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                autoComplete="off"
                importantForAutofill="no"
                autoCorrect={false}
                autoCapitalize="none"
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

              {/* SECCIÓN DE PERSONALIZACIÓN (ESTILO) */}
              <Text style={[styles.section, { marginTop: 24, color: '#60a5fa' }]}>Personalización Visual</Text>
              
              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginBottom: 4 }}>Banner Promocional</Text>
              <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickBanner}>
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>{styleForm.bannerImage ? 'Cambiar Banner' : 'Subir Banner'}</Text>
              </TouchableOpacity>
              {styleForm.bannerImage ? (
                <View style={{ position: 'relative', marginBottom: 12 }}>
                  <Image source={{ uri: styleForm.bannerImage }} style={{ width: '100%', height: 140, borderRadius: 8, backgroundColor: '#000' }} resizeMode="contain" />
                  <TouchableOpacity 
                    onPress={() => setStyleForm(s => ({ ...s, bannerImage: '' }))}
                    style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 6 }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginBottom: 4 }}>Galería de Imágenes</Text>
              <Text style={[styles.muted, { marginBottom: 8, fontSize: 12 }]}>Máx {MAX_GALLERY_IMAGES} fotos adicionales.</Text>
              <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickGalleryImage}>
                <Ionicons name="images-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>Agregar Foto</Text>
              </TouchableOpacity>
              
              {Array.isArray(styleForm.gallery) && styleForm.gallery.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {styleForm.gallery.map((img, index) => (
                    <View key={index} style={{ marginRight: 8, position: 'relative' }}>
                      <Image source={{ uri: img }} style={{ width: 100, height: 100, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' }} resizeMode="cover" />
                      <TouchableOpacity 
                        onPress={() => removeGalleryImage(index)}
                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                      >
                        <Ionicons name="trash-outline" size={16} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}

              <Text style={{ color: palette.secondary, fontWeight: 'bold', marginBottom: 8 }}>Color del Tema</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                {['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#db2777'].map(c => (
                  <TouchableOpacity 
                    key={c} 
                    onPress={() => setStyleForm(s => ({ ...s, themeColor: c }))}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 2, borderColor: styleForm.themeColor === c ? '#fff' : 'transparent' }}
                  />
                ))}
              </View>

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
                    <TextInput
                      style={styles.input}
                      placeholder="Teléfono (0412...)"
                      value={bankSettings.phone}
                      onChangeText={(v) => setBankSettings(s => ({ ...s, phone: v }))}
                      keyboardType="phone-pad"
                      autoComplete="off"
                      importantForAutofill="no"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <TextInput style={styles.input} placeholder="Titular" value={bankSettings.accountName} onChangeText={(v) => setBankSettings(s => ({ ...s, accountName: v }))} />
                  </View>
                )}
              </View>

              {/* Otros Métodos (Placeholders) */}
              {[{ key: 'zelle', label: 'Zelle', icon: 'cash-outline' }, { key: 'binance', label: 'Binance', icon: 'logo-bitcoin' }, { key: 'transfer', label: 'Transferencia', icon: 'card-outline' }].map(({ key, label, icon }) => {
                const methods = raffleForm.paymentMethods || [];
                const enabled = methods.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => {
                      const next = enabled ? methods.filter(m => m !== key) : [...methods, key];
                      setRaffleForm(s => ({ ...s, paymentMethods: next }));
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: enabled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Ionicons name={icon} size={24} color={enabled ? '#10b981' : '#94a3b8'} />
                      <Text style={{ color: enabled ? '#fff' : '#94a3b8', fontWeight: 'bold' }}>{label}</Text>
                    </View>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: enabled ? '#10b981' : '#94a3b8', alignItems: 'center', justifyContent: 'center' }}>
                      {enabled && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />}
                    </View>
                  </TouchableOpacity>
                );
              })}


              <View style={{ flexDirection: 'row', gap: 8, marginTop: 24 }}>
                <FilledButton
                  title={savingRaffle ? 'Guardando...' : raffleForm.id ? 'Actualizar rifa' : 'Crear rifa'}
                  onPress={openPublishPreview}
                  loading={savingRaffle}
                  disabled={savingRaffle}
                  icon={<Ionicons name={raffleForm.id ? 'create-outline' : 'add-circle-outline'} size={18} color="#fff" />}
                />
                {raffleForm.id ? (
                  <OutlineButton title="Nueva" onPress={resetRaffleDraft} icon={<Ionicons name="refresh-outline" size={18} color={palette.primary} />} />
                ) : null}
              </View>

              <Modal visible={publishPreviewVisible} transparent animationType="slide" onRequestClose={() => setPublishPreviewVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
                  <TouchableOpacity activeOpacity={1} onPress={() => setPublishPreviewVisible(false)} style={{ flex: 1 }}>
                    <View style={{ flex: 1 }} />
                  </TouchableOpacity>

                  <View style={{ backgroundColor: '#0b1220', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', maxHeight: '92%' }}>
                    <View style={{ paddingTop: 10, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                      <View style={{ alignItems: 'center' }}>
                        <View style={{ width: 48, height: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' }} />
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Vista previa</Text>
                        <TouchableOpacity onPress={() => setPublishPreviewVisible(false)} style={{ padding: 6 }}>
                          <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                      </View>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                        Al publicar, el rifero no podrá eliminar su rifa.
                      </Text>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                      {(() => {
                        const item = buildPreviewRaffle();
                        const gallery = Array.isArray(item.style?.gallery) ? item.style.gallery : [];
                        const sellerName = item.user?.name || 'MegaRifas';
                        const previewWidth = Dimensions.get('window').width;
                        return (
                          <View>
                            {/* Header tipo feed */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                              <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                                {item.user?.avatar ? (
                                  <Image source={{ uri: item.user.avatar }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                                ) : (
                                  <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>{String(sellerName).charAt(0).toUpperCase() || 'M'}</Text>
                                )}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{sellerName}</Text>
                                <Text style={{ color: '#94a3b8', fontSize: 11 }} numberOfLines={1}>Así se verá en Rifas</Text>
                              </View>
                            </View>

                            {/* Imagen */}
                            <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}>
                              {gallery.length > 0 ? (
                                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                                  {gallery.map((img, idx) => (
                                    <Image
                                      key={idx}
                                      source={{ uri: img }}
                                      style={{ width: previewWidth, height: '100%', backgroundColor: '#000' }}
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

                            {/* Contenido */}
                            <View style={{ padding: 12 }}>
                              <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }} numberOfLines={1}>{item.title}</Text>
                              <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }} numberOfLines={3}>
                                <Text style={{ fontWeight: 'bold', color: '#fff' }}>{sellerName} </Text>
                                {item.description}
                              </Text>

                              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{formatMoneyVES(item.price, { decimals: 0 })}</Text>
                                {item.totalTickets ? (
                                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>{item.totalTickets} tickets</Text>
                                ) : (
                                  <Text style={{ color: '#94a3b8', fontSize: 12 }}>Tickets: —</Text>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })()}
                    </ScrollView>

                    <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', gap: 10 }}>
                      <OutlineButton title="Cancelar" onPress={() => setPublishPreviewVisible(false)} />
                      <FilledButton
                        title="Publicar"
                        onPress={() => {
                          setPublishPreviewVisible(false);
                          submitRaffle();
                        }}
                        icon={<Ionicons name="rocket-outline" size={18} color="#fff" />}
                      />
                    </View>
                  </View>
                </View>
              </Modal>

              {(() => {
                const p = profile?.adminPlan || null;
                const tier = String(p?.tier || '').toLowerCase();
                const credits = typeof p?.raffleCreditsRemaining === 'number' ? p.raffleCreditsRemaining : null;
                const boosts = typeof p?.boostCreditsRemaining === 'number' ? p.boostCreditsRemaining : null;
                if (!tier) return null;
                return (
                  <View style={{ marginTop: 16, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Plan: {tier.toUpperCase()}</Text>
                    <Text style={{ color: palette.muted, fontSize: 12 }}>
                      {tier === 'unlimited' ? 'Límite: rifas por semana (según configuración)' : `Cupos restantes: ${credits ?? '—'}`}
                      {boosts !== null ? `  •  Boosts: ${boosts}` : ''}
                    </Text>
                  </View>
                );
              })()}

                </>
              </SectionErrorBoundary>

              <SectionErrorBoundary label="Gestión de Rifas: listado">
                <>
                  <Text style={[styles.section, { marginTop: 12 }]}>Rifas Existentes</Text>
                  {(Array.isArray(raffles) ? raffles : []).filter((r) => r).map((r, idx) => {
                      const sold = Number(r?.soldTickets) || 0;
                      const totalRaw = Number(r?.totalTickets);
                      const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : 100;
                      const percent = total > 0 ? (sold / total) * 100 : 0;
                      const boost = r?.style?.boost;
                      const boostExp = boost?.expiresAt ? Date.parse(boost.expiresAt) : 0;
                      const boostActive = Number.isFinite(boostExp) && boostExp > Date.now();
                      const status = String(r?.status || 'active').toLowerCase();
                      const statusLabel = status === 'draft' ? 'BORRADOR' : status === 'closed' ? 'CERRADA' : 'ACTIVA';
                      
                      return (
                      <View key={String(r?.id ?? idx)} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{String(r?.title ?? '')}</Text>
                            <Text style={{ color: palette.muted, fontSize: 12 }}>ID: {String(r?.id ?? '')} • {statusLabel}</Text>
                            {boostActive && (
                              <Text style={{ color: '#fbbf24', fontSize: 12, marginTop: 2 }}>
                                Destacada hasta: {new Date(boostExp).toLocaleString()}
                              </Text>
                            )}
                            <View style={{ marginTop: 6 }}>
                              <ProgressBar progress={percent} color={percent > 75 ? '#4ade80' : percent > 40 ? '#fbbf24' : '#f87171'} />
                              <Text style={{ color: '#cbd5e1', fontSize: 10 }}>Vendidos: {sold}/{total} ({percent.toFixed(1)}%)</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                            <TouchableOpacity onPress={() => {
                              setRaffleForm({
                                id: r.id,
                                title: String(r?.title ?? ''),
                                price: String(r.price),
                                description: r.description || '',
                                totalTickets: String(r.totalTickets),
                                startDate: r.startDate ? r.startDate.split('T')[0] : '',
                                endDate: r.endDate ? r.endDate.split('T')[0] : '',
                                securityCode: r.securityCode || '',
                                lottery: r.lottery || '',
                                instantWins: formatInstantWinsForInput(r.instantWins),
                                terms: r.terms || '',
                                digits: r.digits || 4,
                                minTickets: String(r.minTickets || '1'),
                                paymentMethods: (Array.isArray(r.paymentMethods) && r.paymentMethods.length) ? r.paymentMethods : ['mobile_payment']
                              });
                              // Pre-load style form as well
                              setStyleForm({
                                raffleId: r.id,
                                bannerImage: r.style?.bannerImage || '',
                                gallery: ensureArray(r.style?.gallery),
                                themeColor: r.style?.themeColor || '#2563eb',
                                whatsapp: r.style?.whatsapp || '',
                                instagram: r.style?.instagram || ''
                              });
                            }} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 }}>
                              <Ionicons name="create-outline" size={20} color="#fff" />
                            </TouchableOpacity>
                            
                            {status !== 'closed' && (
                              <TouchableOpacity onPress={() => openWinnerModal(r.id)} style={{ padding: 8, backgroundColor: 'rgba(251, 191, 36, 0.2)', borderRadius: 8 }}>
                                <Ionicons name="trophy-outline" size={20} color="#fbbf24" />
                              </TouchableOpacity>
                            )}

                            {status === 'draft' && (
                              <TouchableOpacity
                                onPress={() => activateRaffle(r.id)}
                                disabled={activatingRaffleId === r.id}
                                style={{
                                  padding: 8,
                                  backgroundColor: 'rgba(34, 197, 94, 0.18)',
                                  borderRadius: 8,
                                  opacity: activatingRaffleId === r.id ? 0.6 : 1
                                }}
                              >
                                <Ionicons name="play-outline" size={20} color="#22c55e" />
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              onPress={() => boostRaffle(r.id)}
                              disabled={boostingRaffleId === r.id || status !== 'active'}
                              style={{
                                padding: 8,
                                backgroundColor: boostActive ? 'rgba(251, 191, 36, 0.25)' : 'rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                opacity: boostingRaffleId === r.id || status !== 'active' ? 0.6 : 1
                              }}
                            >
                              <Ionicons name={boostActive ? 'star' : 'star-outline'} size={20} color={boostActive ? '#fbbf24' : '#fff'} />
                            </TouchableOpacity>

                            {isSuperadmin && (
                              <TouchableOpacity onPress={() => deleteRaffle(r.id)} style={{ padding: 8, backgroundColor: 'rgba(248, 113, 113, 0.2)', borderRadius: 8 }}>
                                <Ionicons name="trash-outline" size={20} color="#f87171" />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      </View>
                      )})}
                  </>
              </SectionErrorBoundary>
            </View>
          )}

          {activeSection === 'sa_tech_support' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
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







          {activeSection === 'news' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Novedades</Text>
              </View>
              
              <Text style={styles.section}>Publicar Nueva Noticia</Text>
              <TextInput style={styles.input} placeholder="Título del anuncio" value={announcementForm.title} onChangeText={(v) => setAnnouncementForm(s => ({ ...s, title: v }))} />
              <TextInput style={[styles.input, { height: 80 }]} placeholder="Contenido del mensaje..." value={announcementForm.content} onChangeText={(v) => setAnnouncementForm(s => ({ ...s, content: v }))} multiline />
              
              <TouchableOpacity style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]} onPress={pickAnnouncementImage}>
                <Ionicons name="image-outline" size={18} color={palette.primary} />
                <Text style={[styles.secondaryText, { marginLeft: 8 }]}>{announcementForm.imageUrl ? 'Cambiar Imagen' : 'Adjuntar Imagen'}</Text>
              </TouchableOpacity>
              {announcementForm.imageUrl && <Image source={{ uri: announcementForm.imageUrl }} style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 12, backgroundColor: '#000' }} resizeMode="contain" />}

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
                  <TouchableOpacity onPress={() => setActiveSection(null)} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Cerrar</Text>
                  </TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Dashboard</Text>
              </View>

              <Text style={styles.section}>Rifa</Text>
                <TouchableOpacity onPress={() => setRafflePickerVisible(true)} style={[styles.input, { justifyContent: 'center' }]}>
                  <Text style={{ color: selectedRaffle ? '#fff' : '#94a3b8' }}>{selectedRaffle?.title || 'Seleccionar Rifa'}</Text>
                  <Ionicons name="chevron-down-outline" size={20} color="#94a3b8" style={{ position: 'absolute', right: 12 }} />
              </TouchableOpacity>

                <TouchableOpacity
                  onPress={loadMetrics}
                  style={{ marginTop: 10, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center' }}
                  activeOpacity={0.85}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{metricsLoading ? 'Actualizando...' : 'Actualizar métricas'}</Text>
                </TouchableOpacity>

              {metricsLoading ? (
                <ActivityIndicator color={palette.primary} style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <CollapsibleCard
                    title="Resumen"
                    rightText={selectedRaffle?.title ? `Rifa: ${selectedRaffle.title}` : 'Rifa: todas / sin seleccionar'}
                    expanded={dashboardPanels.summary}
                    onToggle={() => setDashboardPanels((s) => ({ ...s, summary: !s.summary }))}
                  >
                    {metricsSummary ? (
                      <View style={{ flexWrap: 'wrap', flexDirection: 'row', gap: 10, marginTop: 6 }}>
                        {[{ label: 'Participantes', value: metricsSummary.participants ?? 0 },
                          { label: 'Tickets vendidos', value: metricsSummary.ticketsSold ?? 0 },
                          { label: 'Pendientes', value: metricsSummary.pendingPayments ?? 0 },
                          { label: 'Recaudado', value: `Bs. ${(metricsSummary.totalRevenue || 0).toFixed(2)}` },
                          { label: 'Ventas hoy', value: metricsSummary.todaySales ?? 0 },
                          { label: 'Recaudado hoy', value: `Bs. ${(metricsSummary.todayRevenue || 0).toFixed(2)}` }].map(card => (
                            <View key={card.label} style={{ flexBasis: '48%', backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                              <Text style={{ color: '#94a3b8', fontSize: 12 }}>{card.label}</Text>
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18, marginTop: 4 }}>{card.value}</Text>
                            </View>
                          ))}
                      </View>
                    ) : (
                      <Text style={{ color: palette.muted }}>Sin datos de métricas.</Text>
                    )}
                  </CollapsibleCard>

                  {(() => {
                    const r = selectedRaffle || raffles[0];
                    const sold = r?.soldTickets || 0;
                    const total = r?.totalTickets || 100;
                    const percent = total > 0 ? (sold / total) * 100 : 0;
                    const label = r?.title || 'Sin rifa seleccionada';
                    return (
                      <CollapsibleCard
                        title="Estado de la rifa"
                        rightText={label}
                        expanded={dashboardPanels.raffle}
                        onToggle={() => setDashboardPanels((s) => ({ ...s, raffle: !s.raffle }))}
                      >
                        <Text style={{ color: palette.muted, fontSize: 12 }}>Ticket: Bs. {r?.price || r?.ticketPrice || 0} • Cierre: {r?.endDate ? r.endDate.split('T')[0] : '—'}</Text>
                        {r?.style?.bannerImage ? (
                          <Image source={{ uri: r.style.bannerImage }} style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 10 }} resizeMode="cover" />
                        ) : null}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                          <Text style={{ color: '#cbd5e1' }}>Vendidos: {sold}/{total}</Text>
                          <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{percent.toFixed(1)}%</Text>
                        </View>
                        <ProgressBar progress={percent} color={percent > 75 ? '#4ade80' : percent > 40 ? '#fbbf24' : '#f87171'} />
                      </CollapsibleCard>
                    );
                  })()}

                  <CollapsibleCard
                    title="Ventas por hora (hoy)"
                    rightText={metricsHourly.length ? `Registros: ${metricsHourly.length}` : 'Sin datos'}
                    expanded={dashboardPanels.hourly}
                    onToggle={() => setDashboardPanels((s) => ({ ...s, hourly: !s.hourly }))}
                  >
                    {metricsHourly.length === 0 ? (
                      <Text style={{ color: palette.muted }}>Sin ventas registradas hoy.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                        {(() => {
                          const rows = metricsHourly.filter(Boolean);
                          const max = Math.max(1, ...rows.map((x) => x?.count || 0));
                          return rows.map((h) => {
                            const height = Math.max(4, ((h?.count || 0) / max) * 80);
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
                  </CollapsibleCard>

                  <CollapsibleCard
                    title="Ventas últimos 7 días"
                    rightText={metricsDaily.length ? `Días: ${metricsDaily.length}` : 'Sin datos'}
                    expanded={dashboardPanels.daily}
                    onToggle={() => setDashboardPanels((s) => ({ ...s, daily: !s.daily }))}
                  >
                    {metricsDaily.length === 0 ? (
                      <Text style={{ color: palette.muted }}>Sin datos.</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 }}>
                        {(() => {
                          const rows = metricsDaily.filter(Boolean);
                          const max = Math.max(1, ...rows.map((d) => d?.count || 0));
                          return rows.map((d, idx) => {
                            const h = Math.max(4, ((d?.count || 0) / max) * 80);
                            const key = d?.date ? String(d.date) : `d-${idx}`;
                            const label = d?.date ? String(d.date).slice(5) : '—';
                            return (
                              <View key={key} style={{ flex: 1, alignItems: 'center', marginHorizontal: 2 }}>
                                <View style={{ width: '70%', height: h, backgroundColor: '#60a5fa', borderRadius: 6 }} />
                                <Text style={{ color: '#94a3b8', fontSize: 8, marginTop: 4 }}>{label}</Text>
                              </View>
                            );
                          });
                        })()}
                      </View>
                    )}
                  </CollapsibleCard>

                  <CollapsibleCard
                    title="Ventas por estado"
                    rightText={metricsByState.length ? `Estados: ${metricsByState.length}` : 'Sin datos'}
                    expanded={dashboardPanels.byState}
                    onToggle={() => setDashboardPanels((s) => ({ ...s, byState: !s.byState }))}
                  >
                    {metricsByState.length === 0 ? <Text style={{ color: palette.muted }}>Sin datos.</Text> : metricsByState.filter(Boolean).slice(0, 8).map((s, idx) => {
                      const max = Math.max(1, ...metricsByState.filter(Boolean).map((row) => row?.count || 0));
                      const count = Number(s?.count) || 0;
                      const width = Math.max(6, (count / max) * 100);
                      const stateLabel = String(s?.state || '—');
                      return (
                        <View key={`${stateLabel}-${idx}`} style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#e2e8f0' }}>{stateLabel}</Text>
                            <Text style={{ color: '#94a3b8' }}>{count}</Text>
                          </View>
                          <View style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                            <View style={{ width: `${width}%`, height: '100%', backgroundColor: '#a78bfa' }} />
                          </View>
                        </View>
                      );
                    })}
                  </CollapsibleCard>

                  <CollapsibleCard
                    title="Top de compra"
                    rightText={metricsTop.length ? `Usuarios: ${metricsTop.length}` : 'Sin datos'}
                    expanded={dashboardPanels.top}
                    onToggle={() => setDashboardPanels((s) => ({ ...s, top: !s.top }))}
                  >
                    {metricsTop.length === 0 ? <Text style={{ color: palette.muted }}>Sin datos.</Text> : metricsTop.filter(u => u).map((u, idx) => (
                      <View key={u.userId || idx} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={{ color: '#fff', fontWeight: '700' }}>{idx + 1}. {String(u?.name || '—')}</Text>
                          <Text style={{ color: '#94a3b8', fontSize: 12 }}>{u?.email || '—'} • {String(u?.state || '—')}</Text>
                        </View>
                        <Text style={{ color: '#fbbf24', fontWeight: '800' }}>{Number(u?.tickets) || 0}</Text>
                      </View>
                    ))}
                  </CollapsibleCard>
                </>
              )}
            </View>
          )}









          <Modal visible={proofViewer.visible} transparent animationType="fade" onRequestClose={closeProofViewer}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <TouchableOpacity onPress={closeProofViewer} style={{ position: 'absolute', top: 40, right: 20, padding: 10 }}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              {proofViewer.uri ? (
                <>
                  {proofImageLoading ? <ActivityIndicator color="#fff" style={{ marginBottom: 12 }} /> : null}
                  <Image
                    source={{ uri: proofViewer.uri }}
                    style={{ width: '90%', height: '70%', borderRadius: 12, opacity: proofImageLoading ? 0.6 : 1 }}
                    resizeMode="contain"
                    onLoadEnd={() => setProofImageLoading(false)}
                    onError={() => {
                      setProofImageLoading(false);
                      setProofImageError(true);
                    }}
                  />

                  {proofImageError ? (
                    <Text style={{ color: '#fff', marginTop: 10, textAlign: 'center' }}>
                      No se pudo cargar el comprobante.
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await Linking.openURL(proofViewer.uri);
                      } catch (_e) {
                        Alert.alert('Error', 'No se pudo abrir el comprobante.');
                      }
                    }}
                    style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.10)' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>Abrir en navegador</Text>
                  </TouchableOpacity>
                </>
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
              <TextInput style={styles.input} placeholder="From Name (MegaRifas)" value={smtpForm.fromName} onChangeText={(v) => setSmtpForm(s => ({ ...s, fromName: v }))} />
              <TextInput style={styles.input} placeholder="From Email (no-reply@megarifas.com.ve)" value={smtpForm.fromEmail} onChangeText={(v) => setSmtpForm(s => ({ ...s, fromEmail: v }))} autoCapitalize="none" />
              
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

          {activeSection === 'sa_reports' && (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setActiveSection(null)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Denuncias y reportes</Text>
              </View>

              <Text style={styles.muted}>Se muestran reportes abiertos (pendientes de revisión).</Text>

              {reportsLoading ? (
                <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                  <ActivityIndicator color={palette.primary} />
                  <Text style={[styles.muted, { marginTop: 10 }]}>Cargando...</Text>
                </View>
              ) : reports && reports.length ? (
                reports.map((r) => (
                  <View key={r.id} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14, flex: 1 }} numberOfLines={2}>{String(r.reason || 'Reporte')}</Text>
                      <Text style={{ color: palette.muted, fontSize: 10 }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</Text>
                    </View>

                    <View style={{ marginTop: 8 }}>
                      <Text style={{ color: '#cbd5e1', fontSize: 12 }} numberOfLines={2}>
                        Reportado: {r?.reported?.name || '—'} ({r?.reported?.email || '—'})
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={2}>
                        Reportado por: {r?.reporter?.name || '—'} ({r?.reporter?.email || '—'})
                      </Text>
                      {r?.raffle?.title ? (
                        <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={2}>
                          Rifa: {r.raffle.title}
                        </Text>
                      ) : null}
                      {r?.details ? (
                        <Text style={{ color: '#e2e8f0', fontSize: 12, marginTop: 6 }}>
                          {String(r.details)}
                        </Text>
                      ) : null}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                      <TouchableOpacity
                        onPress={() => setReportStatus(r.id, 'reviewed')}
                        disabled={actingReportId === r.id}
                        style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.18)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', paddingVertical: 10, borderRadius: 10, alignItems: 'center', opacity: actingReportId === r.id ? 0.6 : 1 }}
                      >
                        <Text style={{ color: '#bbf7d0', fontWeight: '900' }}>Revisado</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setReportStatus(r.id, 'resolved')}
                        disabled={actingReportId === r.id}
                        style={{ flex: 1, backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)', paddingVertical: 10, borderRadius: 10, alignItems: 'center', opacity: actingReportId === r.id ? 0.6 : 1 }}
                      >
                        <Text style={{ color: '#bfdbfe', fontWeight: '900' }}>Resuelto</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setReportStatus(r.id, 'dismissed')}
                        disabled={actingReportId === r.id}
                        style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.18)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingVertical: 10, borderRadius: 10, alignItems: 'center', opacity: actingReportId === r.id ? 0.6 : 1 }}
                      >
                        <Text style={{ color: '#fecaca', fontWeight: '900' }}>Descartar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Ionicons name="flag-outline" size={48} color={palette.muted} />
                    <Text style={{ color: palette.muted, marginTop: 12 }}>No hay reportes pendientes.</Text>
                </View>
              )}
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
                  <Text style={[styles.title, { marginBottom: 0, marginLeft: 12, fontSize: 20 }]}>Perfil</Text>
              </View>

              <Text style={styles.section}>Legal</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}
                onPress={() => navigation.navigate('Legal')}
              >
                <Ionicons name="document-text-outline" size={22} color={palette.primary} />
                <Text style={{ color: palette.text, marginLeft: 12, fontSize: 16 }}>Términos, Privacidad y Marco Legal</Text>
                <Ionicons name="chevron-forward" size={20} color={palette.muted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

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

              <View style={{ marginTop: 18, gap: 12 }}>
                <FilledButton
                  title="Cerrar sesión"
                  onPress={typeof onLogout === 'function' ? onLogout : undefined}
                  style={{ backgroundColor: '#ef4444' }}
                  icon={<Ionicons name="log-out-outline" size={18} color="#fff" />}
                />
                <TouchableOpacity onPress={deleteAccount} style={{ padding: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#94a3b8', fontSize: 14, textDecorationLine: 'underline' }}>
                    Eliminar cuenta
                  </Text>
                </TouchableOpacity>
              </View>
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
                  Alert.alert('Enviado', 'Hemos registrado tu reporte. Te notificaremos cuando haya una actualización.');
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

        <Modal
          animationType="slide"
          transparent={true}
          visible={winnerModalVisible}
          onRequestClose={() => setWinnerModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Declarar Ganador</Text>
              <Text style={{ color: '#94a3b8', marginBottom: 20 }}>Ingresa el número ganador de la lotería o sorteo.</Text>
              
              <TextInput
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', padding: 16, borderRadius: 12, fontSize: 24, textAlign: 'center', fontWeight: 'bold', marginBottom: 20, borderWidth: 1, borderColor: '#fbbf24' }}
                placeholder="0000"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                value={winningNumberInput}
                onChangeText={setWinningNumberInput}
                maxLength={6}
              />

              <TouchableOpacity onPress={pickWinnerPhoto} style={{ marginBottom: 20, alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#94a3b8' }}>
                {winnerPhoto ? (
                  <Image source={{ uri: winnerPhoto.uri }} style={{ width: 100, height: 100, borderRadius: 8 }} />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={24} color="#94a3b8" />
                    <Text style={{ color: '#94a3b8', marginTop: 8 }}>Subir Foto del Ganador (Opcional)</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  onPress={() => setWinnerModalVisible(false)}
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={declareWinner}
                  disabled={declaringWinner}
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#fbbf24', alignItems: 'center', opacity: declaringWinner ? 0.7 : 1 }}
                >
                  {declaringWinner ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={{ color: '#0b1224', fontWeight: '800' }}>CONFIRMAR</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        </>
        )}
        </SafeAreaView>
      </AdminScreenErrorBoundary>
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
