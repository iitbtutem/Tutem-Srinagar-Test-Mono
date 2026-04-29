import CustomHeader from '@/components/CustomHeader';
import { useAuth } from '@clerk/expo';
import { Feather, Octicons } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';

export default function TabsLayout() {
  const { userId } = useAuth();

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const user = useQuery(api.routes.rider.getRider, userId && userId !== '' ? { clerkId: userId } : 'skip');


  return (
  <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#000000',
        tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
        headerShown: true,
        header: (props) => user && <CustomHeader {...props} user={user} />,
        tabBarStyle: {
          backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
          borderTopColor: isDark ? '#262626' : '#E5E7EB',
          height: 80,
          paddingTop: 6,
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
          tabBarIcon: ({ focused }) => (
            <Feather name="map" size={23} color={focused ? 'blue' : 'gray'} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          animation: 'fade',
          tabBarIcon: ({ color, size }) => (
            <Octicons name="history" size={24} color={color} />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          animation: 'fade',
          tabBarIcon: ({ focused }) => (
            <Feather name="user" size={23} color={focused ? 'blue' : 'gray'} />
          ),
        }}
      /> */}
    </Tabs>
  );
}
