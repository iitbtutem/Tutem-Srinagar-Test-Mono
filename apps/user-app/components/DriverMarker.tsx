import { Marker } from 'react-native-maps';
import { VEHICLE_CLASS } from '../constants/index';
import { Image, View } from 'react-native';

type Coords = { latitude: number; longitude: number };

export default function DriverMarker({
  location,
  vehicleClass,
}: {
  location: Coords;
  vehicleClass: (typeof VEHICLE_CLASS)[number];
}) {
  const getImgSource = () => {
    if (vehicleClass === 'Cab') return require('@/assets/images/cab_icon.png');
    if (vehicleClass === 'Auto') return require('@/assets/images/rickshaw_icon.png');
    return require('@/assets/images/bike_icon.png');
  };
  const source = getImgSource();
  return (
    <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
      <View className="h-8 w-8 items-center justify-center rounded-full">
        <Image source={source} style={{ width: 32, height: 32 }} resizeMode="contain" />
      </View>
    </Marker>
  );
}
