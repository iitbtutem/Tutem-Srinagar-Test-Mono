
import LoadingScreen from "@/components/LoadingScreen"
import { useAuth } from "@clerk/expo"
import { api } from "@tutem/api"
import { useQuery } from "convex/react"
import { Redirect } from "expo-router"

export default function Protected() {
    const { userId } = useAuth()
    const rider = useQuery(api.routes.rider.getRider, userId ? { clerkId: userId } : 'skip')

    if (rider === undefined) return <LoadingScreen message="fetching rider" />
    if (rider === null) return <Redirect href={'/register'} />
    if (!rider.riderDetails) return <Redirect href={'/registerAsRider'} />

    return <Redirect href={'/(protected)/(tabs)'} />;
}