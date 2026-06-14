import { View } from "react-native";
import { Text } from '@tutem/ui';



function Rating({ rating }: { rating: { average: number | null; totalRatings: number } }) {
  if (rating.average === null) return null;

  const averageRating = Math.round(rating.average * 10) / 10;
  
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-amber-400 text-xs">★</Text>
      <Text className="text-slate-600 text-xs font-semibold">{averageRating}<Text className="text-slate-400 text-xs">({rating.totalRatings})</Text></Text>
    </View>
  );
}

export { Rating }