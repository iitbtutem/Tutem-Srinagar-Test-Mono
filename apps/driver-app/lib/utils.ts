import { METERS_IN_KM } from '@/constants';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { differenceInYears } from 'date-fns';
import { ConvexError } from 'convex/values';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFare(amount?: number) {
  if (amount === undefined) return '—';
  return `₹${amount.toFixed(0)}`;
}

export function numberFormat(number: number) {
  return new Intl.NumberFormat('en-In', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
}

export function distanceFormat(distance: number) {
  if (distance < 0) return '0';
  return (
    new Intl.NumberFormat('en-In', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(distance / METERS_IN_KM) + ' km'
  );
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * METERS_IN_KM; //return differnce between two locations in meters
}

export function isNearby(
  location1: { latitude: number; longitude: number },
  location2: { latitude: number; longitude: number },
  differenceInMts: number
) {
  const differnce = haversineDistance(
    location1.latitude,
    location1.longitude,
    location2.latitude,
    location2.longitude
  );
  return differnce < differenceInMts;
}

export const getAge = (birthDate: Date): string => {
  if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) {
    throw new ConvexError('Invalid date provided');
  }

  const age = differenceInYears(new Date(), birthDate);

  return `${age} yrs`;
};

export const getTimeBetweenFormatted = (
  startDate: Date,
  endDate: Date = new Date(),
  options?: { unit?: 'auto' | 'hours' | 'minutes' | 'seconds'; decimals?: number }
): string => {
  const { unit = 'auto', decimals = 1 } = options || {};

  const earlier = startDate < endDate ? startDate : endDate;
  const later = startDate < endDate ? endDate : startDate;

  const diffMs = later.getTime() - earlier.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffMinutes = diffMs / (1000 * 60);
  const diffSeconds = diffMs / 1000;

  // If unit is explicitly specified, use that
  if (unit !== 'auto') {
    switch (unit) {
      case 'hours':
        return `${diffHours.toFixed(decimals)} hrs`;
      case 'minutes':
        return `${Math.round(diffMinutes)} mins`;
      case 'seconds':
        return `${Math.round(diffSeconds)} secs`;
    }
  }

  // Auto mode: choose appropriate unit
  if (diffHours >= 1) {
    return `${diffHours.toFixed(decimals)} hrs`;
  } else if (diffMinutes >= 1) {
    // Round to nearest integer for minutes when less than 1 hour
    return `${Math.round(diffMinutes)} mins`;
  } else {
    // Round to nearest integer for seconds when less than 1 minute
    return `${Math.round(diffSeconds)} secs`;
  }
};
