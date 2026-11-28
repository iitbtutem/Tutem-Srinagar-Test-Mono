import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ToastMessage, { type ToastConfig, type ToastConfigParams } from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info' | 'warning';

type Toast = {
  title: string;
  description?: string;
  type: ToastType;
  position?: 'top' | 'bottom' | 'center';
};

type ToastContextType = {
  showToast: (toast: Toast) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const toastVariants = {
  success: { background: 'bg-green-500', icon: 'checkmark-circle' },
  error: { background: 'bg-red-500', icon: 'close-circle' },
  info: { background: 'bg-gray-800', icon: 'information-circle' },
  warning: { background: 'bg-amber-700', icon: 'warning' },
} as const;

type ToastCardProps = ToastConfigParams<{ centered?: boolean }> & { variant: ToastType };

function ToastCard({ text1, text2, props, variant }: ToastCardProps) {
  const { width } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const { background, icon } = toastVariants[variant];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      style={{
        width: width - 32,
        // The library supports top/bottom; offset the card to retain our center option.
        transform: [{ translateY: props.centered ? -height / 2 : 0 }],
      }}
      className={`flex-row items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${background}`}>
      <Ionicons name={icon} size={26} color="white" />
      <View className="flex-1">
        <Text className="font-semibold text-white">{text1}</Text>
        {!!text2 && <Text className="mt-1 text-sm text-white/90">{text2}</Text>}
      </View>
    </View>
  );
}

const toastConfig: ToastConfig = {
  success: (params) => <ToastCard {...params} variant="success" />,
  error: (params) => <ToastCard {...params} variant="error" />,
  info: (params) => <ToastCard {...params} variant="info" />,
  warning: (params) => <ToastCard {...params} variant="warning" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();
  const showToast = useCallback(
    ({ title, description, type, position = 'top' }: Toast) => {
      ToastMessage.show({
        type,
        text1: title,
        text2: description,
        position: position === 'bottom' ? 'bottom' : 'top',
        topOffset: position === 'center' ? height / 2 : 40,
        props: { centered: position === 'center' },
      });
    },
    [height]
  );
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastMessage
        config={toastConfig}
        visibilityTime={3000}
        autoHide
        swipeable
        topOffset={40}
        bottomOffset={40}
      />
    </ToastContext.Provider>
  );
}
