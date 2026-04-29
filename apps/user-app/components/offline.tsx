import { View } from 'react-native';
import { Text } from './ui/text';
import OfflineSvg from '@/assets/svgs/offline';

export default function Offline() {
  return (
    <View className="flex-1 items-center justify-center p-4 mb-20">
      <OfflineSvg width={300} height={300} />
      <Text className="text-2xl font-bold text-gray-800">You are offline</Text>
      <Text className="mt-2 text-center text-gray-600">
        Please check your internet connection and try again.
      </Text>
    </View>
  );
}
