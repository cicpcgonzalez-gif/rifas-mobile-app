import React, { useState, useEffect } from 'react';
import { View, Text, Modal, ActivityIndicator, Image, ScrollView, TouchableOpacity, Linking, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';
import { formatMoneyVES } from '../utils';

const { width } = Dimensions.get('window');

export default function PublicProfileModal({ visible, onClose, userId, api }) {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [raffles, setRaffles] = useState({ active: [], closed: [] });
  const [ratingSummary, setRatingSummary] = useState(null);

  const previewActiveRaffles = React.useMemo(() => {
    const active = Array.isArray(raffles.active) ? raffles.active : [];
    return active.slice(0, 3);
  }, [raffles.active]);

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

  const StatItem = ({ label, value, icon, color }) => (
    <View style={localStyles.statItem}>
      <View style={[localStyles.statIconContainer, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={localStyles.statValue}>{value}</Text>
      <Text style={localStyles.statLabel}>{label}</Text>
    </View>
  );

  const isAdmin = String(profile?.role || '').toLowerCase() === 'admin';
  const isSuperAdmin = String(profile?.role || '').toLowerCase() === 'superadmin';

  return (
    <Modal visible={visible} animationType='slide' transparent onRequestClose={onClose}>
      <View style={localStyles.modalOverlay}>
        <View style={localStyles.modalContent}>
          {/* Handle Bar */}
          <View style={localStyles.handleBarContainer}>
            <View style={localStyles.handleBar} />
          </View>

          {/* Close Button */}
          <TouchableOpacity onPress={onClose} style={localStyles.closeButton}>
            <Ionicons name='close' size={24} color='#fff' />
          </TouchableOpacity>

          {loading ? (
            <View style={localStyles.loadingContainer}>
              <ActivityIndicator color={palette.primary} size='large' />
            </View>
          ) : profile ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              
              {/* Header Section */}
              <View style={localStyles.headerSection}>
                <View style={[localStyles.avatarContainer, profile.isBoosted && localStyles.avatarBoosted]}>
                  {profile.avatar ? (
                    <Image source={{ uri: profile.avatar }} style={localStyles.avatar} />
                  ) : (
                    <View style={[localStyles.avatar, localStyles.avatarPlaceholder]}>
                      <Text style={localStyles.avatarInitial}>{String(profile.name || 'U').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  {profile.identityVerified && (
                    <View style={localStyles.verifiedBadge}>
                      <Ionicons name='checkmark-circle' size={16} color='#fff' />
                    </View>
                  )}
                </View>

                <Text style={localStyles.userName}>{profile.name}</Text>
                
                {isSuperAdmin && (
                  <View style={[localStyles.boostTag, { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <Ionicons name='shield-checkmark' size={12} color='#ef4444' />
                    <Text style={[localStyles.boostText, { color: '#ef4444' }]}>SUPER ADMIN</Text>
                  </View>
                )}
                
                {isAdmin && !isSuperAdmin && (
                  <View style={[localStyles.boostTag, { borderColor: palette.primary, backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                    <Ionicons name='shield' size={12} color={palette.primary} />
                    <Text style={[localStyles.boostText, { color: palette.primary }]}>ADMINISTRADOR</Text>
                  </View>
                )}

                {profile.isBoosted && (
                  <View style={localStyles.boostTag}>
                    <Ionicons name='flash' size={12} color='#F59E0B' />
                    <Text style={localStyles.boostText}>PROMOCIONADO</Text>
                  </View>
                )}

                {!!userId && (
                  <TouchableOpacity
                    onPress={() => {
                      onClose?.();
                      navigation.navigate('PublicProfile', { userId });
                    }}
                    style={localStyles.viewProfileButton}
                  >
                    <Text style={localStyles.viewProfileText}>Ver perfil completo</Text>
                    <Ionicons name='arrow-forward' size={14} color={palette.primary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Stats Grid */}
              <View style={localStyles.statsContainer}>
                <StatItem 
                  label='Rifas' 
                  value={profile.stats?.raffles || 0} 
                  icon='ticket-outline' 
                  color={palette.accent} 
                />
                <View style={localStyles.statDivider} />
                <StatItem 
                  label='Ventas' 
                  value={profile.stats?.sales || 0} 
                  icon='cash-outline' 
                  color='#10b981' 
                />
                <View style={localStyles.statDivider} />
                <StatItem 
                  label='Reputaci�n' 
                  value={ratingSummary?.avgScore != null ? Number(ratingSummary.avgScore).toFixed(1) : (profile.reputationScore != null ? Number(profile.reputationScore).toFixed(1) : '')} 
                  icon='star' 
                  color='#F59E0B' 
                />
              </View>

              {/* Bio */}
              {profile.bio && (
                <View style={localStyles.bioContainer}>
                  <Text style={localStyles.bioText}>{profile.bio}</Text>
                </View>
              )}

              {/* Socials */}
              {profile.socials && (
                <View style={localStyles.socialsContainer}>
                  {profile.socials.whatsapp && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://wa.me/${profile.socials.whatsapp}`)} style={[localStyles.socialButton, { backgroundColor: '#25D366' }]}>
                      <Ionicons name='logo-whatsapp' size={20} color='#fff' />
                    </TouchableOpacity>
                  )}
                  {profile.socials.instagram && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${profile.socials.instagram}`)} style={[localStyles.socialButton, { backgroundColor: '#E1306C' }]}>
                      <Ionicons name='logo-instagram' size={20} color='#fff' />
                    </TouchableOpacity>
                  )}
                  {profile.socials.tiktok && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://www.tiktok.com/@${String(profile.socials.tiktok).replace('@', '')}`)} style={[localStyles.socialButton, { backgroundColor: '#000' }]}>
                      <Ionicons name='logo-tiktok' size={20} color='#fff' />
                    </TouchableOpacity>
                  )}
                  {profile.socials.telegram && (
                    <TouchableOpacity onPress={() => Linking.openURL(`https://t.me/${String(profile.socials.telegram).replace('@', '')}`)} style={[localStyles.socialButton, { backgroundColor: '#0088cc' }]}>
                      <Ionicons name='paper-plane' size={20} color='#fff' />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Active Raffles Preview */}
              {previewActiveRaffles.length > 0 && (
                <View style={localStyles.rafflesSection}>
                  <View style={localStyles.sectionHeader}>
                    <Text style={localStyles.sectionTitle}>Rifas Activas</Text>
                    <View style={localStyles.sectionBadge}>
                      <Text style={localStyles.sectionBadgeText}>{previewActiveRaffles.length}</Text>
                    </View>
                  </View>
                  
                  {previewActiveRaffles.map((r) => {
                    const stats = r?.stats || {};
                    const total = r?.totalTickets || stats.total || 0;
                    const sold = stats.sold || 0;
                    const remaining = stats.remaining ?? (total ? Math.max(total - sold, 0) : 0);
                    const gallery = Array.isArray(r?.style?.gallery) && r.style.gallery.length ? r.style.gallery : r?.style?.bannerImage ? [r.style.bannerImage] : [];
                    const imageUri = gallery.length > 0 ? gallery[0] : null;

                    return (
                      <View key={r.id} style={localStyles.raffleCard}>
                        <View style={localStyles.raffleImageContainer}>
                          {imageUri ? (
                            <Image source={{ uri: imageUri }} style={localStyles.raffleImage} resizeMode='cover' />
                          ) : (
                            <View style={[localStyles.raffleImage, { backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name='image-outline' size={24} color='#64748b' />
                            </View>
                          )}
                          <View style={localStyles.priceTag}>
                            <Text style={localStyles.priceText}>{formatMoneyVES(r.price ?? r.ticketPrice, { decimals: 0 })}</Text>
                          </View>
                        </View>
                        <View style={localStyles.raffleInfo}>
                          <Text style={localStyles.raffleTitle} numberOfLines={2}>{r.title}</Text>
                          <View style={localStyles.raffleFooter}>
                            <Ionicons name='ticket-outline' size={14} color={palette.subtext} />
                            <Text style={localStyles.raffleSubtitle}>{remaining} disponibles</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

            </ScrollView>
          ) : (
            <View style={localStyles.errorContainer}>
              <Ionicons name='alert-circle-outline' size={48} color={palette.muted} />
              <Text style={localStyles.errorText}>No se pudo cargar el perfil</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '50%',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  handleBarContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 6,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#1e293b',
  },
  avatarPlaceholder: {
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: 'bold',
    color: palette.muted,
  },
  avatarBoosted: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    borderRadius: 52,
    padding: 2, 
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1e293b',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 6,
  },
  boostTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  boostText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  viewProfileText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'center',
  },
  bioContainer: {
    paddingHorizontal: 32,
    marginBottom: 24,
    alignItems: 'center',
  },
  bioText: {
    color: palette.subtext,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  socialsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rafflesSection: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  raffleCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  raffleImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  raffleImage: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  priceText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: 'bold',
  },
  raffleInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  raffleTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  raffleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  raffleSubtitle: {
    color: palette.subtext,
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  errorText: {
    color: palette.muted,
    marginTop: 12,
    fontSize: 16,
  },
});
