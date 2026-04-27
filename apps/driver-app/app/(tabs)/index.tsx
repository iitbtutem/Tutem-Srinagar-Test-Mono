import { useQuery } from "convex/react";
import { api } from "@tutem/api"
import { View } from "react-native";
import { Button } from "../../components/ui/button";
import { Text } from "../../components/ui/text";

export default function IndexPage() {
  const tasks = useQuery(api.tasks.get) ?? []

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {tasks.length === 0 ? (
        <View style={{ padding: 20, backgroundColor: "#eee", borderRadius: 10 }}>
          <Text className="text-black">
            No tasks found.
          </Text>
        </View>
      ) : (
        tasks.map((task) => (
          <View key={task._id} style={{ padding: 20, backgroundColor: "#eee", borderRadius: 10, marginBottom: 10 }}>
            <Text className="text-black">
              {task.text}
            </Text>
          </View>
        ))
      )}
      <Button > <Text> press me </Text> </Button>
    </View>
  );
}
