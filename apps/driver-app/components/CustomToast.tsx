import { createContext, useContext, useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { cn } from '@/lib/utils';

export const useToast = () => useContext(ToastContext);

type ToastType = 'success' | 'error' | 'info';

type Toast = {
  title: string;
  description?: string;
  type: ToastType;
  position?: 'top' | 'bottom' | 'center';
};

const ToastContext = createContext<any>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = ({ title, description, type, position = 'top' }: Toast) => {
    setToast({ title, description, type, position });

    setTimeout(() => {
      setToast(null);
    }, 3000); // ✅ fixed
  };

  const getIcon = () => {
    switch (toast?.type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={22} color="white" />;
      case 'error':
        return <Ionicons name="close-circle" size={22} color="white" />;
      default:
        return <Ionicons name="information-circle" size={22} color="white" />;
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
            'top-1/2': toast.position === 'center',
          })}>
          <View
            className={`flex-row items-start gap-3 rounded-lg px-4 py-3 shadow-lg ${
              toast.type === 'success'
                ? 'bg-green-500'
                : toast.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-gray-800'
            }`}>
            {/* Icon */}
            {getIcon()}

            {/* Text */}
            <View className="flex-1">
              <Text className="font-semibold text-white">{toast.title}</Text>

              {toast.description && (
                <Text className="mt-1 text-sm text-white/90">{toast.description}</Text>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
