import { MaterialIcons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text, Button } from '@tutem/ui';
import { router } from "expo-router";

export default function ErrorScreen({
  code,
  message,
  actionText,
  onAction,
}: {
  code?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
}) {
    return (
        <View className="flex-1 items-center justify-center px-6">
            <View className="bg-destructive/10 p-8 rounded-3xl items-center w-full">
                <MaterialIcons name="error-outline" size={64} color={"red"} />
                <Text className="text-destructive text-xl font-bold mt-4 text-center">
                    Error Occurred
                </Text>
                {code && <View className="px-4 py-2 my-3 bg-red-50 rounded-2xl border border-destructive">
                    <Text className="text-destructive text-lg font-semibold text-center uppercase">
                        {code}
                    </Text>
                </View>}
                <Text className="text-destructive/80 text-base font-normal text-center">
                    {message}
                </Text>
                {onAction && actionText && (
          <Button variant="outline" className="mt-6 border-destructive" onPress={onAction}>
            <Text className="text-destructive font-semibold">{actionText}</Text>
          </Button>
        )}
        {router.canGoBack() && !onAction && (
          <Button variant="outline" className="mt-6" onPress={() => router.back()}>
            <Text>Go Back</Text>
          </Button>
        )}
            </View>
        </View>
    );
}

export function ErrorMessage({ code, message }: { code?: string, message: string }) {
    return (
        <View className="flex-1 items-center justify-center px-6">
            <View className="bg-destructive/10 p-8 rounded-3xl items-center w-full">
                <MaterialIcons name="error-outline" size={64} color={"red"} />
                <Text className="text-destructive text-xl font-bold mt-4 text-center">
                    Error Occurred
                </Text>
                {code && <View className="px-4 py-2 my-3 bg-red-50 rounded-2xl border border-destructive">
                    <Text className="text-destructive text-lg font-semibold text-center uppercase">
                        {code}
                    </Text>
                </View>}
                <Text className="text-destructive/80 text-base font-normal text-center">
                    {message}
                </Text>
            </View>
        </View>
    )
}