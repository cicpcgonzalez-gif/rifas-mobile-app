import React, { useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { palette } from '../theme';
import { styles } from '../styles';

export default function ReferralsScreen({ navigation, api }) {
  const [loading, setLoading] = useState(false);
  const [referralData, setReferralData] = useState({ code: '', referrals: [], earnings: 0 });

  const loadReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const { res, data } = await api('/me/referrals');
      if (res.ok) {
        setReferralData({
          code: data.code,
          referrals: data.referrals || [],
          earnings: data.earnings || 0 
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      loadReferrals();
    }, [loadReferrals])
  );

  const copyCode = async () => {
    await Clipboard.setStringAsync(referralData.code);
    Alert.alert('Copiado', 'Código copiado al portapapeles');
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Únete a Rifas con mi código: ${referralData.code} y gana bonos increíbles!`,
      });
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <LinearGradient colors={[palette.background, '#1a1a2e']} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Mis Referidos</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {/* Code Section */}
          <View style={styles.card}>
            <Text style={{ color: palette.subtext, marginBottom: 10 }}>Tu Código de Referido</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 10 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 2 }}>{referralData.code || '---'}</Text>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity onPress={copyCode}>
                  <Ionicons name="copy-outline" size={24} color={palette.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={shareCode}>
                  <Ionicons name="share-social-outline" size={24} color={palette.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ color: palette.subtext, fontSize: 12, marginTop: 10 }}>
              Comparte este código y gana bonos por cada amigo que se registre y participe.
            </Text>
          </View>

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: 15, marginTop: 20 }}>
            <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>{referralData.referrals.length}</Text>
              <Text style={{ color: palette.subtext }}>Amigos</Text>
            </View>
            <View style={[styles.card, { flex: 1, alignItems: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>${referralData.earnings}</Text>
              <Text style={{ color: palette.subtext }}>Ganancias</Text>
            </View>
          </View>

          {/* List */}
          <Text style={[styles.subtitle, { marginTop: 30, marginBottom: 15 }]}>Historial de Referidos</Text>
          {loading ? (
            <ActivityIndicator color={palette.primary} />
          ) : (
            <View>
              {referralData.referrals.length === 0 ? (
                <Text style={{ color: palette.subtext, textAlign: 'center', marginTop: 20 }}>Aún no tienes referidos.</Text>
              ) : (
                referralData.referrals.map((ref, index) => (
                  <View key={index} style={[styles.card, { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{ref.name?.charAt(0) || 'U'}</Text>
                    </View>
                    <View>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{ref.name}</Text>
                      <Text style={{ color: palette.subtext, fontSize: 12 }}>Registrado el {new Date(ref.createdAt).toLocaleDateString()}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
