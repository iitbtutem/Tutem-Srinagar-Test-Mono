import { colorScheme } from 'nativewind';

const isDark = colorScheme.get() === 'dark';
export const BottomSheetBackgroundColor = isDark ? '#0f0f12' : '#FAFAFA';
export const BottomSheetIndicatorColor = isDark ? '#2a2a35' : '#D1D5DB';

export const iconColor = isDark ? '#fff' : '#fff';
export const iconBackgroundColor = isDark ? '#00000035' : '#ffffff35'