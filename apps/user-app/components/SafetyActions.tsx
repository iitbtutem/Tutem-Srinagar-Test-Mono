import { Alert, Linking, StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Text } from '@tutem/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';
import { EMERGENCY_NUMBER } from '@/constants';
import { cn } from '@/lib/utils';

function SosPulse() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 650, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 650, easing: Easing.in(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 1 - (scale.value - 1) * 3,
  }));

  return (
    <Animated.View
      style={pulseStyle}
      className="absolute h-full w-full rounded-xl bg-red-500"
      pointerEvents="none"
    />
  );
}

async function handleSOS() {
  Alert.alert(
    '🆘 Call Emergency Services?',
    'This will call 112 (Police / Ambulance / Fire).',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call 112',
        style: 'destructive',
        onPress: async () => {
          try {
            await Linking.openURL(`tel:${EMERGENCY_NUMBER}`);
          } catch {
            Alert.alert('Error', 'Unable to make calls on this device.');
          }
        },
      },
    ],
    { cancelable: true }
  );
}

async function handleTrack() {
  const whatsappApp = 'whatsapp://';
  const whatsappWeb = 'https://wa.me';

  try {
    const supported = await Linking.canOpenURL(whatsappApp);
    await Linking.openURL(supported ? whatsappApp : whatsappWeb);
  } catch {
    Alert.alert(
      'WhatsApp not found',
      'Please install WhatsApp to share your live location with a contact.',
      [{ text: 'OK' }]
    );
  }
}

export function Sos({
  variant = 'full',
  className,
  style,
  size = 'lg',
}: {
  variant?: 'full' | 'compact';
  className?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handleSOS}
        style={style}
        className={cn(
          'z-40 aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-white bg-red-600 shadow-md',
          {
            'text-2 w-10 font-bold': size === 'sm',
            'text-3 w-12 font-bold': size === 'md',
            'text-4 w-4 font-bold': size === 'lg',
          },
          className
        )}
        accessibilityLabel="SOS emergency call"
        accessibilityRole="button">
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
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleSOS}
      style={style}
      className={`z-40 w-fit flex-row items-center justify-center gap-2 overflow-hidden rounded-xl bg-destructive px-3 py-2 shadow-lg ${className}`}
      accessibilityLabel="SOS emergency call"
      accessibilityRole="button">
      <SosPulse />
      <MaterialCommunityIcons name="alarm-light" size={18} color="white" />
      <Text className="text-sm font-extrabold tracking-widest text-white">SOS</Text>
    </TouchableOpacity>
  );
}

export function Track({
  variant = 'full',
  className,
  style,
  size = 'lg',
}: {
  variant?: 'full' | 'compact';
  className?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={handleTrack}
        style={style}
        className={cn(
          'z-40 aspect-square items-center justify-center rounded-full border-2 border-white bg-primary shadow-md',
          {
            'text-2 w-10 font-bold': size === 'sm',
            'text-3 w-12 font-bold': size === 'md',
            'text-4 w-14 font-bold': size === 'lg',
          },
          className
        )}
        accessibilityLabel="Share live location via WhatsApp"
        accessibilityRole="button">
        <MaterialCommunityIcons
          name="whatsapp"
          size={size === 'sm' ? 12 : size === 'md' ? 14 : 18}
          color="white"
        />
        <Text
          className={cn('-pt-3 font-black text-white', {
            'text-[8px]': size === 'sm',
            'text-[10px]': size === 'md',
            'text-[12px]': size === 'lg',
          })}>
          Track
        </Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handleTrack}
      style={style}
      className={`z-40 w-fit flex-row items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 shadow-lg ${className}`}
      accessibilityLabel="Share live location on WhatsApp"
      accessibilityRole="button">
      <MaterialCommunityIcons name="whatsapp" size={18} color="white" />
      <Text className="text-sm font-extrabold text-white">Track Me</Text>
    </TouchableOpacity>
  );
}
