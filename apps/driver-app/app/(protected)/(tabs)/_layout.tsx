import { Octicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useDriver } from '@/hooks/useDriver';
import HomeScreenHeader from '@/components/CustomHeader';
import { colors } from '@/constants/colors';
import { Loader } from '@tutem/ui';

export default function TabsLayout() {
  const { driver: user, isLoading } = useDriver();

  if (isLoading) return <Loader subtitle="loading" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#bfbfbf',
        tabBarShowLabel: true,
        headerShown: true,
        header: () => user && <HomeScreenHeader user={user} />,
        tabBarStyle: {
          backgroundColor: colors.primary,
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
