import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabsLayout() {
  return (
    // make profile tab (needs user icon) and home tab (needs map icon)
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'blue',
        headerShown: false
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
        name="profile"
        options={{
          title: 'Profile',
          animation: 'fade',
          tabBarIcon: ({ focused }) => (
            <Feather name="user" size={23} color={focused ? 'blue' : 'gray'} />
          ),
        }}
      />
    </Tabs>
  );
}
