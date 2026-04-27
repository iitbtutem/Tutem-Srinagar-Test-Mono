import ErrorScreen from '@/components/ErrorScreen';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { api, Id } from '@tutem/api';
import { useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { Star } from 'lucide-react-native';
import { Separator } from '@/components/ui/seperator';
import { Textarea } from '@/components/ui/textarea';

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Great',
  5: 'Excellent!',
};

const QUICK_TAGS = [
  'Safe driver',
  'Friendly',
  'On time',
  'Professional',
  'Clean car',
  'Great music',
];

export default function Feedback() {
  const { id } = useLocalSearchParams<{ id: Id<'ride'> }>();
  const router = useRouter();

  const ride = useQuery(
    api.routes.rides.getRiderCurrentRideById,
    id ? { id } : 'skip'
  );

  const submitFeedback = useMutation(api.routes.rides.submitRating);

  const [score, setScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (ride === undefined)
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="small" color="#a78bfa" />
      </View>
    );
  if (ride === null)
    return <ErrorScreen message="Ride not found" code="404" />;

  const driver = ride.driver;
  const activeStar = hoveredStar || score;

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (score === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.');
      return;
    }
    try {
      setIsSubmitting(true);
      await submitFeedback({
        rideId: id,
        raterType: "Rider",
        score,
        comment: comment.trim() || undefined,
      });
      router.replace('/');
    } catch (e) {
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-6 pt-14 pb-12"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View className="mb-10">
        <Text className="text-primary/90 text-sm font-medium tracking-widest uppercase mb-1">
          Rate your ride
        </Text>
        <Text className="text-primary/50 text-3xl font-bold leading-tight">
          How was your{'\n'}experience?
        </Text>
      </View>

      {/* Driver Card */}
      <View className="bg-background border border-zinc-800 rounded-2xl p-5 mb-8 flex-row items-center gap-4">
        <Avatar alt={driver.userDetails.firstName?.[0] ?? 'Driver'} className="w-16 h-16">
          <AvatarImage source={{ uri: driver.userDetails.profilePictureKey }} />
          <AvatarFallback>
            <Text className="text-white text-xl font-semibold">
              {driver.userDetails.firstName?.[0] ?? 'D'}
            </Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1">
          <Text className="text-primary text-lg font-semibold">
            {`${driver.userDetails.firstName} ${driver.userDetails?.lastName}`}
          </Text>
          <Text className="text-zinc-400 text-sm mt-0.5">
            {ride.vehicle?.model ?? 'Vehicle'}
          </Text>
          <View className="flex-row items-center mt-1.5 gap-1">
            <Star size={13} color="#fbbf24" fill="#fbbf24" />
            <Text className="text-amber-400 text-xs font-medium">
              {driver.averageRating?.toFixed(1) ?? '—'}
            </Text>
            <Text className="text-zinc-500 text-xs">
              {driver.totalRating ?? 0} trips
            </Text>
          </View>
        </View>
      </View>

      {/* Star Rating */}
      <View className="items-center mb-2">
        <View className="flex-row gap-3 mb-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setScore(star)}
              onPressIn={() => setHoveredStar(star)}
              onPressOut={() => setHoveredStar(0)}
              hitSlop={8}
              className="active:scale-110"
            >
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
            <Text className="text-amber-400 text-base font-semibold tracking-wide">
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
        <Text className="text-primary/50 text-xs font-medium tracking-widest uppercase mb-3">
          Leave a comment{' '}
          <Text className="text-primary/80 normal-case tracking-normal">
            (optional)
          </Text>
        </Text>
        <Textarea
          placeholder="Tell us more about your experience with this driver..."
          value={comment}
          onChangeText={setComment}
          numberOfLines={4}
          maxLength={500}
          className="border-zinc-700 placeholder:text-primary/50 rounded-xl text-sm leading-relaxed"
          textAlignVertical="top"
        />
        <Text className="text-zinc-600 text-xs text-right mt-1.5">
          {comment.length}/500
        </Text>
      </View>

      {/* Submit */}
      <Button
        onPress={handleSubmit}
        disabled={isSubmitting || score === 0}
        className={`rounded-2xl ${
          score === 0
            ? 'bg-zinc-800'
            : 'bg-violet-600 active:bg-violet-700'
        }`}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text
            className={`text-center text-base font-semibold ${
              score === 0 ? 'text-zinc-500' : 'text-white'
            }`}
          >
            Submit Feedback
          </Text>
        )}
      </Button>

      {/* Skip */}
      <Pressable onPress={() => router.replace('/')} className="mt-4 py-3">
        <Text className="text-zinc-500 text-sm text-center">
          Skip for now
        </Text>
      </Pressable>
    </ScrollView>
  );
}