import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';
import { styles } from '../styles';

const REASONS = [
  { id: 'scam', label: 'Estafa o fraude' },
  { id: 'inappropriate', label: 'Contenido inapropiado' },
  { id: 'misleading', label: 'Información falsa o engañosa' },
  { id: 'spam', label: 'Spam' },
  { id: 'other', label: 'Otro' }
];

const CATEGORY_BY_REASON = {
  scam: 'fraud',
  inappropriate: 'inappropriate',
  misleading: 'misleading',
  spam: 'spam',
  other: 'other'
};

export default function ReportScreen({ navigation, route, api }) {
  const raffleId = route?.params?.raffleId ?? null;
  const raffleTitle = route?.params?.raffleTitle ?? '';
  const reportedUserId = route?.params?.reportedUserId ?? null;
  const reportedUserName = route?.params?.reportedUserName ?? '';

  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const headerSubtitle = useMemo(() => {
    const parts = [];
    if (raffleTitle) parts.push(raffleTitle);
    if (reportedUserName) parts.push(reportedUserName);
    return parts.filter(Boolean).join(' · ');
  }, [raffleTitle, reportedUserName]);

  const submit = async () => {
    if (!raffleId) {
      Alert.alert('Error', 'No se pudo identificar la rifa a reportar.');
      return;
    }
    if (!reason) {
      Alert.alert('Falta información', 'Selecciona un motivo.');
      return;
    }

    setSubmitting(true);
    try {
      const reasonLabel = REASONS.find((r) => r.id === reason)?.label || reason;
      const comment = String(details || '').trim() || String(reasonLabel).trim();
      const category = CATEGORY_BY_REASON[reason] || String(reason || '').trim() || 'other';

      const payload = {
        raffleId,
        category,
        comment
      };

      const { res, data } = await api('/reports', { method: 'POST', body: JSON.stringify(payload) });
      if (res.ok) {
        Alert.alert('Enviado', 'Tu denuncia fue enviada al superadmin para revisión.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        console.log('Report submit failed:', { status: res?.status, data });
        Alert.alert('Error', data?.error || data?.message || (res?.status ? `Error ${res.status}` : 'No se pudo enviar la denuncia.'));
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'No se pudo enviar la denuncia.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={[palette.background, '#0f172a']} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { padding: 16 }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginLeft: -6 }}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={[styles.title, { marginBottom: 0, marginLeft: 10, fontSize: 18 }]}>Denunciar y reportar</Text>
            </View>

            {!!headerSubtitle && (
              <Text style={[styles.muted, { marginBottom: 12 }]} numberOfLines={2}>{headerSubtitle}</Text>
            )}

            <Text style={styles.section}>Motivo</Text>
            {REASONS.map((r) => {
              const selected = reason === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.85}
                  onPress={() => setReason(r.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.08)'
                  }}
                >
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? palette.primary : palette.muted} />
                  <Text style={{ color: '#fff', fontWeight: selected ? '800' : '700', marginLeft: 12, flex: 1 }}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}

            <Text style={[styles.section, { marginTop: 14 }]}>Detalles (opcional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
              placeholder="Cuéntanos qué pasó..."
              value={details}
              onChangeText={setDetails}
              multiline
              editable={!submitting}
              maxLength={1000}
            />

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={submit}
              disabled={submitting}
              style={[styles.button, { opacity: submitting ? 0.7 : 1, marginTop: 10, justifyContent: 'center' }]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={[styles.buttonText, { marginLeft: 8 }]}>Enviar</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[styles.muted, { marginTop: 12 }]}>
              Nota: el superadmin revisará tu reporte y tomará acciones según corresponda.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
