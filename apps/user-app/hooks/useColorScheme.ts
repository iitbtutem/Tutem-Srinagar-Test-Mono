import { useColorScheme } from "nativewind";

export const useThemeColors = () => {
  const { colorScheme } = useColorScheme();

  const isDark = colorScheme === "dark";

  return {
    BottomSheetBackgroundColor: isDark ? "#0f0f12" : "#FAFAFA",
    BottomSheetIndicatorColor: isDark ? "#2a2a35" : "#D1D5DB",
    iconColor: isDark ? "#fff" : "#000",
    iconBackgroundColor: isDark ? "#00000035" : "#ffffff35",
  };
};

export default useThemeColors;