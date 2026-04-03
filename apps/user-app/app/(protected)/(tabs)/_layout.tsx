import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator } from 'react-native';

export default function TabsLayout() {

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'blue',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
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
