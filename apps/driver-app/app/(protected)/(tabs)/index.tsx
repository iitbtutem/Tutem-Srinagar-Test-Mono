import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@clerk/expo";
import { api } from "@tutem/api";
import { useQuery } from "convex/react";
import { Redirect, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

export default function Home() {
    const { signOut, userId } = useAuth()
    const user = useQuery(api.routes.user.getUser, { clerkId: userId ?? "" })
    const router = useRouter()

    if (user === undefined) return <ActivityIndicator />

    if (user === null && userId) return <Redirect href="/register" />

    return (
        <View>
            <Button onPress={
                async () => {
                    await signOut()
                    router.replace('/')
                }
            } >
                <Text>Logout</Text>
            </Button >
            <Text>Hello i am in home</Text>
        </View>
    )
}