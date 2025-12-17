import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ActivityIndicator, Image, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette } from '../theme';
import { styles } from '../styles';

export default function PublicProfileModal({ visible, onClose, userId, api }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [raffles, setRaffles] = useState({ active: [], closed: [] });
  const [ratingSummary, setRatingSummary] = useState(null);

  const combinedRaffles = React.useMemo(() => {
    const active = Array.isArray(raffles.active) ? raffles.active : [];
    const closed = Array.isArray(raffles.closed) ? raffles.closed : [];
    return [...active, ...closed];
  }, [raffles.active, raffles.closed]);

  useEffect(() => {
    if (visible && userId) {
      setLoading(true);
      Promise.all([
        api(`/users/public/${userId}`),
        api(`/users/public/${userId}/rating-summary`).catch(() => ({ res: {}, data: null })),
        api(`/users/public/${userId}/raffles`).catch(() => ({ res: {}, data: null }))
      ]).then(([profileRes, ratingRes, rafflesRes]) => {
        if (profileRes.res?.ok) setProfile(profileRes.data);
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
        setLoading(false);
      });
    } else {
      setProfile(null);
      setRaffles({ active: [], closed: [] });
      setRatingSummary(null);
    }
  }, [visible, userId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={[styles.card, { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 40 }]}>
          <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 16 }}>
            <View style={{ width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
          </View>
          
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, position: 'absolute', right: 0, top: 16, zIndex: 10 }}>
            <TouchableOpacity onPress={onClose} style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 12 }}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={palette.primary} size="large" />
          ) : profile ? (
            <ScrollView>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                {profile.avatar ? (
                  <Image source={{ uri: profile.avatar }} style={{ width: 100, height: 100, borderRadius: 50 }} />
                ) : (
                  <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={48} color={palette.muted} />
                  </View>
                )}
                <Text style={[styles.title, { marginTop: 12 }]}>{profile.name}</Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
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

                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 24, marginBottom: 24 }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{profile.stats?.raffles || 0}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Rifas</Text>
                  </View>
                  <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{profile.stats?.sales || 0}</Text>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Ventas</Text>
                  </View>
                  <View style={{ width: 1, height: '100%', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}>{profile.reputationScore || 5.0}</Text>
                      <Ionicons name="star" size={14} color="#fbbf24" style={{ marginLeft: 2 }} />
                    </View>
                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>Reputación</Text>
                  </View>
                </View>

                {ratingSummary && (ratingSummary.count || ratingSummary.avgScore != null) ? (
                  <View style={{ alignItems: 'center', marginTop: -12, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="star" size={14} color="#fbbf24" />
                      <Text style={{ color: '#e2e8f0', fontWeight: '800' }}>
                        Calificación: {ratingSummary.avgScore == null ? '—' : Number(ratingSummary.avgScore).toFixed(1)}/10
                      </Text>
                      <Text style={{ color: '#94a3b8' }}>({ratingSummary.count || 0})</Text>
                    </View>
                    {profile.boostEndsAt ? (
                      <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>
                        Boost hasta: {new Date(profile.boostEndsAt).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <Text style={styles.muted}>{profile.role === 'admin' || profile.role === 'superadmin' ? 'Administrador' : 'Usuario'}</Text>
              </View>

              {profile.bio && <Text style={{ color: palette.text, textAlign: 'center', marginBottom: 16 }}>{profile.bio}</Text>}

              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                {profile.stats ? (
                  <>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: palette.primary, fontWeight: 'bold', fontSize: 18 }}>{profile.stats.raffles || 0}</Text>
                      <Text style={styles.muted}>Rifas</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: palette.primary, fontWeight: 'bold', fontSize: 18 }}>{profile.stats.prizes || 0}</Text>
                      <Text style={styles.muted}>Premios</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: palette.primary, fontWeight: 'bold', fontSize: 18 }}>{profile._count?.tickets || 0}</Text>
                      <Text style={styles.muted}>Tickets</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: palette.primary, fontWeight: 'bold', fontSize: 18 }}>{profile._count?.announcements || 0}</Text>
                      <Text style={styles.muted}>Anuncios</Text>
                    </View>
                  </>
                )}
              </View>

              {profile.socials && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
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
                    <TouchableOpacity onPress={() => Linking.openURL(`https://www.tiktok.com/@${String(profile.socials.tiktok).replace('@','')}`)}>
                      <Ionicons name="logo-tiktok" size={24} color="#e2e8f0" />
                    </TouchableOpacity>
                  )}
                  {profile.socials.telegram && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${String(profile.socials.telegram).replace('@','')}`)}>
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

              {combinedRaffles.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={[styles.section, { textAlign: 'center' }]}>Rifas de este rifero</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12, gap: 10 }}>
                    {combinedRaffles.map((r) => {
                      const isClosed = String(r.status || '').toLowerCase() !== 'active';
                      return (
                      <View key={`${isClosed ? 'cls' : 'act'}-${r.id}`} style={{ width: 180, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ color: '#fff', fontWeight: '800' }} numberOfLines={1}>{r.title}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }} numberOfLines={2}>{r.description}</Text>
                        {isClosed && (
                          <View style={{ marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                            <Text style={{ color: '#fecaca', fontSize: 10, fontWeight: '800' }}>CERRADA</Text>
                          </View>
                        )}
                        <View style={{ marginTop: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#cbd5e1', fontSize: 11 }}>Disp.</Text>
                            <Text style={{ color: '#cbd5e1', fontSize: 11 }}>
                              {(r.stats?.remaining ?? r.remaining ?? 0)} / {(r.totalTickets || r.stats?.total || '∞')}
                            </Text>
                          </View>
                          <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <View style={{ width: `${Math.max(0, Math.min(100, ((r.stats?.remaining ?? r.remaining ?? 0) / (r.totalTickets || r.stats?.total || 1)) * 100))}%`, height: '100%', backgroundColor: palette.primary }} />
                          </View>
                        </View>
                      </View>
                    );})}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          ) : (
            <Text style={{ color: palette.text, textAlign: 'center' }}>No se pudo cargar el perfil.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}
