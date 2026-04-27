export const mapStyle = {
  light: [
  // Base
  { elementType: "geometry", stylers: [{ color: "#f8f9fa" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "on" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5f6368" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

  // Administrative
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#dadce0" }]
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3c4043" }]
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#1a73e8" }]
  },

  // Landscape
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#e6f4ea" }]
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ color: "#f1f3f4" }]
  },

  // Parks
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#cdeccd" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#137333" }]
  },

  // General POI
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7280" }]
  },

  // Roads
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#e5e7eb" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#80868b" }]
  },

  // Highway
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#fde293" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#fbbc04" }]
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#b06000" }]
  },

  // Arterial
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },

  // Local roads
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }]
  },

  // Transit
  {
    featureType: "transit.line",
    elementType: "geometry",
    stylers: [{ color: "#d2e3fc" }]
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#1a73e8" }]
  },

  // Water
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#d2e3fc" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#1a73e8" }]
  }
],
  dark: [
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1f33' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1e3a5f' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c1929' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
  ]
};