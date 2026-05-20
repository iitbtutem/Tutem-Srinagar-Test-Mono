import { Link, Stack } from 'expo-router';
import { View } from 'react-native';
import { Text, Button } from '@tutem/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className='flex-1 justify-center items-center'>
        <Text className='text-destructive font-bold my-2'>This screen doesn't exist.</Text>

        <Link href="/" asChild>
          <Button>
            <Text>Go to home screen!</Text>
          </Button>
        </Link>
      </View>
    </>
  );
}
