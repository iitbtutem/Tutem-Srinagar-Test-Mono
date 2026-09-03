import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  View,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@tutem/ui';
import { cn } from '@/lib/utils';
import { callEmergencyServices } from '@/lib/linking';
import AnimatedReanimated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

export function SosPulse() {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 650, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 650, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: 1 - (pulseScale.value - 1) * 3,
  }));

  return (
    <AnimatedReanimated.View
      style={pulseStyle}
      className="absolute h-full w-full rounded-full bg-red-500"
      pointerEvents="none"
    />
  );
}

export interface DraggableSosProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  storageKey?: string;
  onPress?: () => void;
  topOffset?: number;
  bottomOffset?: number;
}

export function DraggableSos({
  className,
  style,
  size = 'lg',
  storageKey = 'sos_home_favorite_position',
  onPress = callEmergencyServices,
  topOffset = 8,
  bottomOffset = 20,
}: DraggableSosProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null
  );

  const buttonSize = size === 'sm' ? 40 : size === 'md' ? 48 : 56;

  // Real measured container dimensions (inside the screen between top header and bottom tab bar)
  const availableWidth = containerSize?.width ?? windowWidth;
  const availableHeight =
    containerSize?.height ?? Math.max(300, windowHeight - insets.top - insets.bottom - 60);

  const minX = 12;
  const maxX = Math.max(minX, availableWidth - buttonSize - 12);
  // Minimize wasted space on top: allows positioning comfortably near the top
  const minY = Math.max(0, topOffset);
  // Guarantee clearance above the bottom tab bar
  const maxY = Math.max(minY, availableHeight - buttonSize - bottomOffset);

  const defaultX = maxX;
  const defaultY = maxY;

  const boundsRef = useRef({ minX, maxX, minY, maxY });
  boundsRef.current = { minX, maxX, minY, maxY };

  const pan = useRef(new Animated.ValueXY({ x: defaultX, y: defaultY })).current;
  const lastPosition = useRef({ x: defaultX, y: defaultY });
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const isDragging = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function initPosition() {
      let initialX = defaultX;
      let initialY = defaultY;

      try {
        const saved = await SecureStore.getItemAsync(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
            initialX = Math.max(minX, Math.min(parsed.x, maxX));
            initialY = Math.max(minY, Math.min(parsed.y, maxY));
          }
        }
      } catch {
        // Fallback to default coordinates
      }

      if (isMounted) {
        lastPosition.current = { x: initialX, y: initialY };
        pan.setValue({ x: initialX, y: initialY });
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    }

    initPosition();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  // When container is measured, re-clamp if previous saved coordinates were out of bounds
  useEffect(() => {
    if (containerSize) {
      const clampedX = Math.max(minX, Math.min(lastPosition.current.x, maxX));
      const clampedY = Math.max(minY, Math.min(lastPosition.current.y, maxY));
      if (clampedX !== lastPosition.current.x || clampedY !== lastPosition.current.y) {
        lastPosition.current = { x: clampedX, y: clampedY };
        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: false,
          friction: 6,
          tension: 40,
        }).start();
        SecureStore.setItemAsync(
          storageKey,
          JSON.stringify({ x: clampedX, y: clampedY })
        ).catch(() => {});
      }
    }
  }, [containerSize, minX, maxX, minY, maxY, storageKey]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({
          x: lastPosition.current.x,
          y: lastPosition.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
        Animated.spring(scale, {
          toValue: 1.1,
          useNativeDriver: false,
          friction: 6,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4) {
          isDragging.current = true;
        }
        pan.x.setValue(gestureState.dx);
        pan.y.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 5,
        }).start();

        const distance = Math.hypot(gestureState.dx, gestureState.dy);
        if (distance < 6 && !isDragging.current) {
          // Tapped without significant drag: execute action
          onPress();
          return;
        }

        // Drag released: clamp to measured safe screen bounds
        const { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY } = boundsRef.current;
        const rawX = lastPosition.current.x + gestureState.dx;
        const rawY = lastPosition.current.y + gestureState.dy;

        const clampedX = Math.max(bMinX, Math.min(rawX, bMaxX));
        const clampedY = Math.max(bMinY, Math.min(rawY, bMaxY));

        lastPosition.current = { x: clampedX, y: clampedY };

        // Keep bouncy spring dynamics alive
        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: false,
          friction: 5,
          tension: 45,
        }).start();

        // Save favorite position to SecureStore
        SecureStore.setItemAsync(
          storageKey,
          JSON.stringify({ x: clampedX, y: clampedY })
        ).catch(() => {});
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
        }).start();
        Animated.spring(pan, {
          toValue: { x: lastPosition.current.x, y: lastPosition.current.y },
          useNativeDriver: false,
          friction: 6,
          tension: 40,
        }).start();
      },
    })
  ).current;

  return (
    <View
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w > 0 && h > 0) {
          setContainerSize({ width: w, height: h });
        }
      }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999,
            elevation: 9999,
            opacity,
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
          },
          style,
        ]}
        accessibilityLabel="SOS emergency call"
        accessibilityRole="button"
        accessibilityHint="Drag to reposition anywhere on the screen, tap to call emergency services">
        <View
          className={cn(
            'aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-white bg-red-600 shadow-xl',
            {
              'w-10': size === 'sm',
              'w-12': size === 'md',
              'w-14': size === 'lg',
            },
            className
          )}
          style={{
            shadowColor: '#dc2626',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.45,
            shadowRadius: 8,
            elevation: 8,
          }}>
          <SosPulse />
          <MaterialCommunityIcons
            name="alarm-light"
            size={size === 'sm' ? 12 : size === 'md' ? 14 : 18}
            color="white"
          />
          <Text
            className={cn('-pt-3 font-black text-white', {
              'text-[8px]': size === 'sm',
              'text-[10px]': size === 'md',
              'text-[12px]': size === 'lg',
            })}>
            SOS
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
