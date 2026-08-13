import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Pressable,
} from 'react-native';
import { X, User } from 'lucide-react-native';

export interface ImageViewerModalProps {
  visible: boolean;
  onClose: () => void;
  imageUri?: string | null;
  name?: string;
  subtitle?: string;
}

export function ImageViewerModal({
  visible,
  onClose,
  imageUri,
  name,
  subtitle,
}: ImageViewerModalProps) {
  const [imageError, setImageError] = useState(false);

  const hasValidUri = Boolean(imageUri && imageUri.trim().length > 0 && !imageError);

  const getInitials = (fullName?: string) => {
    if (!fullName) return '?';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || '?';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View className="flex-1 bg-black/95 justify-between">
        <StatusBar barStyle="light-content" backgroundColor="black" />
        
        {/* Header */}
        <SafeAreaView className="z-10 w-full">
          <View className="flex-row items-center justify-between px-5 py-4">
            <View className="flex-1 pr-4">
              {name ? (
                <Text className="text-lg font-bold text-white" numberOfLines={1}>
                  {name}
                </Text>
              ) : (
                <Text className="text-lg font-bold text-white">Profile Photo</Text>
              )}
              {subtitle ? (
                <Text className="text-xs text-slate-400" numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <X size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Image / Fallback Container */}
        <Pressable className="flex-1 items-center justify-center px-1" onPress={onClose}>
          <Pressable onPress={() => {}} className="w-full items-center justify-center">
            {hasValidUri ? (
              <Image
                source={{ uri: imageUri! }}
                className="w-full rounded-3xl"
                style={{ width: '98%', aspectRatio: 1, maxHeight: 520 }}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View className="h-80 w-80 items-center justify-center rounded-full border-4 border-slate-700 bg-slate-800 shadow-2xl">
                <Text className="text-7xl font-extrabold text-slate-200">
                  {getInitials(name)}
                </Text>
                <View className="mt-4 flex-row items-center gap-1.5 rounded-full bg-slate-900/80 px-4 py-1.5">
                  <User size={16} color="#94A3B8" />
                  <Text className="text-xs font-semibold text-slate-400">No Profile Photo</Text>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>

        {/* Footer padding */}
        <SafeAreaView />
      </View>
    </Modal>
  );
}
