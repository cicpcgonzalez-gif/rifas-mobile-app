import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { palette } from '../theme';

function formatTickerItem(item) {
  const userName = item?.user?.name ? String(item.user.name) : 'Alguien';
  const ticketNumber = item?.ticketNumber != null ? `#${item.ticketNumber}` : '#—';
  const raffleTitle = item?.raffle?.title ? String(item.raffle.title) : 'Rifa';
  const prize = item?.prize ? String(item.prize) : '';
  const prizePart = prize ? ` (${prize})` : '';
  return `Ganador bendecido: ${userName} ${ticketNumber} - ${raffleTitle}${prizePart}`;
}

export default function WinnersTicker({ api, enabled }) {
  const [items, setItems] = useState([]);
  const seenIdsRef = useRef(new Set());

  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);

  const translateX = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  const text = useMemo(() => {
    const parts = (items || []).map(formatTickerItem).filter(Boolean);
    return parts.join(' | ');
  }, [items]);

  useEffect(() => {
    if (!enabled || typeof api !== 'function') return;

    let alive = true;

    const poll = async () => {
      try {
        const { res, data } = await api('/feed/instant-wins?take=20');
        if (!alive) return;
        if (!res?.ok || !Array.isArray(data)) return;

        // API viene ordenado desc (más nuevos primero). Para ticker, agregamos al final en orden asc.
        const ordered = [...data].reverse();
        const next = [];
        for (const w of ordered) {
          const id = w?.id;
          if (!id) continue;
          if (seenIdsRef.current.has(id)) continue;
          seenIdsRef.current.add(id);
          next.push(w);
        }
        if (next.length > 0) {
          setItems((prev) => {
            const merged = [...(prev || []), ...next];
            // Capear historial para evitar crecimiento ilimitado en memoria
            return merged.slice(-200);
          });
        }
      } catch (e) {
        // Evitar que fallos de red frecuentes saturen la UI en datos móviles
        console.log('WinnersTicker poll error', e?.message || e);
      }
    };

    poll();
    // Reducir frecuencia de polling para conexiones móviles (menos gasto y menos latencia percibida)
    const id = setInterval(poll, 60_000);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, enabled]);

  useEffect(() => {
    // Reiniciar animación cuando tengamos medidas válidas y texto no vacío.
    if (!enabled) return;
    if (!text || !containerWidth || !textWidth) return;

    // Cancelar animación anterior
    if (animRef.current) {
      animRef.current.stop();
      animRef.current = null;
    }

    // Dirección solicitada: derecha -> izquierda (marquee clásico)
    translateX.setValue(containerWidth);

    const speedPxPerSec = 45; // velocidad constante, simple y legible
    const distance = containerWidth + textWidth;
    const durationMs = Math.max(12_000, Math.round((distance / speedPxPerSec) * 1000));

    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: -textWidth,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    animRef.current = anim;
    anim.start();

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [containerWidth, textWidth, text, enabled, translateX]);

  if (!enabled) return null;
  if (!text) return null;

  return (
    <View
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      style={styles.container}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        <Text
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          numberOfLines={1}
          style={styles.text}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = {
  container: {
    height: 34,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: palette.background,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingHorizontal: 12
  },
  text: {
    color: palette.subtext,
    fontSize: 13,
    fontWeight: '700'
  }
};
