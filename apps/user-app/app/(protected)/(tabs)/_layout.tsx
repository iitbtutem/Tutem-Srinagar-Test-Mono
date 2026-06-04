import { BasicHeader } from '@/components/CustomHeader';
import { colors } from '@/constants/colors';
import { useAuth } from '@clerk/expo';
import { Feather, Octicons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { Text } from '@tutem/ui';
import { useQuery } from 'convex/react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { View } from 'react-native';

export default function TabsLayout() {
  const { userId } = useAuth();

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const user = useQuery(api.routes.rider.getRider, userId && userId !== '' ? { clerkId: userId } : 'skip');


  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#bfbfbf',
        headerShown: false,
        // header: (props) => user && <CustomHeader {...props} user={user} />,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingTop: 5,
          paddingBottom: 5
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          animation: "shift",
          tabBarIcon: ({ color, focused }) => (
            <Octicons name={focused ? 'home-fill' : 'home'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          animation: "shift",
          headerShown: true,
          header: () => (
            <View className="bg-primary flex-row items-center justify-between gap-3 px-4 pb-3">
              <Text className="flex-1 font-semibold text-center text-base text-white">
                Previous Rides
              </Text>
            </View>
          ),
          tabBarIcon: ({ color }) => (
            <Octicons name="history" size={24} color={color} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          animation: 'fade',
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={23} color={color} />
          ),
        }}
      /> */}
    </Tabs>
  );
}
