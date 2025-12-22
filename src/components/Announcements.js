import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Image, TouchableOpacity, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';

export default function Announcements({ api, onShowProfile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reactingIds, setReactingIds] = useState(new Set());
  const [myReactions, setMyReactions] = useState({});
  const [imageRatios, setImageRatios] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { res, data } = await api('/announcements');
    if (res.ok) setItems(data);
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const react = async (id, type) => {
    if (!id) return;
    setReactingIds((prev) => new Set(prev).add(id));

    // Optimista: togglear localmente para feedback inmediato
    setMyReactions((prev) => {
      const current = prev[id] || null;
      const next = current === type ? null : type;
      return { ...prev, [id]: next };
    });

    try {
      const { res, data } = await api(`/announcements/${id}/react`, { method: 'POST', body: JSON.stringify({ type }) });
      if (res.ok) {
        // Refrescar en background para cuadrar contadores del servidor
        load();
      } else {
        // Si es tema de sesión/token, no mostrar alert aquí. El manejo global llevará a login.
        const msg = String(data?.error || '').toLowerCase();
        const isAuthIssue = res.status === 401 || res.status === 403 || msg.includes('sesión expirada') || msg.includes('sesion expirada') || msg.includes('token');
        if (!isAuthIssue) {
          // Mantener silencioso por UX (anuncios no es crítico)
          console.log('Announcement react error:', res.status, data);
        }
      }
    } finally {
      setReactingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const shareAnnouncement = async (item) => {
    try {
      const title = item?.title || 'Publicación';
      const content = item?.content || '';
      // Link que abre la app (custom scheme definido en app.json)
      const appLink = 'megarifas://';
      await Share.share({
        message: `${title}\n\n${content}\n\nAbrir en MegaRifas: ${appLink}`
      });
    } catch (_e) {
      // Silenciar
    }
  };

  if (loading && !items.length) return <ActivityIndicator color={palette.primary} />;

  return (
    <View>
      <Text style={styles.section}>Novedades</Text>
      {items.map(item => (
        <View key={item.id} style={[styles.card, { marginBottom: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <TouchableOpacity onPress={() => onShowProfile(item.adminId)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {item.admin?.avatar ? (
                <Image source={{ uri: item.admin.avatar }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8 }} />
              ) : (
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.surface, marginRight: 8 }} />
              )}
              <View>
                <Text style={{ color: palette.text, fontWeight: 'bold' }}>{item.admin?.name || 'Rifero'}</Text>
                <Text style={{ color: palette.muted, fontSize: 10 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ color: palette.subtext, marginBottom: 8 }}>{item.content}</Text>
          
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              onLoad={(e) => {
                const src = e?.nativeEvent?.source || {};
                const iw = Number(src.width);
                const ih = Number(src.height);
                if (!iw || !ih) return;
                const ratio = iw / ih;
                setImageRatios((prev) => (prev[item.id] === ratio ? prev : { ...prev, [item.id]: ratio }));
              }}
              style={{ width: '100%', aspectRatio: imageRatios[item.id] || 16 / 9, borderRadius: 8, marginBottom: 8, backgroundColor: palette.surface }}
              resizeMode="contain"
            />
          )}

          {(() => {
            const counts = item.reactionCounts || {};
            const likeCount = counts.LIKE ?? 0;
            const heartCount = counts.HEART ?? 0;
            const current = myReactions[item.id] || null;
            const busy = reactingIds.has(item.id);

            const likeActive = current === 'LIKE';
            const heartActive = current === 'HEART';

            return (
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => react(item.id, 'LIKE')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}
                >
                  <Ionicons name={likeActive ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={likeActive ? palette.primary : palette.muted} />
                  <Text style={styles.muted}>{likeCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={busy}
                  onPress={() => react(item.id, 'HEART')}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}
                >
                  <Ionicons name={heartActive ? 'heart' : 'heart-outline'} size={18} color={heartActive ? '#ef4444' : palette.muted} />
                  <Text style={styles.muted}>{heartCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => shareAnnouncement(item)}
                  style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <Ionicons name="share-social-outline" size={18} color={palette.muted} />
                  <Text style={styles.muted}>Compartir</Text>
                </TouchableOpacity>
              </View>
            );
          })()}

        </View>
      ))}
    </View>
  );
}
