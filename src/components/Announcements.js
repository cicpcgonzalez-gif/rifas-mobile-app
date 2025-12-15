import React, { useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { palette } from '../theme';
import { styles } from '../styles';

export default function Announcements({ api, onShowProfile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { res, data } = await api('/announcements');
    if (res.ok) setItems(data);
    setLoading(false);
  }, [api]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const react = async (id, type) => {
    const { res, data } = await api(`/announcements/${id}/react`, { method: 'POST', body: JSON.stringify({ type }) });
    if (res.ok) load(); 
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
                <Text style={{ color: palette.text, fontWeight: 'bold' }}>{item.admin?.name || 'Admin'}</Text>
                <Text style={{ color: palette.muted, fontSize: 10 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          </View>
          
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ color: palette.subtext, marginBottom: 8 }}>{item.content}</Text>
          
          {item.imageUrl && (
            <Image source={{ uri: item.imageUrl }} style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 8 }} resizeMode="cover" />
          )}

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={() => react(item.id, 'LIKE')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="thumbs-up-outline" size={18} color={palette.muted} />
              <Text style={styles.muted}>{item._count?.reactions || 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => react(item.id, 'HEART')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="heart-outline" size={18} color={palette.muted} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
