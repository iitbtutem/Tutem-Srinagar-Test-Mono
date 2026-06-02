import { Octicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { useQuery } from 'convex/react';
import HomeScreenHeader from '@/components/CustomHeader';
import { api } from '@tutem/api';

export default function TabsLayout() {
  const { userId } = useAuth();
  const user = useQuery(api.routes.driver.getUser, userId && userId !== '' ? { clerkId: userId } : 'skip');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#bfbfbf',
        tabBarShowLabel: true,
        headerShown: true,
        header: () => user && <HomeScreenHeader user={user} />,
        tabBarStyle: {
          backgroundColor: '#40a4f5',
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
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
          tabBarIcon: ({ color, size, focused }) => (
            <Octicons name={focused ? 'home-fill' : 'home'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => <Octicons name="history" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
