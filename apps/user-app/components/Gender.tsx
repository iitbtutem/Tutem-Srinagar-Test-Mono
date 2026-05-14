import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Text } from './ui/text';

type Gender = 'Male' | 'Female' | 'Other';
export default function Gender({ gender }: { gender: Gender }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start rounded-full bg-green-500/25 px-3 py-1">
      <MaterialIcons
        name={gender === 'Male' ? 'male' : gender === 'Female' ? 'female' : 'transgender'}
        size={13}
        color="black"
      />
      <Text className="text-xs font-medium text-primary">{gender}</Text>
    </View>
  );
}
