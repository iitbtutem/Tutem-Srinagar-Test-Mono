import ErrorScreen from '@/components/ErrorScreen';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Text,
  Button,
  Separator,
  Textarea,
  Loader,
} from '@tutem/ui';
import { api, Id } from '@tutem/api';
import { useMutation, useQuery } from 'convex/react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { BasicHeader } from '@/components/CustomHeader';
import { colors } from '@/constants/colors';
import { useToast } from '@/components/CustomToast';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
};

export default function Feedback() {
  const { rideId } = useLocalSearchParams<{ rideId: Id<'ride'> }>();
  const router = useRouter();
  const toast = useToast();

  const ride = useQuery(api.routes.rides.getRiderCurrentRideById, rideId ? { id: rideId } : 'skip');

  const submitFeedback = useMutation(api.routes.rides.submitRating);

  const [score, setScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (ride === undefined)
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Loader subtitle="Loading..." />
      </View>
    );
  if (ride === null) return <ErrorScreen message="Ride not found" code="404" />;

  const rider = ride.rider;
  const activeStar = hoveredStar || score;

  const handleSubmit = async () => {
    if (score === 0) {
      toast.showToast({
        type: 'error',
        title: 'Error',
        description: 'Please select a star rating before submitting.',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      await submitFeedback({
        rideId,
        raterType: 'Driver',
        score,
        comment: comment.trim() || undefined,
      });
      toast.showToast({
        type: 'success',
        title: 'Success',
        description: 'Feedback submitted successfully',
      });
      router.replace('/');
    } catch (error: any) {
      toast.showToast({
        type: 'error',
        title: 'Failed',
        description: error?.data ?? 'Failed to submit',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-6 pt-6 pb-24"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Feedback',
          header: (props) => <BasicHeader {...props} />,
        }}
      />

      {isSubmitting && <Loader subtitle="submitting..." />}
      {/* Header */}
      <View className="mb-10">
        <Text className="text-title/90 mb-1 text-sm font-medium uppercase tracking-widest">
          Rate your ride
        </Text>
        <Text className="text-title/50 text-3xl font-bold leading-tight">
          How was your{'\n'}experience?
        </Text>
      </View>

      {/* Rider Card */}
      <View className="mb-8 flex-row items-center gap-4 rounded-2xl border border-primary bg-background p-5">
        <Avatar alt={rider.userDetails.firstName?.[0] ?? 'Driver'} className="h-16 w-16">
          <AvatarImage
            source={
              rider.userDetails.profilePictureKey?.trim()
                ? { uri: rider.userDetails.profilePictureKey }
                : require('@/assets/images/avatar.jpg')
            }
          />
          <AvatarFallback>
            <Text className="text-xl font-semibold text-black">
              {rider.userDetails.firstName?.[0] ?? 'R'}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="text-title text-lg font-semibold">
            {`${rider.userDetails.firstName} ${rider.userDetails?.lastName ?? ''}`}
          </Text>
          <Text className="mt-0.5 text-sm text-zinc-400">{ride.vehicle?.model ?? 'Vehicle'}</Text>
        </View>
      </View>

      {/* Star Rating */}
      <View className="mb-2 items-center">
        <View className="mb-3 flex-row gap-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setScore(star)}
              onPressIn={() => setHoveredStar(star)}
              onPressOut={() => setHoveredStar(0)}
              hitSlop={8}
              className="active:scale-110">
              <Star
                size={44}
                color={star <= activeStar ? '#fbbf24' : colors.primary}
                fill={star <= activeStar ? '#fbbf24' : 'transparent'}
                strokeWidth={1.5}
              />
            </Pressable>
          ))}
        </View>

        {/* Rating label */}
        <View className="h-6 items-center justify-center">
          {activeStar > 0 && (
            <Text className="text-base font-semibold tracking-wide text-amber-400">
              {RATING_LABELS[activeStar]}
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <Separator />

      {/* Comment */}
      <View className="mb-6 mt-4">
        <Text className="text-title/50 mb-3 text-xs font-medium uppercase tracking-widest">
          Leave a comment{' '}
          <Text className="text-title/80 normal-case tracking-normal">(optional)</Text>
        </Text>
        <Textarea
          placeholder="Tell us more about your experience with this rider…"
          value={comment}
          onChangeText={setComment}
          numberOfLines={4}
          maxLength={500}
          className="placeholder:text-title/50 rounded-xl text-sm leading-relaxed"
          textAlignVertical="top"
        />
        <Text className="mt-1.5 text-right text-xs text-zinc-600">{comment.length}/500</Text>
      </View>

      {/* Submit */}
      <Button onPress={handleSubmit} disabled={isSubmitting || score === 0}>
        <Text
          className={`text-center text-base font-semibold ${
            score === 0 ? 'text-zinc-500' : 'text-white'
          }`}>
          Submit Feedback
        </Text>
      </Button>

      {/* Skip */}
      <Pressable onPress={() => router.replace('/')} className="mt-4 py-3">
        <Text className="text-center text-sm text-zinc-500">Skip</Text>
      </Pressable>
    </ScrollView>
  );
}
