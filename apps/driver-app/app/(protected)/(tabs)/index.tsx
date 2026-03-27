import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Home() {
  const { userId } = useAuth();
  const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? '' });

  if (user === undefined) return <ActivityIndicator />;

  if (user === null && userId) return <Redirect href="/register" />;

  return (
    <View className="flex-1 items-center justify-center bg-background p-10">
      <View className='bg-muted-foreground/20 rounded-2xl p-20'>
        <Text>Navigation will be displayed in this screen.</Text>
      </View>
    </View>
  );
}
