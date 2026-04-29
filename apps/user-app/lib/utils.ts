import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NavigationProp, ParamListBase } from '@react-navigation/native';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const createBottomSheetTabBarHandlers = (navigation: NavigationProp<ParamListBase>) => ({
  onAnimate: (fromIndex: number, toIndex: number): void => {
    if (toIndex > -1) {
      navigation.setOptions({
        tabBarStyle: { display: 'none' },
        contentStyle: { height: 60, opacity: 0 },
      });
    }
  },
  onChange: (index: number): void => {
    if (index < 0) {
      navigation.setOptions({
        tabBarStyle: { display: 'flex' },
        contentStyle: { height: undefined },
      });
    }
  },
});

export function formatFare(amount?: number) {
  if (!amount) return '—';
  return `₹${amount.toFixed(0)}`;
}

export function distanceFormat(number: number) {
  return new Intl.NumberFormat("en-In", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(number) + " km";
}