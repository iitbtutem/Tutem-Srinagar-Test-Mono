import ErrorScreen from '@/components/ErrorScreen';
import { Card, CardContent, CardHeader, CardTitle, Text, Button, Separator } from '@tutem/ui';
import { api, Id } from '@tutem/api';
import { useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  View,
} from 'react-native';
import { QrCode, IndianRupee, CheckCircle2 } from 'lucide-react-native';
import { distanceFormat, formatFare, getTimeBetweenFormatted } from '@/lib/utils';
import { useRouter } from 'expo-router';

export default function Payment() {
  const { rideId } = useLocalSearchParams<{ rideId: Id<'ride'> }>();
  const router = useRouter();

  const ride = useQuery(api.routes.rides.getRide, { id: rideId });

  if (ride === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#f59e0b" />
        <Text className="mt-3 text-zinc-400 text-sm font-medium">Loading payment details…</Text>
      </View>
    );
  }

  if (ride === null) return <ErrorScreen message="Ride Not Found" code="404" />;

  return (
    <ScrollView
      className="flex-1 bg-white/50"
      contentContainerClassName="px-4 pb-12"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="my-4">
        <Text className="text-2xl font-bold text-primary tracking-tight">Payment</Text>
        <Text className="text-zinc-500 text-sm">Collect fare from your passenger</Text>
      </View>

      {/* Fare Card */}
      <Card className="border  rounded-2xl mb-5">
        <CardContent className="p-5">
          <View className="flex-row items-center gap-2 mb-1">
            <IndianRupee size={16} color="#78350f" strokeWidth={2.5} />
            <Text className="text-amber-900 text-xs font-semibold uppercase tracking-widest">
              Total Fare
            </Text>
          </View>
          <Text className="text-5xl font-black text-emerald-600 tracking-tight">
            {formatFare(Number(ride.fare))}
          </Text>
          <Separator className="my-3 bg-amber-400/60" />
          <View className="flex-row justify-between">
            <View>
              <Text className="text-amber-800 text-xs font-medium">Distance</Text>
              <Text className="text-amber-950 font-semibold text-sm">
                {distanceFormat(Number(ride.distance))}
              </Text>
            </View>
            <View>
              <Text className="text-amber-800 text-xs font-medium">Duration</Text>
              <Text className="text-amber-950 font-semibold text-sm">
                {
                  (ride.startedAt && ride.completedAt && ride.status === "Completed") 
                  ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.completedAt)) 
                  : (ride.startedAt && ride.status === "Abort")
                  ? getTimeBetweenFormatted(new Date(ride.startedAt), new Date(ride.updatedAt))
                  : "-"
                }
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-amber-800 text-xs font-medium">Status</Text>
              <View className="flex-row items-center gap-1">
                <CheckCircle2 size={12} color="#451a03" strokeWidth={2.5} />
                <Text className="text-amber-950 font-semibold text-sm">{ride.status}</Text>
              </View>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* QR Code Card */}
      { ride.driver.paymentQrCodeKey && (
        <Card className="overflow-hidden rounded-2xl border border-primary">
          <CardHeader className="px-5 pb-3 pt-5">
            <View className="flex-row items-center gap-2">
              <QrCode size={18} color="#f59e0b" strokeWidth={2} />
              <CardTitle>
                <Text className="text-base font-semibold text-primary">Payment QR Code</Text>
              </CardTitle>
            </View>
            <Text className="mt-0.5 text-xs text-zinc-500"> Show this to your passenger for UPI payment </Text>
          </CardHeader>

          <Separator className="mx-4 w-fit bg-zinc-800" />

          <CardContent className="px-5 pt-4 pb-2">
            {/* QR Code Display - always mounted, hidden when no QR */}
            <View className="items-center">
              <View className="mb-4 rounded-2xl bg-white p-3 shadow-lg shadow-black/30">
                <Image
                  source={{ uri: ride.driver.paymentQrCodeKey }}
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

      { !ride.driver.paymentQrCodeKey && ( 
        <Text className="text-zinc-600 text-xs text-center mt-5 leading-5 mb-4">
          Cash payments are always accepted.{'\n'}QR code enables contactless UPI collection. Add QR code in your profile to offer digital payment option to passengers.
        </Text> 
      )}

      <Button
        className='mt-4 '
        onPress={() => {
          router.push({
            pathname: "/ride/feedback",
            params: {
              rideId
            }
          })
        }}>
        <Text>Payment Received</Text>
      </Button>
      <Text className="text-zinc-600 text-xs text-center mt-1 leading-5 mb-4">
        Tap "Payment Received" after collecting fare to proceed to ride feedback and complete the ride process.
      </Text>
    </ScrollView>
  );
}