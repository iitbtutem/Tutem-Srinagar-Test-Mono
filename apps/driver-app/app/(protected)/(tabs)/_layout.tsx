import { Octicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="flex-1">
      <StatusBar style='light' />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: '#bfbfbf',
          tabBarShowLabel: true,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0A6FCC',
            borderTopColor: isDark ? '#262626' : '#E5E7EB',
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
            animation: 'fade',
            tabBarIcon: ({ color, size, focused }) => (
              <Octicons name={focused ? 'home-fill' : 'home'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            animation: 'fade',
            tabBarIcon: ({ color, size }) => <Octicons name="history" size={24} color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
