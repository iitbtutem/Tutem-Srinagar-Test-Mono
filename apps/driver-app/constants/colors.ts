import { colorScheme } from "nativewind";

const isDark = colorScheme.get() === "dark";
export const BottomSheetBackgroundColor = isDark ? '#0f0f12' : '#FAFAFA'
export const BottomSheetIndicatorColor = isDark ? '#2a2a35' : '#D1D5DB'