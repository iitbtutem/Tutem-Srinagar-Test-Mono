import LoadingScreen from '@/components/LoadingScreen';
import { useRider } from '@/hooks/useRider';
import { Redirect } from 'expo-router';

export default function Protected() {
  const { rider, isLoading } = useRider();

  console.log('Rider : ', rider);

  if (isLoading) return <LoadingScreen message="fetching rider" />;
  if (rider === null) return <Redirect href={'/register'} />;
  if (!rider?.riderDetails) return <Redirect href={'/registerAsRider'} />;

  return <Redirect href={'/(protected)/(tabs)'} />;
}
