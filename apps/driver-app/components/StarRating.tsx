import { View } from "react-native";
import { Text } from "./ui/text";



export default function StarRating({ rating }: { rating: { average: number | null; totalRatings: number } }) {
  if (rating.average === null) return null;
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-amber-400 text-xs">★</Text>
      <Text className="text-slate-400 text-xs font-semibold">{rating.average.toFixed(1)}</Text>
      <Text className="text-slate-600 text-xs">({rating.totalRatings})</Text>
    </View>
  );
}