import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NavigationProp, ParamListBase } from '@react-navigation/native';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFare(amount?: number) {
  if (!amount) return '—';
  return `₹${amount.toFixed(0)}`;
};

export function numberFormat(number: number) {
  return new Intl.NumberFormat("en-In", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(number);
};

export function distanceFormat(number: number) {
  return new Intl.NumberFormat("en-In", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(number) + " km";
};

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
};

export function isNearby (
  location1: { latitude: number, longitude: number }, 
  location2: { latitude: number, longitude: number }, 
  differenceInMts: number
){
  const differnce = haversineDistance(
    location1.latitude,
    location1.longitude,
    location2.latitude,
    location2.longitude
  );
  return differnce < differenceInMts;
};