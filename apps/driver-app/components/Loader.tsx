import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Modal } from 'react-native';
import { boolean } from 'zod';

export default function Loader({ title, subtitle }: { title?: string, subtitle?: string }) {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const letters = 'TUTEM'.split('');

  return (
    <Modal
      transparent
      visible={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/40">
        <View className="rounded-2xl bg-white p-6 shadow-2xl">
        <View className="flex-row items-center justify-center gap-1">
          {letters.map((letter, index) => (
            <Animated.Text
              key={index}
              className="text-sm font-extrabold text-primary"
              style={{
                transform: [
                  {
                    translateY: waveAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, -6 * Math.sin(index * Math.PI / 2), 0],
                    }),
                  },
                ],
                opacity: waveAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.5, 1, 0.5],
                }),
              }}>
              {letter}
            </Animated.Text>
          ))}
        </View>

        {title && <Text className="mt-4 text-center text-sm font-semibold text-gray-700">
          {title}
        </Text>}
        <Text className="mt-1 text-center text-xs text-gray-500">
          {subtitle ? `${subtitle}…` : 'loading…'}
        </Text>
      </View>
    </View>
    </Modal>
  );
}