import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Text } from './ui/text';
import { Button } from './ui/button';
import { router } from 'expo-router';

export default function ErrorScreen({ code, message }: { code?: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full items-center rounded-3xl bg-destructive/10 p-8">
        <MaterialIcons name="error-outline" size={64} color={'red'} />
        <Text className="mt-4 text-center text-xl font-bold text-destructive">Error Occurred</Text>
        {code && (
          <View className="my-3 rounded-2xl border border-destructive bg-red-50 px-4 py-2">
            <Text className="text-center text-lg font-semibold uppercase text-destructive">
              {code}
            </Text>
          </View>
        )}
        <Text className="text-center text-base font-normal text-destructive/80">{message}</Text>
        {router.canGoBack() && (
          <Button variant="outline" className="mt-6" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        )}
      </View>
    </View>
  );
}

export function ErrorMessage({ code, message }: { code?: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="w-full items-center rounded-3xl bg-destructive/10 p-8">
        <MaterialIcons name="error-outline" size={64} color={'red'} />
        <Text className="mt-4 text-center text-xl font-bold text-destructive">Error Occurred</Text>
        {code && (
          <View className="my-3 rounded-2xl border border-destructive bg-red-50 px-4 py-2">
            <Text className="text-center text-lg font-semibold uppercase text-destructive">
              {code}
            </Text>
          </View>
        )}
        <Text className="text-center text-base font-normal text-destructive/80">{message}</Text>
      </View>
    </View>
  );
}
