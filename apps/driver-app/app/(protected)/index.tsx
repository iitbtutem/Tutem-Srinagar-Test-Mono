import LoadingScreen from "@/components/LoadingScreen"
import { useDriver } from "@/hooks/useDriver"
import { Redirect } from "expo-router"

export default function Protected() {
    const { driver: user } = useDriver()

    if (user === undefined) return <LoadingScreen message="fetching driver" />
    if (user === null) return <Redirect href={'/register'} />
    if (!user.driverDetails) return <Redirect href={'/registerAsDriver'} />

    return <Redirect href={'/(protected)/(tabs)'} />;
}