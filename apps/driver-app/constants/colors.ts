import { colorScheme } from 'nativewind';

const isDark = colorScheme.get() === 'dark';
export const BottomSheetBackgroundColor = isDark ? '#0f0f12' : '#FAFAFA';
export const BottomSheetIndicatorColor = isDark ? '#2a2a35' : '#D1D5DB';

export const iconColor = isDark ? '#fff' : '#000';
export const iconBackgroundColor = isDark ? '#00000035' : '#ffffff35';

export const VERIFICATION_CONFIG = {
  Verified: {
    icon: 'check-circle',
    color: '#10b981',
    label: 'Verified',
  },
  Pending: {
    icon: 'clock',
    color: '#ed921c', // yellow-500
    label: 'Pending',
  },
  Rejected: {
    icon: 'x-circle',
    color: '#ef4444',
    label: 'Rejected',
  },
} as const;
