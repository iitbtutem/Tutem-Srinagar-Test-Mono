import { NavigationProp, ParamListBase } from '@react-navigation/native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

