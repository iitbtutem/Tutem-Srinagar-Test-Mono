import { Text } from '@/components/ui/text';
import { useAuth } from '@clerk/expo';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Redirect, router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home() {
  return (
    <View className="bg-background flex-1">
      <SafeAreaView />
      <View className='h-12 bg-muted/40 rounded-xl flex-row gap-2 items-center justify-between px-4 mx-6'>
        <TouchableOpacity
          className='flex-row gap-2 items-center flex-1'
          onPress={() => router.push('/whereto')}
          activeOpacity={0.7}
        >
          <Feather name="search" size={20} color="gray" />
          <Text className='text-muted-foreground font-semibold'>Where to?</Text>
        </TouchableOpacity>
        <View className='h-8 bg-muted rounded-full flex-row gap-2 items-center px-4 hidden'>
          <Feather name="calendar" size={20} color="gray" />
          <Text className='text-muted-foreground font-semibold'>Later</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="mt-4 mx-6">
          <Text className='text-lg font-bold mb-4'>Ride Services</Text>
          <FlatList
            data={[
              { id: 'car', name: 'Car', icon: 'directions-car' },
              { id: 'bike', name: 'Bike', icon: 'directions-bike' },
              { id: 'taxi', name: 'Taxi', icon: 'local-taxi' },
              { id: 'express', name: 'Express', icon: 'bolt' },
              { id: 'luxury', name: 'Luxury', icon: 'star' },
              { id: 'more', name: 'More', icon: 'apps' },
            ] as const}

            keyExtractor={(item) => item.id}
            numColumns={3}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item: service }) => (
              <View className='flex-1 aspect-square bg-muted/30 rounded-2xl items-center justify-center'>
                <View className='w-12 h-12 bg-white rounded-full items-center justify-center shadow-sm mb-2'>
                  <MaterialIcons name={service.icon as any} size={24} color="black" />
                </View>
                <Text className='text-[10px] font-bold text-muted-foreground uppercase tracking-wider'>
                  {service.name}
                </Text>
              </View >
            )
            }
          />
        </View >

        <View className='mt-4'>
          <Text className='text-lg font-bold mb-4 mx-6'>Insights</Text>
          <FlatList
            data={[
              { id: 'Vid1', },
              { id: 'Vid2', },
              { id: 'Vid3', },
            ] as const}
            ListHeaderComponent={<View className='h-6' />}
            ListFooterComponent={<View className='h-6' />}
            horizontal
            keyExtractor={(item) => item.id}
            scrollEnabled={true}
            contentContainerStyle={{ gap: 12 }}
            renderItem={({ item: service }) => (
              <View className='flex-1 bg-muted rounded-xl items-center justify-center w-60 h-36'>
                <View className='items-center justify-center mb-2'>
                  <MaterialIcons name={"videocam"} size={120} color="gray" />
                </View>
              </View>
            )}
          />
        </View>
      </ScrollView >
    </View >
  );
}
