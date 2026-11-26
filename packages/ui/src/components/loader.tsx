import React, { useEffect, useId, useRef } from "react";
import {
  View,
  Text,
  Animated,
  BackHandler,
  Platform,
  StyleSheet,
} from "react-native";
import { Portal } from "@rn-primitives/portal";

// Transient loading stays in the app's view tree, without a separate native window.
function Loader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const portalId = useId();
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
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
    );
    animation.start();
    return () => {
      animation.stop();
      waveAnim.stopAnimation();
    };
  }, [waveAnim]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => subscription.remove();
  }, []);

  const letters = "TUTEM".split("");

  return (
    <Portal name={`loader-${portalId}`}>
      <View
        style={styles.overlay}
        className="items-center justify-center bg-black/40"
        accessibilityViewIsModal
        accessibilityRole="progressbar"
        accessibilityLabel={subtitle || title || "Loading"}
        accessibilityLiveRegion="polite"
        onStartShouldSetResponder={() => true}>
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
                        outputRange: [
                          0,
                          -6 * Math.sin((index * Math.PI) / 2),
                          0,
                        ],
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

          {title && (
            <Text className="mt-4 text-center text-sm font-semibold text-gray-700">
              {title}
            </Text>
          )}
          <Text className="mt-1 text-center text-xs text-gray-500">
            {subtitle ? `${subtitle}…` : "loading…"}
          </Text>
        </View>
      </View>
    </Portal>
  );
}

export { Loader };

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
});
