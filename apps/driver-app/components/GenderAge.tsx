import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Text } from '@tutem/ui';
import { getAge } from '@/lib/utils';

type Gender = 'Male' | 'Female' | 'Other';
export default function GenderAge({ gender, dob }: { gender: Gender, dob: string }) {
  const age = getAge(new Date(dob));
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-md bg-primary/5 px-3 py-1">      
      <Text className="text-xs font-medium text-primary">{`${gender} | ${age}`}</Text>
    </View>
  );
}
