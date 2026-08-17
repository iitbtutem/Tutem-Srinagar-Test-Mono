import { colors } from '@/constants/colors';
import { Octicons } from '@expo/vector-icons';
import { Text } from '@tutem/ui';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#bfbfbf',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.primary,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingTop: 5,
          paddingBottom: 5,
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
          animation: 'shift',
          tabBarIcon: ({ color, focused }) => (
            <Octicons name={focused ? 'home-fill' : 'home'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          animation: 'shift',
          headerShown: true,
          header: () => (
            <View className="flex-row items-center justify-between gap-3 bg-primary px-4 pb-3">
              <Text className="flex-1 text-center text-base font-semibold text-white">
                Previous Rides
              </Text>
            </View>
          ),
          tabBarIcon: ({ color }) => <Octicons name="history" size={24} color={color} />,
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
