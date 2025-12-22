import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ENV } from '../config/env';
import { palette } from '../theme';
import { HeroBanner, FilledButton, OutlineButton } from '../components/UI';

const APP_SLOGAN = 'Buena suerte.';

const getAppVersionLabel = () => {
  const version = Constants?.expoConfig?.version || Constants?.manifest?.version;
  const androidCode = Constants?.expoConfig?.android?.versionCode;
  if (version && androidCode) return `v${version} (${androidCode})`;
  if (version) return `v${version}`;
  return 'v—';
};

const VENEZUELA_STATES = [
  'Amazonas', 'Anzoategui', 'Apure', 'Aragua', 'Barinas', 'Bolivar', 'Carabobo', 'Cojedes',
  'Delta Amacuro', 'Distrito Capital', 'Falcon', 'Guarico', 'Lara', 'Merida', 'Miranda',
  'Monagas', 'Nueva Esparta', 'Portuguesa', 'Sucre', 'Tachira', 'Trujillo', 'Vargas',
  'Yaracuy', 'Zulia'
];

const API_URL = ENV.apiUrl;

import { useNavigation } from '@react-navigation/native';

export default function AuthScreen({ onAuth }) {
  const navigation = useNavigation();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [twofaNeeded, setTwofaNeeded] = useState(false);
  const [twofaUserId, setTwofaUserId] = useState(null);
  const [twofaCode, setTwofaCode] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showVerification, setShowVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const heroAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    state: '',
    address: '',
    dob: '',
    cedula: '',
    phone: '',
    referralCode: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const handleChange = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const dateToIsoDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isoDateToDisplay = (iso) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(iso || ''));
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  const isoDateToLocalDate = (iso) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(String(iso || ''));
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const dt = new Date(year, month - 1, day);
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  };

  useEffect(() => {
    Animated.timing(heroAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true
    }).start();
  }, [heroAnim]);

  const openDobPicker = () => {
    setShowDobPicker(true);
  };

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  const handleLogin = async () => {
    const errors = {};
    if (!form.email) errors.email = true;
    if (!form.password) errors.password = true;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError('');
    try {
      const email = normalizeEmail(form.email);
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: form.password })
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'No se pudo iniciar sesión';
        throw new Error(msg);
      }

      if (data.require2FA) {
        setTwofaNeeded(true);
        setTwofaUserId(normalizeEmail(data.email || email));
        Alert.alert('Seguridad', 'Se ha enviado un código de seguridad a tu correo.');
        setLoading(false);
        return;
      }

      const token = data.token || data.accessToken;
      const refreshToken = data.refreshToken || token;
      const fallbackName = String(email || '').split('@')[0] || 'Usuario';
      const user = data.user || {
        email,
        name: fallbackName,
        role: 'user'
      };
      
      await onAuth(token, refreshToken, user, rememberMe);
      
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    const errors = {};
    if (!form.email) errors.email = true;
    if (!form.password) errors.password = true;
    if (!form.firstName) errors.firstName = true;
    if (!form.lastName) errors.lastName = true;
    if (!form.state) errors.state = true;
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    if (!termsAccepted) {
      Alert.alert('Atención', 'Debes aceptar que MegaRifas es solo una herramienta de gestión y no organiza sorteos.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const email = normalizeEmail(form.email);
      const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, email })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo registrar');
      }
      
      // Auto-login after register or show verification
      Alert.alert('Registro Exitoso', 'Por favor verifica tu correo electrónico para activar tu cuenta.');
      setMode('login');
      setShowVerification(true);
      setVerifyEmail(email);
      
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };


  const handleVerify = async () => {
    const email = normalizeEmail(verifyEmail);
    if (!email || !verifyCode) {
      setError('Ingresa tu email y el código.');
      return;
    }
    setVerifyLoading(true);
    setError('');
    setVerifyMessage('');
    try {
      const res = await fetch(`${API_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verifyCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
      setVerifyMessage(data.message || 'Cuenta verificada. Inicia sesión.');
      Alert.alert('Cuenta verificada', 'Ahora puedes iniciar sesión.');
      setShowVerification(false);
      setMode('login');
    } catch (err) {
      setError(err.message);
    }
    setVerifyLoading(false);
  };

  const handleResend = async () => {
    const email = normalizeEmail(verifyEmail);
    if (!email) {
      setError('Ingresa tu email para reenviar el código.');
      return;
    }
    setResendLoading(true);
    setError('');
    setVerifyMessage('');
    try {
      const res = await fetch(`${API_URL}/auth/verify/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo reenviar');
      setVerifyMessage(data.message || 'Código reenviado. Revisa tu correo.');
    } catch (err) {
      setError(err.message);
    }
    setResendLoading(false);
  };

  const handleRecovery = async () => {
    const email = normalizeEmail(recoveryEmail);
    if (!email) {
      setError('Ingresa tu correo para recuperarlo.');
      return;
    }
    setRecoveryLoading(true);
    setError('');
    setRecoveryMessage('');
    try {
      const res = await fetch(`${API_URL}/auth/password/reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la recuperación');
      setRecoveryMessage(data.message || 'Hemos enviado instrucciones a tu correo.');
    } catch (err) {
      setError(err.message);
    }
    setRecoveryLoading(false);
  };

  const verify2fa = async () => {
    const email = normalizeEmail(twofaUserId);
    if (!email || !twofaCode) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: twofaCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código incorrecto');
        const token = data.token || data.accessToken;
        const refreshToken = data.refreshToken || token;
        await onAuth(token, refreshToken, data.user, rememberMe);
      setTwofaNeeded(false);
      setTwofaCode('');
      setTwofaUserId(null);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const submit = () => {
    if (twofaNeeded) return verify2fa();
    if (mode === 'login') return handleLogin();
    return handleRegister();
  };

  const pressIn = () => Animated.spring(buttonScale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(buttonScale, { toValue: 1, useNativeDriver: true }).start();

  const renderVerification = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.background, '#1e1b4b', palette.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { justifyContent: 'center' }]}>            
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={{ marginBottom: 40 }}>
                <HeroBanner />
              </View>
            </Animated.View>
            <View style={[styles.card, { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: 'transparent' }]}
                placeholder="Email"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                value={verifyEmail}
                onChangeText={setVerifyEmail}
                placeholderTextColor={palette.muted}
              />
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: 'transparent' }]}
                placeholder="Código de 6 dígitos"
                keyboardType="numeric"
                value={verifyCode}
                onChangeText={setVerifyCode}
                placeholderTextColor={palette.muted}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {verifyMessage ? <Text style={styles.successText}>{verifyMessage}</Text> : null}
              <FilledButton
                title={verifyLoading ? 'Verificando...' : 'Confirmar cuenta'}
                onPress={handleVerify}
                disabled={verifyLoading}
                icon={<Ionicons name="shield-checkmark-outline" size={18} color="#fff" />}
              />
              <View style={{ marginTop: 12 }}>
                <OutlineButton
                  title={resendLoading ? 'Reenviando...' : 'Reenviar código'}
                  onPress={handleResend}
                  disabled={resendLoading}
                  icon={<Ionicons name="mail-outline" size={18} color={palette.primary} />}
                />
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowVerification(false);
                  setError('');
                  setVerifyMessage('');
                }}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={styles.link}>Volver a iniciar sesión</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );

  const renderLogin = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.background, '#1e1b4b', palette.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { justifyContent: 'center', minHeight: '100%' }]}>            
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
              <View style={{ marginBottom: 40 }}>
                <HeroBanner />
              </View>
            </Animated.View>

            {mode === 'login' ? (
              <View style={[styles.card, { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
                <View style={{ marginBottom: 10 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: palette.inputBg, borderColor: fieldErrors.email ? '#ef4444' : 'transparent', borderWidth: fieldErrors.email ? 1 : 0 }]}
                    placeholder="Correo electrónico"
                    autoCapitalize="none"
                    autoComplete="off"
                    textContentType="emailAddress"
                    value={form.email}
                    onChangeText={(v) => handleChange('email', v)}
                    placeholderTextColor={palette.muted}
                  />
                  {fieldErrors.email && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                </View>
                <View style={{ position: 'relative', marginBottom: 10 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: palette.inputBg, borderColor: fieldErrors.password ? '#ef4444' : 'transparent', borderWidth: fieldErrors.password ? 1 : 0, paddingRight: 50 }]}
                    placeholder="Contraseña"
                    secureTextEntry={!showPassword}
                    autoComplete="off"
                    textContentType="password"
                    value={form.password}
                    onChangeText={(v) => handleChange('password', v)}
                    placeholderTextColor={palette.muted}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: 14 }}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                  {fieldErrors.password && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                </View>

                {twofaNeeded ? (
                  <View style={{ marginTop: 4 }}>
                    <TextInput placeholder="Código de 6 dígitos" value={twofaCode} onChangeText={setTwofaCode} style={[styles.input, styles.inputSoft]} keyboardType="numeric" />
                  </View>
                ) : null}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {recoveryMessage ? <Text style={styles.successText}>{recoveryMessage}</Text> : null}

                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe((v) => !v)}
                >
                  <Ionicons name={rememberMe ? 'checkbox' : 'square-outline'} size={18} color="#e2e8f0" />
                  <Text style={styles.rememberText}>Mantener la cuenta abierta</Text>
                </TouchableOpacity>

                <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%', marginTop: 16 }}>
                  <FilledButton
                    title={loading ? 'Cargando...' : twofaNeeded ? 'Verificar código' : 'Entrar'}
                    onPress={submit}
                    disabled={loading}
                    icon={<Ionicons name="log-in-outline" size={18} color="#fff" />}
                  />
                </Animated.View>

                {!twofaNeeded ? (
                  <View style={{ marginTop: 12 }}>
                    <OutlineButton
                      title="¿Olvidaste tu contraseña?"
                      onPress={() => setShowRecovery(true)}
                      icon={<Ionicons name="help-circle-outline" size={18} color={palette.primary} />}
                    />
                  </View>
                ) : null}

                <View style={{ marginTop: 12 }}>
                  <OutlineButton
                    title="Crear cuenta nueva"
                    onPress={() => setMode('register')}
                    icon={<Ionicons name="person-add-outline" size={18} color={palette.primary} />}
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.card, styles.glassCard]}>
                <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 }}>Datos de Acceso</Text>
                <TextInput
                  style={[styles.input, styles.inputSoft]}
                  placeholder="Correo electrónico"
                  autoCapitalize="none"
                  autoComplete="off"
                  textContentType="emailAddress"
                  value={form.email}
                  onChangeText={(v) => handleChange('email', v)}
                  placeholderTextColor="#cbd5e1"
                />
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[styles.input, styles.inputSoft, { paddingRight: 50 }]}
                    placeholder="Contraseña"
                    secureTextEntry={!showPassword}
                    autoComplete="off"
                    textContentType="password"
                    value={form.password}
                    onChangeText={(v) => handleChange('password', v)}
                    placeholderTextColor="#cbd5e1"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 14, top: 14 }}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={24} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>

                <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 }}>Información Personal</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <TextInput 
                      style={[styles.input, styles.inputSoft, fieldErrors.firstName && { borderColor: '#ef4444', borderWidth: 1 }]} 
                      placeholder="Nombre" 
                      value={form.firstName} 
                      onChangeText={(v) => handleChange('firstName', v)} 
                      placeholderTextColor="#cbd5e1" 
                    />
                    {fieldErrors.firstName && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput 
                      style={[styles.input, styles.inputSoft, fieldErrors.lastName && { borderColor: '#ef4444', borderWidth: 1 }]} 
                      placeholder="Apellido" 
                      value={form.lastName} 
                      onChangeText={(v) => handleChange('lastName', v)} 
                      placeholderTextColor="#cbd5e1" 
                    />
                    {fieldErrors.lastName && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.input, styles.inputSoft, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, fieldErrors.state && { borderColor: '#ef4444', borderWidth: 1 }]}
                  onPress={() => setStatePickerVisible(true)}
                >
                  <Text style={{ color: form.state ? '#fff' : '#cbd5e1' }}>
                    {form.state || 'Selecciona tu estado (Venezuela)'}
                  </Text>
                  <Ionicons name="chevron-down-outline" size={18} color="#cbd5e1" />
                </TouchableOpacity>
                {fieldErrors.state && <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>* Requerido</Text>}
                <TextInput style={[styles.input, styles.inputSoft]} placeholder="Cédula de Identidad" value={form.cedula} onChangeText={(v) => handleChange('cedula', v)} keyboardType="numeric" placeholderTextColor="#cbd5e1" />
                <TouchableOpacity
                  style={[styles.input, styles.inputSoft, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={openDobPicker}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: form.dob ? '#fff' : '#cbd5e1' }}>
                    {form.dob ? isoDateToDisplay(form.dob) : 'Fecha de nacimiento'}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color="#cbd5e1" />
                </TouchableOpacity>

                {showDobPicker ? (
                  <DateTimePicker
                    value={isoDateToLocalDate(form.dob) || new Date(new Date().getFullYear() - 18, 0, 1)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    maximumDate={new Date()}
                    onChange={(event, selectedDate) => {
                      if (Platform.OS === 'android') setShowDobPicker(false);
                      if (event?.type === 'dismissed') return;
                      if (!selectedDate) return;
                      handleChange('dob', dateToIsoDate(selectedDate));
                    }}
                  />
                ) : null}
                
                <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 }}>Contacto</Text>
                <TextInput style={[styles.input, styles.inputSoft]} placeholder="Teléfono Móvil" value={form.phone} onChangeText={(v) => handleChange('phone', v)} keyboardType="phone-pad" placeholderTextColor="#cbd5e1" />
                <TextInput style={[styles.input, styles.inputSoft]} placeholder="Dirección de Habitación" value={form.address} onChangeText={(v) => handleChange('address', v)} placeholderTextColor="#cbd5e1" />

                <Text style={{ color: '#e2e8f0', fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 }}>Referido (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.inputSoft]}
                  placeholder="Código de referido (opcional)"
                  value={form.referralCode}
                  onChangeText={(v) => handleChange('referralCode', v)}
                  autoCapitalize="characters"
                  placeholderTextColor="#cbd5e1"
                />
                
                {/* Terms Checkbox */}
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 12, padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 }}
                  onPress={() => setTermsAccepted(!termsAccepted)}
                >
                  <Ionicons name={termsAccepted ? 'checkbox' : 'square-outline'} size={24} color={termsAccepted ? palette.primary : '#cbd5e1'} style={{ marginTop: 2 }} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18 }}>
                      Acepto los <Text style={{ fontWeight: 'bold', color: '#fff', textDecorationLine: 'underline' }} onPress={() => navigation.navigate('Legal')}>Términos y Condiciones</Text> y la Política de Privacidad.
                    </Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginTop: 4 }}>
                      Entiendo que MegaRifas es una herramienta de gestión y no organiza los sorteos.
                    </Text>
                  </View>
                </TouchableOpacity>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <View style={{ marginTop: 12 }}>
                  <FilledButton
                    title={loading ? 'Creando perfil...' : 'Registrarme'}
                    onPress={submit}
                    disabled={loading}
                    icon={<Ionicons name="card-outline" size={18} color="#fff" />}
                  />
                </View>
                <View style={{ marginTop: 12 }}>
                  <OutlineButton
                    title="Ya tengo cuenta"
                    onPress={() => setMode('login')}
                    icon={<Ionicons name="log-in-outline" size={18} color={palette.primary} />}
                  />
                </View>
              </View>
            )}
            <View style={{ marginTop: 40, alignItems: 'center', paddingBottom: 20 }}>
              <Text style={{ color: palette.muted, fontSize: 12, fontWeight: '600' }}>{APP_SLOGAN}</Text>
              <Text style={{ color: palette.muted, fontSize: 10, marginTop: 2, opacity: 0.5 }}>{getAppVersionLabel()}</Text>
              <Text style={{ color: palette.muted, fontSize: 10, marginTop: 2, opacity: 0.5 }}>© 2025 MegaRifas. Todos los derechos reservados.</Text>
            </View>
          </ScrollView>
          <Modal visible={statePickerVisible} transparent animationType="fade" onRequestClose={() => setStatePickerVisible(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
              <View style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 16, maxHeight: '80%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Selecciona tu estado</Text>
                  <TouchableOpacity onPress={() => setStatePickerVisible(false)}>
                    <Ionicons name="close" size={22} color="#cbd5e1" />
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  {VENEZUELA_STATES.map((st) => (
                    <TouchableOpacity
                      key={st}
                      onPress={() => { handleChange('state', st); setStatePickerVisible(false); setFieldErrors((e) => ({ ...e, state: false })); }}
                      style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <Text style={{ color: '#e2e8f0', fontSize: 14 }}>{st}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );

  const renderRecovery = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.background, '#1e1b4b', palette.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { justifyContent: 'center', minHeight: '100%' }]}>            
            <Animated.View style={{ opacity: heroAnim, transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <View style={{ marginBottom: 40 }}>
                <HeroBanner />
              </View>
              <Text style={styles.heroTitle}>Recupera tu acceso</Text>
              <Text style={styles.heroTagline}>Enviamos un enlace seguro a tu correo.</Text>
            </Animated.View>
            <View style={[styles.card, { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: 'transparent' }]}
                placeholder="Correo registrado"
                autoCapitalize="none"
                autoComplete="off"
                textContentType="none"
                value={recoveryEmail}
                onChangeText={setRecoveryEmail}
                placeholderTextColor={palette.muted}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {recoveryMessage ? <Text style={styles.successText}>{recoveryMessage}</Text> : null}
              <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
                <FilledButton
                  title={recoveryLoading ? 'Enviando...' : 'Enviar instrucciones'}
                  onPress={handleRecovery}
                  disabled={recoveryLoading}
                  icon={<Ionicons name="send-outline" size={18} color="#fff" />}
                />
              </Animated.View>
              <View style={{ marginTop: 12 }}>
                <OutlineButton
                  title="Volver a iniciar sesión"
                  onPress={() => { setShowRecovery(false); setError(''); setRecoveryMessage(''); }}
                  icon={<Ionicons name="arrow-back-outline" size={18} color={palette.primary} />}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );

  const renderTwofa = () => (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background }]}>
      <LinearGradient
        colors={[palette.background, '#1e1b4b', palette.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[styles.scroll, { justifyContent: 'center' }]}>            
            <View style={[styles.card, { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]}>
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Ionicons name="shield-checkmark" size={48} color={palette.secondary} />
                <Text style={{ color: palette.text, fontSize: 20, fontWeight: 'bold', marginTop: 10 }}>Verificación de Seguridad</Text>
                <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 5 }}>
                  Hemos enviado un código a tu correo de administrador.
                </Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: palette.inputBg, borderColor: 'transparent', textAlign: 'center', fontSize: 24, letterSpacing: 5 }]}
                placeholder="000000"
                keyboardType="numeric"
                maxLength={6}
                value={twofaCode}
                onChangeText={setTwofaCode}
                placeholderTextColor={palette.muted}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <FilledButton
                title={loading ? 'Verificando...' : 'Verificar Acceso'}
                onPress={verify2fa}
                disabled={loading}
                icon={<Ionicons name="lock-open-outline" size={18} color="#fff" />}
              />
              <TouchableOpacity
                onPress={() => {
                  setTwofaNeeded(false);
                  setTwofaCode('');
                  setError('');
                }}
                style={{ marginTop: 16, alignItems: 'center' }}
              >
                <Text style={styles.link}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );

  if (twofaNeeded) return renderTwofa();
  if (showVerification) return renderVerification();
  if (showRecovery) return renderRecovery();
  return renderLogin();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 14, marginBottom: 10, backgroundColor: palette.inputBg, color: palette.text, fontSize: 16 },
  inputSoft: { borderColor: palette.border, backgroundColor: palette.inputBg },
  link: { color: palette.subtext, marginTop: 6, fontWeight: '700' },
  errorText: { color: palette.error, marginTop: 4, fontWeight: '600', marginBottom: 10 },
  successText: { color: palette.success, marginTop: 4, fontWeight: '600', marginBottom: 10 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 16 },
  rememberText: { color: palette.subtext, fontSize: 13 },
  heroTitle: { fontSize: 34, fontWeight: '900', color: palette.text, textAlign: 'center' },
  heroTagline: { fontSize: 16, color: palette.subtext, textAlign: 'center', marginTop: 6, marginBottom: 16, lineHeight: 22 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
});
