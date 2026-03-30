import { createContext, useContext, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInUp,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  title: string;
  description?: string;
  type: ToastType;
  position?: 'top' | 'bottom' | 'center';
};

type ToastContextType = {
  showToast: (toast: Toast) => void;
};
// Type safety for toast
const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const scale = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // ✅ FIX: re-run animation whenever toast changes
  useEffect(() => {
    if (toast) {
      scale.value = 0; // reset
      scale.value = withSpring(1.5, {}, () => {
        scale.value = withSpring(1);
      });
    }
  }, [toast]);

  const showToast = ({ title, description, type, position = 'top' }: Toast) => {
    setToast({ title, description, type, position });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const getIconName = () => {
    switch (toast?.type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      default:
        return 'information-circle';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {toast && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(300)}
          className={cn('absolute left-4 right-4', {
            'top-10': toast.position === 'top',
            'bottom-10': toast.position === 'bottom',
            'top-1/2 -translate-y-1/2': toast.position === 'center', // ✅ FIX center
          })}>
          <View
            className={`flex-row items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500'
                : toast.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-800'
            }`}>
            {/* ✅ FIX: actually render icon */}
            <AnimatedIonicons
              key={toast.type} // 🔥 ensures animation retriggers
              name={getIconName()}
              size={26}
              color="white"
              style={animatedStyle}
            />

            {/* Text */}
            <View className="flex-1">
              <Text className="truncate font-semibold text-white" numberOfLines={1}>
                {toast.title}
              </Text>

              {toast.description && (
                <Text className="mt-1 truncate text-sm text-white/90" numberOfLines={1}>
                  {toast.description}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
