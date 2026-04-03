import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-10">
      <View className="rounded-2xl bg-muted-foreground/20 p-20">
        <Text>Navigation will be displayed in this screen.</Text>
      </View>
    </View>
  );
}
