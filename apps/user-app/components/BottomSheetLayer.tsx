import { View } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedProps, useAnimatedStyle, useDerivedValue } from "react-native-reanimated";

// SheetLayer
type SheetLayerProps = {
  children: React.ReactNode;
  animatedIndex: SharedValue<number>;
  visibleFrom?: number;
  visibleUntil?: number;
};
const AnimatedView = Animated.createAnimatedComponent(View);
export default function SheetLayer({ children, animatedIndex, visibleFrom = 0, visibleUntil }: SheetLayerProps) {
  const opacity = useDerivedValue(() => {
    const inputRange =
      visibleUntil !== undefined
        ? [visibleFrom - 0.3, visibleFrom, visibleUntil, visibleUntil + 0.3]
        : [visibleFrom - 0.3, visibleFrom];
    const outputRange = visibleUntil !== undefined ? [0, 1, 1, 0] : [0, 1];
    return interpolate(animatedIndex.value, inputRange, outputRange, Extrapolation.CLAMP);
  });

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedProps = useAnimatedProps(() => ({
    pointerEvents: opacity.value > 0.1 ? ('box-none' as const) : ('none' as const),
  }));

  return (
    <AnimatedView
      animatedProps={animatedProps}
      style={[{ position: 'absolute', top: 0, left: 0, right: 0 }, animatedStyle]}>
      {children}
    </AnimatedView>
  );
}