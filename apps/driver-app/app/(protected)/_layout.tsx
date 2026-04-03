import { useAuth, useUser } from '@clerk/expo';
import { api } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Redirect, router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

export default function ProtectedLayout() {
  const { userId } = useAuth();
  const segments = useSegments()
  const user = useQuery(api.routes.driver.getDriver, userId && userId !== '' ? { clerkId: userId } : 'skip');
  const protectedGuard = !!userId && !!user;
  console.log("i am rayees baya", user);

  useEffect(() => {
     if (user === null && userId) {
       if (router.canDismiss()) {
         router.dismissAll();
       }
       router.replace('/register');
     }
     if (protectedGuard && user.driver === null) {
      console.log("mai nhi chalraha hu", protectedGuard, user.driver);
        if (router.canDismiss()) {
          router.dismissAll();
        }
      router.replace('/registerAsDriver');
      console.log("mai hu segments", segments);
     }
   }, [user, userId, router, ]);

  // if (user === undefined) return <ActivityIndicator />;

  // if (user === null && userId) {
  //   console.log("user is", user, userId);
  //   console.log("i am redirecting to register");
  //   return <Redirect href={'/register'} />;
  // }

  // if (protectedGuard && user.driver === null) {
  //   return <Redirect href={'/registerAsDriver'} />;
  // }


  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={protectedGuard && user.driver !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="editProfile"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="createVehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="editVehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="register" />
      <Stack.Protected guard={protectedGuard && user.driver === null}>
        <Stack.Screen name="registerAsDriver" />
      </Stack.Protected>
    </Stack>
  );
}
