import LoadingScreen from '@/components/LoadingScreen';
import { useDriver } from '@/hooks/useDriver';
import { Redirect } from 'expo-router';

export default function Protected() {
  const { driver: user, isLoading } = useDriver();

  if (isLoading) return <LoadingScreen message="fetching driver" />;
  if (!user) return <Redirect href={'/register'} />;
  if (!user.driverDetails) return <Redirect href={'/registerAsDriver'} />;

  return <Redirect href={'/(protected)/(tabs)'} />;
}
