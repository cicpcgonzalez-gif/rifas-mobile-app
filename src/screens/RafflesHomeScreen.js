import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Image,
  ImageBackground,
  TouchableOpacity,
  Animated,
  Modal,
  TextInput,
  Alert,
  Share,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';
import { formatMoneyVES } from '../utils';
import Announcements from '../components/Announcements';
import PublicProfileModal from '../components/PublicProfileModal';
import { FilledButton } from '../components/UI';
import TopBar from '../components/TopBar';

const PulsingBadge = () => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: '#4ade80',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      transform: [{ scale }],
      zIndex: 10,
      borderWidth: 1,
      borderColor: '#fff',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5
    }}>
      <Text style={{ color: '#000', fontSize: 10, fontWeight: 'bold' }}>¡PARTICIPA Y GANA!</Text>
    </Animated.View>
  );
};

export default function RafflesHomeScreen({ navigation, api, user }) {
  const listRef = useRef(null);
  const announcementsYRef = useRef(null);
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletQuickVisible, setWalletQuickVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [supportVisible, setSupportVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [techSupport, setTechSupport] = useState(null);
  const [viewProfileId, setViewProfileId] = useState(null);
  const [winners, setWinners] = useState([]);
  const heroAnim = useRef(new Animated.Value(0)).current;
  const [carouselIndex, setCarouselIndex] = useState({});
  const cardImageWidth = Dimensions.get('window').width - 32;
  const [helpVisible, setHelpVisible] = useState(false);
  const [filter, setFilter] = useState('all');

  const [postMenuVisible, setPostMenuVisible] = useState(false);
  const [postMenuRaffle, setPostMenuRaffle] = useState(null);

  const [reactingIds, setReactingIds] = useState(new Set());
  const reactingIdsRef = useRef(new Set());
  const [myReactions, setMyReactions] = useState({});
  const myReactionsRef = useRef({});
  useEffect(() => {
    myReactionsRef.current = myReactions;
  }, [myReactions]);

  const shareRaffle = async (raffle) => {
    try {
      const title = raffle?.title || 'Rifa';
      const description = raffle?.description || '';
      const appLink = 'megarifas://';
      await Share.share({
        message: `${title}\n\n${description}\n\nAbrir en MegaRifas: ${appLink}`
      });
    } catch (_e) {
      // Silenciar
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { res, data } = await api('/raffles');
    if (res.ok && Array.isArray(data)) {
      // En el apartado de Rifas deben verse las rifas activas (incluyendo AGOTADAS).
      // Solo se eliminan del feed cuando culminan (status != active o ya pasó la fecha final).
      const now = Date.now();
      const visible = data.filter((r) => {
        const status = String(r?.status || '').toLowerCase();
        if (status && status !== 'active') return false;
        const endMs = Date.parse(r?.endDate);
        const endedByTime = Number.isFinite(endMs) && endMs > 0 && endMs < now;
        if (endedByTime) return false;
        return true;
      });
      setRaffles(visible);
    }

    // Load Wallet (para mostrar saldo en el TopBar)
    try {
      const { res: wRes, data: wData } = await api('/wallet');
      if (wRes.ok && wData) setWalletBalance(wData?.balance ?? 0);
    } catch (_e) {
      // Silenciar
    }
    
    // Load Winners
    try {
      const { res: wRes, data: wData } = await api('/winners');
      if (wRes.ok && Array.isArray(wData)) setWinners(wData.slice(0, 5));
    } catch (e) { console.log('No winners'); }

    // Load Tech Support Settings
    try {
      const { res: sRes, data: sData } = await api('/settings/tech-support');
      if (sRes.ok) setTechSupport(sData);
    } catch (e) { console.log('No tech support config'); }

    setLoading(false);
  }, [api]);

  const refreshWalletBalance = useCallback(async () => {
    try {
      const { res: wRes, data: wData } = await api('/wallet');
      if (wRes.ok && wData) setWalletBalance(wData?.balance ?? 0);
    } catch (_e) {
      // Silenciar
    }
  }, [api]);

  const scrollToAnnouncements = useCallback(() => {
    const y = announcementsYRef.current;
    if (typeof y !== 'number' || !Number.isFinite(y)) return;
    listRef.current?.scrollToOffset?.({ offset: Math.max(0, y - 8), animated: true });
  }, []);

  const reactToRaffle = useCallback(async (id, type) => {
    if (!id) return;
    const current = myReactionsRef.current?.[id] || null;

    // No permitir reaccionar dos veces con el mismo tipo (no toggle/off)
    if (current === type) return;

    // Evitar doble tap rápido mientras está en vuelo
    if (reactingIdsRef.current.has(id)) return;
    reactingIdsRef.current.add(id);
    setReactingIds((prev) => new Set(prev).add(id));

    const next = type;

    // Optimista: actualizar contadores locales
    setMyReactions((prev) => ({ ...prev, [id]: next }));
    setRaffles((prev) => prev.map((r) => {
      if (r?.id !== id) return r;
      const counts = { ...(r.reactionCounts || {}) };
      if (current) counts[current] = Math.max(0, (counts[current] ?? 0) - 1);
      if (next) counts[next] = (counts[next] ?? 0) + 1;
      return { ...r, reactionCounts: counts };
    }));

    try {
      const { res, data } = await api(`/raffles/${id}/react`, { method: 'POST', body: JSON.stringify({ type: next }) });
      if (!res.ok) {
        const msg = String(data?.error || '').toLowerCase();
        const isAuthIssue = res.status === 401 || res.status === 403 || msg.includes('sesión expirada') || msg.includes('sesion expirada') || msg.includes('token');
        // Revertir el optimista si falló (sin recargar toda la pantalla)
        setMyReactions((prev) => ({ ...prev, [id]: current }));
        setRaffles((prev) => prev.map((r) => {
          if (r?.id !== id) return r;
          const counts = { ...(r.reactionCounts || {}) };
          if (next) counts[next] = Math.max(0, (counts[next] ?? 0) - 1);
          if (current) counts[current] = (counts[current] ?? 0) + 1;
          return { ...r, reactionCounts: counts };
        }));
        if (!isAuthIssue) {
          Alert.alert('Error', data?.error || 'No se pudo registrar la reacción.');
        }
      }
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      const isAuthIssue = msg.includes('sesión expirada') || msg.includes('sesion expirada') || msg.includes('token');
      // Revertir el optimista si falló (sin recargar toda la pantalla)
      setMyReactions((prev) => ({ ...prev, [id]: current }));
      setRaffles((prev) => prev.map((r) => {
        if (r?.id !== id) return r;
        const counts = { ...(r.reactionCounts || {}) };
        if (next) counts[next] = Math.max(0, (counts[next] ?? 0) - 1);
        if (current) counts[current] = (counts[current] ?? 0) + 1;
        return { ...r, reactionCounts: counts };
      }));
      if (!isAuthIssue) {
        Alert.alert('Error', e?.message || 'No se pudo registrar la reacción.');
      }
    } finally {
      setReactingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(id);
        return nextSet;
      });
      reactingIdsRef.current.delete(id);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    Animated.timing(heroAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [heroAnim]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient
        colors={[palette.background, '#0f172a', '#1e1b4b']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
      <FlatList
        ref={listRef}
        data={loading ? [] : raffles
          .filter((r) => {
            const q = String(searchQuery || '').trim().toLowerCase();
            if (!q) return true;
            const haystack = `${r?.title || ''} ${r?.prize || ''} ${r?.lottery || ''}`.toLowerCase();
            return haystack.includes(q);
          })
          .slice()
          .sort((a, b) => {
            const ap = Number(a?.price ?? a?.ticketPrice ?? a?.ticket_price ?? 0) || 0;
            const bp = Number(b?.price ?? b?.ticketPrice ?? b?.ticket_price ?? 0) || 0;
            if (filter === 'cheap') return ap - bp;
            if (filter === 'closing') return new Date(a.endDate || 0) - new Date(b.endDate || 0);
            return 0;
        })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        ListHeaderComponent={
          <>
            <View style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 14 }}>
              <TopBar
                balanceText={
                  walletBalance === null
                    ? 'Cargando...'
                    : `${formatMoneyVES(walletBalance, { withSymbol: false, decimals: 2 })} VES`
                }
                onPressWallet={() => {
                  setWalletQuickVisible(true);
                  if (walletBalance === null) refreshWalletBalance();
                }}
                onPressNotifications={scrollToAnnouncements}
                onPressProfile={() => navigation.navigate('Perfil')}
              />
              <View style={{ alignItems: 'center', marginTop: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 0.6 }}>MEGA RIFAS</Text>
                <View style={{ height: 3, width: 44, backgroundColor: palette.primary, borderRadius: 2, marginTop: 4 }} />
              </View>
            </View>

            {winners.length > 0 && (
              <View style={{ marginBottom: 24 }}>
                <Text style={{ color: '#fbbf24', fontSize: 18, fontWeight: 'bold', marginLeft: 16, marginBottom: 12 }}>🏆 Últimos Ganadores</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                  {winners.map((w) => (
                    <View key={w.id} style={{ width: 140, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' }}>
                      <Image source={{ uri: w.photoUrl || 'https://via.placeholder.com/100' }} style={{ width: 60, height: 60, borderRadius: 30, marginBottom: 8 }} />
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, textAlign: 'center' }} numberOfLines={1}>{w.winnerName}</Text>
                      <Text style={{ color: '#fbbf24', fontSize: 10, textAlign: 'center' }} numberOfLines={1}>{w.prize}</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 10, marginTop: 4 }}>Ticket #{String(w.ticketNumber).padStart(4, '0')}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            <Animated.View
              style={{
                opacity: heroAnim,
                transform: [
                  {
                    translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] })
                  }
                ]
              }}
            >
              <View style={styles.heroCardHome}>
                <View style={styles.heroPillRow}>
                  <View style={styles.heroPill}>
                    <Ionicons name="sparkles" size={14} color="#fbbf24" />
                    <Text style={styles.heroPillText}>Sorteos Activos</Text>
                  </View>
                  <TouchableOpacity onPress={load} style={styles.heroPillAlt}>
                    <Ionicons name="refresh" size={14} color={palette.text} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.heroHeading}>Tu oportunidad de ganar hoy.</Text>
                <Text style={styles.heroSub}>Participa en los sorteos más exclusivos con total seguridad.</Text>
                <TouchableOpacity onPress={() => setHelpVisible(true)} style={{ marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="information-circle-outline" size={18} color={palette.primary} />
                  <Text style={{ color: palette.primary, fontWeight: '700' }}>Cómo participar</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12 }}>
                <Ionicons name="search-outline" size={18} color="#94a3b8" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Buscar rifas..."
                  placeholderTextColor="#94a3b8"
                  style={{ flex: 1, color: '#fff', paddingVertical: 10, paddingHorizontal: 10 }}
                  autoCapitalize="none"
                />
                {!!searchQuery && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 6 }}>
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 8, paddingHorizontal: 16, marginBottom: 10 }}>
              {[{ id: 'all', label: 'Todas' }, { id: 'closing', label: 'Próximas a cerrar' }, { id: 'cheap', label: 'Menor precio' }].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => setFilter(opt.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: filter === opt.id ? palette.primary : 'rgba(255,255,255,0.15)',
                    backgroundColor: filter === opt.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)'
                  }}
                >
                  <Text style={{ color: '#e2e8f0', fontWeight: '700' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View onLayout={(e) => { announcementsYRef.current = e?.nativeEvent?.layout?.y; }}>
              <Announcements api={api} onShowProfile={setViewProfileId} />
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color={palette.primary} size="large" />
              <Text style={styles.muted}>Cargando rifas...</Text>
            </View>
          ) : (
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 20 }]}>No hay rifas activas por el momento.</Text>
          )
        }
        renderItem={({ item }) => {
            const stats = item.stats || {};
          const total = Number(item?.totalTickets ?? stats.total ?? 0) || 0;
          const sold = Number(item?.soldTickets ?? stats.sold ?? 0) || 0;
            const remaining = stats.remaining ?? (total ? Math.max(total - sold, 0) : 0);
            const percentLeft = total ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
            const lowStock = total && percentLeft <= 10;

          const priceValue = Number(item?.price ?? item?.ticketPrice ?? item?.ticket_price ?? 0) || 0;
          const endMs = Date.parse(item?.endDate);
          const endedByTime = Number.isFinite(endMs) && endMs > 0 && endMs < Date.now();
          const status = String(item?.status || '').toLowerCase();
          const isActive = status === 'active' && !endedByTime;
          const isAgotada = isActive && ((item?.isSoldOut === true) || Number(remaining) === 0);
          const isClosed = !isActive;
          const playDisabled = isClosed || isAgotada;
          const showDescription = !!String(item?.description || '').trim();

          const barFillColor = percentLeft >= 70 ? '#22c55e' : percentLeft >= 35 ? '#fbbf24' : '#ef4444';

            const reactionCounts = item.reactionCounts || {};
            const likeCount = reactionCounts.LIKE ?? 0;
            const heartCount = reactionCounts.HEART ?? 0;
            const currentReaction = myReactions[item.id] || null;
            const reacting = reactingIds.has(item.id);
            
            const gallery = Array.isArray(item.style?.gallery) && item.style.gallery.length
              ? item.style.gallery
              : item.style?.bannerImage
              ? [item.style.bannerImage]
              : [];

            const userBoostActive = !!item?.user?.isBoosted;
            const userBoostEndsAt = item?.user?.boostEndsAt ? Date.parse(item.user.boostEndsAt) : 0;
            const raffleBoost = item?.style?.boost;
            const raffleBoostEndsAt = raffleBoost?.expiresAt ? Date.parse(raffleBoost.expiresAt) : 0;
            const raffleBoostActive = Number.isFinite(raffleBoostEndsAt) && raffleBoostEndsAt > Date.now();

            return (
              <View style={{ marginBottom: 24, backgroundColor: '#1e293b', borderRadius: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}>
                    <TouchableOpacity 
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => item.user && setViewProfileId(item.user.id)}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                         {item.user?.avatar ? (
                           <Image source={{ uri: item.user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                         ) : (
                           <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>{item.user?.name?.charAt(0).toUpperCase() || 'M'}</Text>
                         )}
                      </View>
                      <View>
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                            {item.user?.name || 'MegaRifas Oficial'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                            {item.user?.identityVerified && (
                              <Text style={{ color: '#94a3b8', fontSize: 10 }}>Verificado</Text>
                            )}
                            {userBoostActive && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(251, 191, 36, 0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.35)' }}>
                                <Ionicons name="flash" size={12} color="#fbbf24" />
                                <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '900' }}>PROMOCIONADO</Text>
                              </View>
                            )}

                          </View>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setPostMenuRaffle(item);
                        setPostMenuVisible(true);
                      }}
                    >
                        <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Image */}
                <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#000' }}>
                    {gallery.length > 0 ? (
                        <ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={(evt) => {
                              const nextIndex = Math.round((evt.nativeEvent.contentOffset.x || 0) / Dimensions.get('window').width);
                              setCarouselIndex((prev) => (prev[item.id] === nextIndex ? prev : { ...prev, [item.id]: nextIndex }));
                            }}
                            scrollEventThrottle={16}
                        >
                        {gallery.map((img, idx) => (
                          <Image 
                            key={idx} 
                            source={{ uri: img }} 
                            style={{ width: Dimensions.get('window').width, height: '100%', backgroundColor: '#000' }} 
                            resizeMode="contain" 
                          />
                            ))}
                        </ScrollView>
                    ) : (
                        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.2)" />
                        </View>
                    )}
                    {gallery.length > 1 && (
                        <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                                {(carouselIndex[item.id] || 0) + 1}/{gallery.length}
                            </Text>
                        </View>
                    )}

                    {(userBoostActive || raffleBoostActive) && (
                      <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={raffleBoostActive ? 'star' : 'star-outline'} size={14} color="#fbbf24" />
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>
                          {raffleBoostActive ? 'DESTACADA' : 'PROMO'}
                        </Text>
                        {userBoostActive && userBoostEndsAt ? (
                          <Text style={{ color: '#cbd5e1', fontSize: 10 }}>
                            · {new Date(userBoostEndsAt).toLocaleDateString()}
                          </Text>
                        ) : null}
                      </View>
                    )}
                    <PulsingBadge />
                </View>

                {/* Action Bar */}
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity
                      disabled={reacting || currentReaction === 'LIKE'}
                      onPress={() => reactToRaffle(item.id, 'LIKE')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: reacting ? 0.7 : 1 }}
                    >
                      <Ionicons name={currentReaction === 'LIKE' ? 'thumbs-up' : 'thumbs-up-outline'} size={26} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{likeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={reacting || currentReaction === 'HEART'}
                      onPress={() => reactToRaffle(item.id, 'HEART')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: reacting ? 0.7 : 1 }}
                    >
                      <Ionicons name={currentReaction === 'HEART' ? 'heart' : 'heart-outline'} size={26} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{heartCount}</Text>
                    </TouchableOpacity>
                        <TouchableOpacity onPress={() => shareRaffle(item)}>
                            <Ionicons name="paper-plane-outline" size={26} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                      disabled={playDisabled}
                      onPress={() => navigation.navigate('RaffleDetail', { raffle: item, startPurchase: true })}
                      style={{ backgroundColor: palette.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, opacity: playDisabled ? 0.55 : 1 }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                        {isAgotada ? 'AGOTADA' : isClosed ? 'CERRADA' : 'Jugar'}
                      </Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }}>{item.title}</Text>
                    {showDescription && (
                      <TouchableOpacity
                        disabled={!item?.user?.id}
                        activeOpacity={0.85}
                        onPress={() => item.user && setViewProfileId(item.user.id)}
                      >
                        <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{formatMoneyVES(priceValue, { decimals: 0 })}</Text>
                      {isAgotada ? (
                        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(239, 68, 68, 0.14)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.35)' }}>
                          <Text style={{ color: '#fecaca', fontSize: 11, fontWeight: '900' }}>AGOTADA</Text>
                        </View>
                      ) : (
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={{
                                width: 150,
                                height: 14,
                                borderRadius: 999,
                                backgroundColor: 'rgba(239, 68, 68, 0.22)',
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                                position: 'relative',
                                justifyContent: 'center',
                                alignItems: 'center'
                              }}
                            >
                              <View
                                style={{
                                  height: '100%',
                                  width: `${Math.max(2, percentLeft)}%`,
                                  backgroundColor: barFillColor,
                                  borderRadius: 999
                                }}
                              />
                              <Text
                                style={{
                                  position: 'absolute',
                                  color: '#fff',
                                  fontSize: 11,
                                  fontWeight: '900'
                                }}
                              >
                                {`${Math.round(percentLeft)}%`}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}
                    </View>
                </View>
              </View>
            );
        }}
      />
      <Modal visible={supportVisible} transparent animationType="slide" onRequestClose={() => setSupportVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={[styles.card, { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}> 
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Ayuda rápida</Text>
              <TouchableOpacity onPress={() => setSupportVisible(false)}>
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.muted}>FAQs rápidas:</Text>
            {[
              '¿Cómo valido mi pago? → El admin revisa y te notificamos en minutos.',
              '¿Cuándo se asignan los números? → Solo tras validar el pago.',
              '¿Qué pasa si se rechaza? → Puedes reenviar comprobante o elegir otra rifa.'
            ].map((faq) => (
              <View key={faq} style={styles.receiptCard}>
                <Text style={styles.muted}>{faq}</Text>
              </View>
            ))}
            <Text style={styles.section}>Contacto directo</Text>
            {techSupport && (
              <View style={{ marginBottom: 16, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <Text style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 4 }}>Soporte Técnico (App)</Text>
                <Text style={styles.muted}>Reportar fallas de la aplicación:</Text>
                {techSupport.phone && <Text style={{ color: '#cbd5e1', marginTop: 4 }}>WhatsApp: {techSupport.phone}</Text>}
                {techSupport.email && <Text style={{ color: '#cbd5e1' }}>Email: {techSupport.email}</Text>}
              </View>
            )}
            {raffles[0]?.support ? (
              <Text style={styles.muted}>
                WhatsApp: {raffles[0].support.whatsapp || '—'} · Instagram: {raffles[0].support.instagram || '—'} · Correo: {raffles[0].support.email || '—'}
              </Text>
            ) : (
              <Text style={styles.muted}>El organizador no ha configurado datos de contacto.</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder="Cuéntanos tu problema"
              value={supportMessage}
              onChangeText={setSupportMessage}
              multiline
            />
            <FilledButton
              title="Enviar mensaje"
              onPress={() => {
                setSupportVisible(false);
                setSupportMessage('');
                Alert.alert('Enviado', 'Hemos registrado tu mensaje. Te notificaremos cuando haya respuesta.');
              }}
              icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={postMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPostMenuVisible(false);
          setPostMenuRaffle(null);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setPostMenuVisible(false);
            setPostMenuRaffle(null);
          }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.card, { borderTopLeftRadius: 16, borderTopRightRadius: 16 }]}>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Opciones</Text>
              <TouchableOpacity
                onPress={() => {
                  setPostMenuVisible(false);
                  setPostMenuRaffle(null);
                }}
              >
                <Ionicons name="close" size={20} color={palette.text} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              disabled={!postMenuRaffle?.id || !postMenuRaffle?.user?.id}
              onPress={() => {
                const raffle = postMenuRaffle;
                setPostMenuVisible(false);
                setPostMenuRaffle(null);
                if (!raffle?.id || !raffle?.user?.id) return;
                navigation.navigate('Report', {
                  raffleId: raffle.id,
                  raffleTitle: raffle?.title || 'Rifa',
                  reportedUserId: raffle.user.id,
                  reportedUserName: raffle.user?.name || ''
                });
              }}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
            >
              <Ionicons name="flag-outline" size={20} color="#f87171" />
              <Text style={{ color: '#fff', fontWeight: '800', marginLeft: 12, flex: 1 }}>Denunciar y reportar</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPostMenuVisible(false);
                setPostMenuRaffle(null);
              }}
              style={{ marginTop: 8, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: palette.muted, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}>
          <View style={[styles.card, { padding: 20, borderRadius: 16 }]}> 
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.title, { marginBottom: 0 }]}>Cómo usar MegaRifas</Text>
              <TouchableOpacity onPress={() => setHelpVisible(false)}>
                <Ionicons name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>
            {[
              '1) Explora rifas y revisa la barra de disponibilidad.',
              '2) Compra: elige cantidad, paga y sube tu comprobante.',
              '3) Aprobación: el admin valida y recibes tus números.',
              '4) Resultado: revisa el muro de ganadores cuando cierre.'
            ].map((step) => (
              <Text key={step} style={{ color: palette.text, marginTop: 8 }}>{step}</Text>
            ))}
            <View style={{ marginTop: 16, backgroundColor: 'rgba(59,130,246,0.12)', padding: 12, borderRadius: 10 }}>
              <Text style={{ color: '#60a5fa', fontWeight: '700' }}>¿Dudas?</Text>
              <Text style={styles.muted}>Usa el botón de ayuda o el soporte del rifero en la ficha.</Text>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={walletQuickVisible} transparent animationType="fade" onRequestClose={() => setWalletQuickVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setWalletQuickVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 20 }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}} style={[styles.card, { padding: 18, borderRadius: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(20,184,166,0.20)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="wallet-outline" size={20} color={palette.accent} />
                </View>
                <View>
                  <Text style={[styles.section, { marginBottom: 0 }]}>Saldo</Text>
                  <Text style={styles.muted}>Disponible en tu cuenta</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setWalletQuickVisible(false)}>
                <Ionicons name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: 'rgba(168,85,247,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 26 }}>
                {walletBalance === null
                  ? 'Cargando...'
                  : `${formatMoneyVES(walletBalance, { withSymbol: false, decimals: 2 })} VES`}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={refreshWalletBalance}
                style={[styles.button, { flex: 1 }]}
              >
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={[styles.buttonText, { marginLeft: 8 }]}>Actualizar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setWalletQuickVisible(false)}
                style={[styles.button, styles.secondaryButton, { flex: 1 }]}
              >
                <Text style={styles.secondaryText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <PublicProfileModal visible={!!viewProfileId} userId={viewProfileId} onClose={() => setViewProfileId(null)} api={api} />
      </LinearGradient>
    </SafeAreaView>
  );
}
