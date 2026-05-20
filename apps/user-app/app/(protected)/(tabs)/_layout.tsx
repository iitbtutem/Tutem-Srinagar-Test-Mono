import { useAuth } from '@clerk/expo';
import { Feather, Octicons } from '@expo/vector-icons';
import { api } from '@tutem/api';
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
        header: () => <View className='bg-primary h-10' />,
        // header: (props) => user && <CustomHeader {...props} user={user} />,
        tabBarStyle: {
          backgroundColor: "#0A6FCC",
          borderTopColor: isDark ? '#262626' : '#E5E7EB',
          height: 75,
          paddingTop: 6,
          paddingBottom: 6
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
          animation: 'fade',
          tabBarIcon: ({ color }) => (
            <Feather name="map" size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          animation: 'fade',
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
