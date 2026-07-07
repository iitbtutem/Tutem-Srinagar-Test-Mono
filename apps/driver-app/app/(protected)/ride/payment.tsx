import ErrorScreen from '@/components/ErrorScreen';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Text,
  Button,
  Separator,
  Loader,
} from '@tutem/ui';
import { api, Id } from '@tutem/api';
import { useQuery } from 'convex/react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, View } from 'react-native';
import { QrCode, IndianRupee, CheckCircle2 } from 'lucide-react-native';
import { distanceFormat, formatFare, getTimeBetweenFormatted } from '@/lib/utils';
import { useRouter } from 'expo-router';
import { BasicHeader } from '@/components/CustomHeader';
import { useAuth } from '@/hooks/useAuth';

export default function Payment() {
  const { rideId } = useLocalSearchParams<{ rideId: Id<'ride'> }>();
  const router = useRouter();
  const { sessionToken } = useAuth();

  const ride = useQuery(
    api.routes.rides.getDriverRide,
    rideId && sessionToken ? { id: rideId, sessionToken } : 'skip'
  );

  if (ride === undefined) {
    return <Loader subtitle="Loading ride details..." />;
  }

  if (ride === null) return <ErrorScreen message="Ride Not Found" code="404" />;

  return (
    <ScrollView
      className="flex-1 bg-white/50"
      contentContainerClassName="px-4 pb-12"
      showsVerticalScrollIndicator={false}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Payment',
          header: (props) => <BasicHeader {...props} />,
        }}
      />
      {/* Header */}
      <View className="my-4">
        <Text className="text-2xl font-bold tracking-tight text-primary">Payment</Text>
        <Text className="text-sm text-zinc-500">Collect fare from your passenger</Text>
      </View>

      {/* Fare Card */}
      <Card className="mb-5 rounded-2xl border">
        <CardContent className="p-5">
          <View className="mb-1 flex-row items-center gap-2">
            <IndianRupee size={16} color="#78350f" strokeWidth={2.5} />
            <Text className="text-xs font-semibold uppercase tracking-widest text-amber-900">
              Total Fare
            </Text>
          </View>
          <Text className="text-5xl font-black tracking-tight text-emerald-600">
            {formatFare(Number(ride.fare))}
          </Text>
          <Separator className="my-3 bg-amber-400/60" />
          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs font-medium text-amber-800">Distance</Text>
              <Text className="text-sm font-semibold text-amber-950">
                {distanceFormat(Number(ride.distance))}
              </Text>
            </View>
            <View>
              <Text className="text-xs font-medium text-amber-800">Duration</Text>
              <Text className="text-sm font-semibold text-amber-950">
                {ride.startedAt && ride.completedAt && ride.status === 'Completed'
                  ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.completedAt))
                  : ride.startedAt && ride.status === 'Abort'
                    ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.updatedAt))
                    : '-'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs font-medium text-amber-800">Status</Text>
              <View className="flex-row items-center gap-1">
                <CheckCircle2 size={12} color="#451a03" strokeWidth={2.5} />
                <Text className="text-sm font-semibold text-amber-950">{ride.status}</Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      {ride.driverPaymentQrCodeKey && (
        <Card className="overflow-hidden rounded-2xl border border-primary">
          <CardHeader className="px-5 pb-3 pt-5">
            <View className="flex-row items-center gap-2">
              <QrCode size={18} color="#f59e0b" strokeWidth={2} />
              <CardTitle>
                <Text className="text-base font-semibold text-primary">Payment QR Code</Text>
              </CardTitle>
            </View>
            <Text className="mt-0.5 text-xs text-zinc-500">
              {' '}
              Show this to your passenger for UPI payment{' '}
            </Text>
          </CardHeader>

          <Separator className="mx-4 w-fit bg-zinc-800" />

          <CardContent className="px-5 pb-2 pt-4">
            {/* QR Code Display - always mounted, hidden when no QR */}
            <View className="items-center">
              <View className="mb-4 rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
                <Image
                  source={{ uri: ride.driverPaymentQrCodeKey }}
                  className="h-72 w-72 rounded-xl"
                  resizeMode="contain"
                />
              </View>
              <Text className="mb-4 text-center text-xs text-zinc-400">
                Scan with any UPI app · PhonePe · GPay · Paytm
              </Text>
            </View>
          </CardContent>
        </Card>
      )}

      {!ride.driverPaymentQrCodeKey && (
        <Text className="mb-4 mt-5 text-center text-xs leading-5 text-zinc-600">
          Cash payments are always accepted.{'\n'}QR code enables contactless UPI collection. Add QR
          code in your profile to offer digital payment option to passengers.
        </Text>
      )}

      <Button
        className="mt-4"
        onPress={() => {
          router.push({
            pathname: '/ride/feedback',
            params: {
              rideId,
            },
          });
        }}>
        <Text>Payment Received</Text>
      </Button>
      <Text className="mb-4 mt-1 text-center text-xs leading-5 text-zinc-600">
        Tap "Payment Received" after collecting fare to proceed to ride feedback and complete the
        ride process.
      </Text>
    </ScrollView>
  );
}
