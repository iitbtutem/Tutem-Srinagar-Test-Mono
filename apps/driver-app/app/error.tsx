import { Button } from '@/components/ui/button';
import { router } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

export default function error() {
  return (
    <View>
      <Text>Error</Text>
      <Button onPress={() => router.back()}>
        <Text>Go back</Text>
      </Button>
    </View>
  );
}
