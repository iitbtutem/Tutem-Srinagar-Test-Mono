import { getAge } from '@/lib/utils';
import { View } from 'react-native';
import { Text } from './ui/text';

export default function Age({ dob }: { dob: string }) {
  const age = getAge(new Date(dob));
  
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-green-500/25 px-3 py-1">
      <Text className="text-xs font-medium text-primary">{age}</Text>
    </View>
  );
}
