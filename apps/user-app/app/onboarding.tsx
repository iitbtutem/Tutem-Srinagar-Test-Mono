import { View } from 'react-native';
import { Text, Button } from '@tutem/ui';
import { useRouter } from 'expo-router';
import { ShieldCheck, Users, IndianRupee, CreditCard } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';


const features = [
  {
    title: 'Choose Your Driver',
    description: 'Browse and select from available drivers based on your preference.',
    icon: Users,
  },
  {
    title: 'Market-Based Pricing',
    description: 'Travel at prevailing market rates with transparent fare information.',
    icon: IndianRupee,
  },
  {
    title: 'Direct Driver Payments',
    description: 'Pay the driver directly without intermediaries.',
    icon: CreditCard,
  },
  {
    title: 'Verified Drivers',
    description: 'Identify and travel with verified drivers for added confidence.',
    icon: ShieldCheck,
  },
];

export default function Onboarding() {
  const router = useRouter();

  const handleContinue = async () => {
    await SecureStore.setItemAsync('hasSeenOnboarding', 'true');
    router.replace('/');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      <View className="flex-1 px-6 pt-10 pb-6">
        <View className="mb-8">
          <Text variant="title" className="text-center text-3xl font-bold mb-2">
            Welcome to Tutem
          </Text>
          <Text variant="muted" className="text-center text-base">
            Developed for public convenience
          </Text>
          <Text variant="muted" className="text-center text-base">
            No commission charged
          </Text>
        </View>

        <View className="flex-1 gap-y-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <View key={index} className="flex-row items-center gap-x-4">
                <View className="bg-primary/10 p-3 rounded-full">
                  <Icon size={24} color={colors?.primary || '#000'} />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold">{feature.title}</Text>
                  <Text variant="muted" className="text-sm">
                    {feature.description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Button className="w-full mt-auto" onPress={handleContinue}>
          <Text>Get Started</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
