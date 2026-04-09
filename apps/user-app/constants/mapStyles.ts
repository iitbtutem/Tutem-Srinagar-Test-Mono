export const mapStyle = {
  light: [
    {
      elementType: 'geometry',
      stylers: [
        {
          color: '#f5f7fa', // Clean white-gray background
        },
      ],
    },
    {
      elementType: 'labels.icon',
      stylers: [
        {
          visibility: 'off', // Cleaner look like Uber
        },
      ],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#5a6874', // Soft gray for text
        },
      ],
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [
        {
          color: '#ffffff',
        },
      ],
    },
    {
      featureType: 'administrative',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
        {
          weight: 0.8,
        },
      ],
    },
    {
      featureType: 'administrative.country',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#3b4a5a',
        },
      ],
    },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#1a73e8', // Google/Uber blue for city names
        },
        {
          weight: 500,
        },
      ],
    },
    {
      featureType: 'administrative.neighborhood',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#5a6874',
        },
      ],
    },
    {
      featureType: 'landscape.man_made',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'landscape.natural',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e3f2e8', // Soft green for natural areas
        },
      ],
    },
    {
      featureType: 'poi',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#6b7c8a',
        },
      ],
    },
    {
      featureType: 'poi.attraction',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffe5cc', // Warm peach for attractions
        },
      ],
    },
    {
      featureType: 'poi.business',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'poi.government',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'poi.medical',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffe5f0', // Soft pink for medical
        },
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [
        {
          color: '#c8e6d9', // Fresh green for parks
        },
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#2d6a4f', // Deep green text for parks
        },
      ],
    },
    {
      featureType: 'poi.school',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'poi.sports_complex',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffffff', // Pure white roads
        },
        {
          lightness: 0,
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [
        {
          color: '#d1d9e0',
        },
        {
          weight: 1,
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#6b7c8a',
        },
      ],
    },
    {
      featureType: 'road.arterial',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffffff',
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffedd5', // Uber cream/yellow for highways
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [
        {
          color: '#fbbf24', // Golden yellow stroke
        },
        {
          weight: 1.5,
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#d97706', // Amber text
        },
        {
          weight: 500,
        },
      ],
    },
    {
      featureType: 'road.local',
      elementType: 'geometry',
      stylers: [
        {
          color: '#ffffff',
        },
      ],
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'transit.line',
      elementType: 'geometry',
      stylers: [
        {
          color: '#cbd5e1', // Subway lines color
        },
        {
          weight: 2,
        },
      ],
    },
    {
      featureType: 'transit.station',
      elementType: 'geometry',
      stylers: [
        {
          color: '#e8edf2',
        },
      ],
    },
    {
      featureType: 'transit.station',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#1a73e8', // Uber blue for stations
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [
        {
          color: '#dbeafe', // Soft Uber blue for water
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#3b82f6', // Vibrant blue text
        },
      ],
    },
  ],
  dark: [
    {
      elementType: 'geometry',
      stylers: [
        {
          color: '#242f3e',
        },
      ],
    },
    {
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#746855',
        },
      ],
    },
    {
      elementType: 'labels.text.stroke',
      stylers: [
        {
          color: '#242f3e',
        },
      ],
    },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#d59563',
        },
      ],
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#d59563',
        },
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [
        {
          color: '#263c3f',
        },
      ],
    },
    {
      featureType: 'poi.park',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#6b9a76',
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [
        {
          color: '#38414e',
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [
        {
          color: '#212a37',
        },
      ],
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#9ca5b3',
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [
        {
          color: '#746855',
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [
        {
          color: '#1f2835',
        },
      ],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#f3d19c',
        },
      ],
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [
        {
          color: '#2f3948',
        },
      ],
    },
    {
      featureType: 'transit.station',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#d59563',
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [
        {
          color: '#17263c',
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [
        {
          color: '#515c6d',
        },
      ],
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [
        {
          color: '#17263c',
        },
      ],
    },
  ],
};