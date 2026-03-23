import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import { View } from "react-native";

export default function Home() {
    const { signOut } = useAuth()
    const router = useRouter()
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