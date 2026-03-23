import { useAuth } from "@clerk/expo";
import { useConvexAuth } from "convex/react";
import { Redirect, Stack } from "expo-router";

export default function ProtectedLayout() {
    const { isAuthenticated } = useConvexAuth()
    const { isSignedIn } = useAuth()

    if (!isAuthenticated || !isSignedIn) return <Redirect href={'/(auth)/signin'} />
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={isAuthenticated && !!isSignedIn}>
                <Stack.Screen name="(tabs)/index" />
                <Stack.Screen name="vehicleRegistration" />
            </Stack.Protected>
        </Stack>
    )
}