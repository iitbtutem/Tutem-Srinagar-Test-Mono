import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Text } from '@tutem/ui';

type Gender = 'Male' | 'Female' | 'Other';
export default function Gender({ gender }: { gender: Gender }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-primary/15 px-3 py-1">
      <MaterialIcons
        name={gender === 'Male' ? 'male' : gender === 'Female' ? 'female' : 'transgender'}
        size={13}
        color="#4287f5"
      />
      <Text className="text-xs font-medium text-primary">{gender}</Text>
    </View>
  );
}
