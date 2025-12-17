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
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
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
      const activeOnly = data.filter((r) => r.status !== 'closed');
      setRaffles(activeOnly);
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
        data={loading ? [] : raffles
          .filter((r) => {
            const q = String(searchQuery || '').trim().toLowerCase();
            if (!q) return true;
            const haystack = `${r?.title || ''} ${r?.prize || ''} ${r?.lottery || ''}`.toLowerCase();
            return haystack.includes(q);
          })
          .slice()
          .sort((a, b) => {
            if (filter === 'cheap') return Number(a.price || 0) - Number(b.price || 0);
            if (filter === 'closing') return new Date(a.endDate || 0) - new Date(b.endDate || 0);
            return 0;
        })}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 }]}
        ListHeaderComponent={
          <>
            <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', position: 'relative' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>MEGA RIFAS</Text>
                {techSupport && (
                  <TouchableOpacity 
                    onPress={() => setSupportVisible(true)} 
                    style={{ position: 'absolute', right: 0, padding: 8 }}
                  >
                    <Ionicons name="help-circle-outline" size={28} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ height: 4, width: 60, backgroundColor: palette.primary, borderRadius: 2, marginTop: 4 }} />
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

            <Announcements api={api} onShowProfile={setViewProfileId} />
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
            const total = item.totalTickets || stats.total || 0;
            const sold = stats.sold || 0;
            const remaining = stats.remaining ?? (total ? Math.max(total - sold, 0) : 0);
            const percentLeft = total ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
            const lowStock = total && percentLeft <= 10;

            const reactionCounts = item.reactionCounts || {};
            const likeCount = reactionCounts.LIKE ?? 0;
            const heartCount = reactionCounts.HEART ?? 0;
            
            const gallery = Array.isArray(item.style?.gallery) && item.style.gallery.length
              ? item.style.gallery
              : item.style?.bannerImage
              ? [item.style.bannerImage]
              : [];

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
                          {item.user?.identityVerified && (
                              <Text style={{ color: '#94a3b8', fontSize: 10 }}>Verificado</Text>
                          )}
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('RaffleDetail', { raffle: item })}>
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
                                    style={{ width: Dimensions.get('window').width, height: '100%' }} 
                                    resizeMode="cover" 
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
                    <PulsingBadge />
                </View>

                {/* Action Bar */}
                <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Reacciones', 'Pronto podrás dar like a las rifas desde aquí.')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Ionicons name="thumbs-up-outline" size={26} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{likeCount}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('Reacciones', 'Pronto podrás enviar corazones a las rifas desde aquí.')}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Ionicons name="heart-outline" size={26} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{heartCount}</Text>
                    </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('RaffleDetail', { raffle: item })}>
                            <Ionicons name="chatbubble-outline" size={26} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => shareRaffle(item)}>
                            <Ionicons name="paper-plane-outline" size={26} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                        onPress={() => navigation.navigate('RaffleDetail', { raffle: item })}
                        style={{ backgroundColor: palette.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>Jugar</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View style={{ paddingHorizontal: 12, paddingBottom: 16 }}>
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginBottom: 4 }}>{item.title}</Text>
                    <Text style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>{item.user?.name || 'MegaRifas'} </Text>
                        {item.description}
                    </Text>
                    
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#fbbf24', fontWeight: 'bold' }}>{formatMoneyVES(item.price, { decimals: 0 })}</Text>
                        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
                            {remaining} tickets restantes
                        </Text>
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
      <PublicProfileModal visible={!!viewProfileId} userId={viewProfileId} onClose={() => setViewProfileId(null)} api={api} />
      </LinearGradient>
    </SafeAreaView>
  );
}
