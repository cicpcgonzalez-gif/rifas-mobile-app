import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, ActivityIndicator, Image, ScrollView, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';
import { styles } from '../styles';
import { formatMoneyVES } from '../utils';

const { width } = Dimensions.get('window');

export default function PublicProfileScreen({ route, navigation, api }) {
  const userId = route?.params?.userId;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [raffles, setRaffles] = useState({ active: [], closed: [] });
  const [ratingSummary, setRatingSummary] = useState(null);

  const activeRaffles = useMemo(() => (Array.isArray(raffles.active) ? raffles.active : []), [raffles.active]);
  const closedRaffles = useMemo(() => (Array.isArray(raffles.closed) ? raffles.closed : []), [raffles.closed]);

  const renderRaffleCard = (r) => {
    const stats = r?.stats || {};
    const total = r?.totalTickets || stats.total || 0;
    const sold = stats.sold || 0;
    const remaining = stats.remaining ?? (total ? Math.max(total - sold, 0) : 0);
    const status = String(r?.status || '').toLowerCase();
    const endMs = Date.parse(r?.endDate);
    const endedByTime = Number.isFinite(endMs) && endMs > 0 && endMs < Date.now();
    const isClosed = status !== 'active' || endedByTime;
    const isAgotada = !isClosed && Number(remaining) === 0;

    const gallery = Array.isArray(r?.style?.gallery) && r.style.gallery.length
      ? r.style.gallery
      : r?.style?.bannerImage
        ? [r.style.bannerImage]
        : [];

    return (
      <TouchableOpacity
        key={`raffle-${r.id}`}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('RaffleDetail', { raffle: r })}
        style={{ marginBottom: 18, backgroundColor: '#1e293b', borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
            ) : (
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>{String(profile.name || 'M').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{profile.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
              {profile.identityVerified && (
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
  };

  useEffect(() => {
    if (!userId || !api) return;
    setLoading(true);
    Promise.all([
      api(`/users/public/${userId}`),
      api(`/users/public/${userId}/rating-summary`).catch(() => ({ res: {}, data: null })),
      api(`/users/public/${userId}/raffles`).catch(() => ({ res: {}, data: null }))
    ])
      .then(([profileRes, ratingRes, rafflesRes]) => {
        if (profileRes?.res?.ok) setProfile(profileRes.data);
        else setProfile(null);

        if (ratingRes?.res?.ok) setRatingSummary(ratingRes.data);
        else setRatingSummary(null);

        if (rafflesRes?.res?.ok && rafflesRes.data) {
          setRaffles({
            active: rafflesRes.data.active || rafflesRes.data.raffles || [],
            closed: rafflesRes.data.closed || rafflesRes.data.history || []
          });
        } else {
          setRaffles({ active: [], closed: [] });
        }
      })
      .finally(() => setLoading(false));
  }, [userId, api]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginLeft: -6 }}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.title, { marginBottom: 0, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          Perfil
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={palette.primary} size="large" />
        </View>
      ) : !profile ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <Text style={{ color: palette.text, textAlign: 'center' }}>No se pudo cargar el perfil.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <View style={[styles.card, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <View style={{ alignItems: 'center' }}>
              {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
              ) : (
                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={48} color={palette.muted} />
                </View>
              )}

              <Text style={[styles.title, { marginTop: 12 }]}>{profile.name}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {profile.identityVerified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(59, 130, 246, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                    <Ionicons name="checkmark-circle" size={14} color="#3b82f6" />
                    <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: 'bold' }}>Verificado</Text>
                  </View>
                )}

                {profile.isBoosted && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.35)' }}>
                    <Ionicons name="flash" size={14} color="#fbbf24" />
                    <Text style={{ color: '#fbbf24', fontSize: 12, fontWeight: 'bold' }}>PROMOCIONADO</Text>
                  </View>
                )}
              </View>

              {ratingSummary && (ratingSummary.count || ratingSummary.avgScore != null) ? (
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="star" size={14} color="#fbbf24" />
                    <Text style={{ color: '#e2e8f0', fontWeight: '800' }}>
                      Calificación: {ratingSummary.avgScore == null ? '—' : Number(ratingSummary.avgScore).toFixed(1)}/10
                    </Text>
                    <Text style={{ color: '#94a3b8' }}>({ratingSummary.count || 0})</Text>
                  </View>
                </View>
              ) : null}

              {profile.bio ? (
                <Text style={{ color: palette.text, textAlign: 'center', marginTop: 12 }}>{profile.bio}</Text>
              ) : null}

              {profile.socials && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
                  {profile.socials.whatsapp && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${profile.socials.whatsapp}`)}>
                      <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                    </TouchableOpacity>
                  )}
                  {profile.socials.instagram && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${profile.socials.instagram}`)}>
                      <Ionicons name="logo-instagram" size={24} color="#E1306C" />
                    </TouchableOpacity>
                  )}
                  {profile.socials.tiktok && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://www.tiktok.com/@${String(profile.socials.tiktok).replace('@', '')}`)}>
                      <Ionicons name="logo-tiktok" size={24} color="#e2e8f0" />
                    </TouchableOpacity>
                  )}
                  {profile.socials.telegram && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${String(profile.socials.telegram).replace('@', '')}`)}>
                      <Ionicons name="paper-plane-outline" size={24} color="#60a5fa" />
                    </TouchableOpacity>
                  )}
                  {profile.socials.email && (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${profile.socials.email}`)}>
                      <Ionicons name="mail-outline" size={24} color={palette.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          <View style={{ paddingHorizontal: 12, marginTop: 8 }}>
            <Text style={styles.section}>Rifas activas</Text>
            {activeRaffles.length === 0 ? (
              <Text style={[styles.muted, { textAlign: 'center', marginTop: 10 }]}>No hay rifas activas.</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {activeRaffles.map(renderRaffleCard)}
              </View>
            )}

            <View style={{ height: 12 }} />

            <Text style={styles.section}>Rifas cerradas / vendidas</Text>
            {closedRaffles.length === 0 ? (
              <Text style={[styles.muted, { textAlign: 'center', marginTop: 10 }]}>No hay rifas cerradas todavía.</Text>
            ) : (
              <View style={{ marginTop: 10 }}>
                {closedRaffles.map(renderRaffleCard)}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
