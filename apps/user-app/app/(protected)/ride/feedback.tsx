import ErrorScreen from '@/components/ErrorScreen';
import { Avatar, AvatarFallback, AvatarImage, Text, Button, Separator, Textarea } from '@tutem/ui';
import { api, Id } from '@tutem/api';
import { useAuthenticatedQuery, useAuthenticatedMutation } from '@/hooks/customApi';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Star } from 'lucide-react-native';
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

  const ride = useAuthenticatedQuery(
    api.routes.rides.getRiderCurrentRideById,
    rideId ? { id: rideId } : 'skip'
  );

  const submitFeedback = useAuthenticatedMutation(api.routes.rides.submitRating);

  const [score, setScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (ride === undefined)
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="small" color="#a78bfa" />
      </View>
    );
  if (ride === null) return <ErrorScreen message="Ride not found" code="404" />;

  const driver = ride.driver;
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
        raterType: 'Rider',
        raterId: ride.riderId,
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
      contentContainerClassName="px-6 pt-14 pb-12"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View className="mb-10">
        <Text className="mb-1 text-sm font-medium uppercase tracking-widest text-primary/90">
          Rate your ride
        </Text>
        <Text className="text-3xl font-bold leading-tight text-primary/50">
          How was your{'\n'}experience?
        </Text>
      </View>

      {/* Driver Card */}
      <View className="mb-8 flex-row items-center gap-4 rounded-2xl border border-zinc-800 bg-background p-5">
        <Avatar alt={driver.userDetails.firstName?.[0] ?? 'Driver'} className="h-16 w-16">
          <AvatarImage
            source={
              driver.userDetails.profilePictureKey?.trim()
                ? { uri: driver.userDetails.profilePictureKey }
                : require('@/assets/images/avatar.jpg')
            }
          />
          <AvatarFallback>
            <Text className="text-xl font-semibold text-white">
              {driver.userDetails.firstName?.[0] ?? 'D'}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-primary">
            {`${driver.userDetails.firstName} ${driver.userDetails?.lastName}`}
          </Text>
          <Text className="mt-0.5 text-sm text-zinc-400">{ride.vehicle?.model ?? 'Vehicle'}</Text>
          <View className="mt-1.5 flex-row items-center gap-1">
            <Star size={13} color="#fbbf24" fill="#fbbf24" />
            <Text className="text-xs font-medium text-amber-400">
              {driver.rating.average?.toFixed(1) ?? '—'}
            </Text>
            <Text className="text-xs text-zinc-500">{driver.rating.totalRatings ?? 0} trips</Text>
          </View>
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
                color={star <= activeStar ? '#fbbf24' : '#3f3f46'}
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

      {/* Quick tags */}
      {/* <View className="mb-7">
        <Text className="text-zinc-400 text-xs font-medium tracking-widest uppercase mb-4">
          What stood out?
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {QUICK_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                className={`px-4 py-2 rounded-full border ${
                  active
                    ? 'bg-violet-600 border-violet-500'
                    : 'bg-zinc-900 border-zinc-700'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    active ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  {active ? '✓ ' : ''}{tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View> */}

      {/* Comment */}
      <View className="mb-8 mt-4">
        <Text className="mb-3 text-xs font-medium uppercase tracking-widest text-primary/50">
          Leave a comment{' '}
          <Text className="normal-case tracking-normal text-primary/80">(optional)</Text>
        </Text>
        <Textarea
          placeholder="Tell us more about your experience with this driver…"
          value={comment}
          onChangeText={setComment}
          numberOfLines={4}
          maxLength={500}
          className="rounded-xl border-zinc-700 text-sm leading-relaxed placeholder:text-primary/50"
          textAlignVertical="top"
        />
        <Text className="mt-1.5 text-right text-xs text-zinc-600">{comment.length}/500</Text>
      </View>

      {/* Submit */}
      <Button
        onPress={handleSubmit}
        disabled={isSubmitting || score === 0}
        className={`rounded-2xl ${
          score === 0 ? 'bg-zinc-800' : 'bg-violet-600 active:bg-violet-700'
        }`}>
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text
            className={`text-center text-base font-semibold ${
              score === 0 ? 'text-zinc-500' : 'text-white'
            }`}>
            Submit Feedback
          </Text>
        )}
      </Button>

      {/* Skip */}
      <Pressable onPress={() => router.replace('/')} className="mt-4 py-3">
        <Text className="text-center text-sm text-zinc-500">Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}
