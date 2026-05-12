import LoadingScreen from "@/components/LoadingScreen"
import { useAuth } from "@clerk/expo"
import { api } from "@tutem/api"
import { useQuery } from "convex/react"
import { Redirect } from "expo-router"

export default function Protected() {
    const { userId } = useAuth()
    const user = useQuery(api.routes.driver.getUser, userId ? { clerkId: userId } : 'skip')

    if (user === undefined) return <LoadingScreen message="fetching driver" />
    if (user === null) return <Redirect href={'/register'} />
    if (!user.driverDetails) return <Redirect href={'/registerAsDriver'} />

    return <Redirect href={'/(protected)/(tabs)'} />;
}