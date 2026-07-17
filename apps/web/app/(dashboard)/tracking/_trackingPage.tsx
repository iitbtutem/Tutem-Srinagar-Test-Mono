"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import * as Ably from "ably";
import { Loader2, Wifi, WifiOff, Car, Search, Clock } from "lucide-react";
import { OnlineBadge } from "@/components/ui/badge";
import { formatTimeAgo, getInitials } from "@/lib/utils";

interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface DriverInfo {
  _id: string;
  isOnline: boolean;
  isAvailableForRide: boolean;
  userDetails: {
    firstName: string;
    lastName?: string;
    phoneNumber: string;
    profilePictureKey?: string;
  };
  vehicle: {
    model: string;
    class: string;
    registrationNumber: string;
  } | null;
  organization: { name: string } | null;
}

interface DriverMarkerState {
  driverId: string;
  location: DriverLocation;
  info?: DriverInfo;
}

function DriverCard({
  marker,
  onClick,
  isSelected,
}: {
  marker: DriverMarkerState;
  onClick: () => void;
  isSelected: boolean;
}) {
  const name = marker.info?.userDetails
    ? `${marker.info.userDetails.firstName} ${marker.info.userDetails.lastName ?? ""}`.trim()
    : `Driver ${marker.driverId.slice(-6)}`;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 text-xs font-bold overflow-hidden shrink-0">
          {marker.info?.userDetails?.profilePictureKey ? (
            <img
              src={marker.info.userDetails.profilePictureKey}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            getInitials(
              marker.info?.userDetails?.firstName ?? "D",
              marker.info?.userDetails?.lastName,
            )
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{name}</p>
          {marker.info?.vehicle && (
            <p className="text-xs text-muted-foreground truncate">
              {marker.info.vehicle.model} •{" "}
              {marker.info.vehicle.registrationNumber}
            </p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />
            {formatTimeAgo(marker.location.timestamp)}
          </p>
        </div>
        <OnlineBadge isOnline={marker.info?.isOnline ?? true} />
      </div>
    </button>
  );
}

export function TrackingPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const ablyRef = useRef<Ably.Realtime | null>(null);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isAblyConnected, setIsAblyConnected] = useState(false);
  const [driverLocations, setDriverLocations] = useState<
    Map<string, DriverMarkerState>
  >(new Map());
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOnline, setFilterOnline] = useState(false);

  const drivers = useAuthenticatedQuery(
    api.routes.admin.getAllDrivers,
  ) as DriverInfo[] | undefined;

  const filteredLocations = Array.from(driverLocations.values()).filter((m) => {
    const name = m.info?.userDetails
      ? `${m.info.userDetails.firstName} ${m.info.userDetails.lastName ?? ""}`.toLowerCase()
      : "";
    const phone = m.info?.userDetails?.phoneNumber ?? "";
    if (
      searchQuery &&
      !name.includes(searchQuery.toLowerCase()) &&
      !phone.includes(searchQuery)
    )
      return false;
    if (filterOnline && !m.info?.isOnline) return false;
    return true;
  });

  const initMap = useCallback(() => {
    if (!mapRef.current) return;
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 34.0837, lng: 74.7973 }, // Srinagar
      zoom: 12,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    setIsMapLoaded(true);
  }, []);

  // Load Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || typeof window === "undefined") return;

    if (window.google?.maps) {
      initMap();
      return;
    }

    // Load Maps SDK if not already loaded
    if (!document.getElementById("google-maps-script")) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      (window as any).initGoogleMap = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      // Script is injected but not loaded yet
      const interval = setInterval(() => {
        if (window.google?.maps) {
          initMap();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      delete (window as any).initGoogleMap;
    };
  }, [initMap]);

  const activeSubsRef = useRef<Set<string>>(new Set());

  // Connect to Ably
  useEffect(() => {
    const ablyKey = process.env.NEXT_PUBLIC_ABLY_API_KEY;
    if (!ablyKey) return;

    console.log("Initializing Ably Realtime Client...");
    const ably = new Ably.Realtime({ key: ablyKey });
    ablyRef.current = ably;

    ably.connection.on("connected", () => setIsAblyConnected(true));
    ably.connection.on("disconnected", () => setIsAblyConnected(false));
    ably.connection.on("failed", () => setIsAblyConnected(false));

    return () => {
      ably.close();
      ablyRef.current = null;
      setIsAblyConnected(false);
      activeSubsRef.current.clear();
    };
  }, []);

  // Subscribe to driver channels reactively
  useEffect(() => {
    const ably = ablyRef.current;
    if (!ably || !isAblyConnected || !drivers) return;

    const currentDriverIds = new Set(drivers.map((d) => d._id));
    const activeSubs = activeSubsRef.current;

    // 1. Unsubscribe from drivers that are no longer in the list
    activeSubs.forEach((driverId) => {
      if (!currentDriverIds.has(driverId)) {
        try {
          ably.channels.get(`driver:location:${driverId}`).unsubscribe();
          activeSubs.delete(driverId);
        } catch (err) {
          console.error(`Failed to unsubscribe from driver ${driverId}:`, err);
        }
      }
    });

    // 2. Subscribe to driver channels
    drivers.forEach((driver) => {
      const driverId = driver._id;
      if (!activeSubs.has(driverId)) {
        try {
          const channel = ably.channels.get(`driver:location:${driverId}`);
          channel.subscribe((message) => {
            const payload = message.data;
            const latitude = payload.latitude ?? payload.lat;
            const longitude = payload.longitude ?? payload.lng;

            if (latitude === undefined || longitude === undefined) return;

            setDriverLocations((prev) => {
              const next = new Map(prev);
              next.set(driverId, {
                driverId,
                location: {
                  driverId,
                  latitude,
                  longitude,
                  heading: payload.heading,
                  speed: payload.speed,
                  timestamp: payload.timestamp ?? Date.now(),
                },
                info: drivers.find((d) => d._id === driverId),
              });
              return next;
            });
          });
          activeSubs.add(driverId);
        } catch (err) {
          console.error(`Failed to subscribe to driver ${driverId}:`, err);
        }
      }
    });
  }, [drivers, isAblyConnected]);

  // Sync Convex drivers details to the location markers reactively
  useEffect(() => {
    if (!drivers) return;
    setDriverLocations((prev) => {
      let changed = false;
      const next = new Map(prev);
      next.forEach((marker, driverId) => {
        const latestInfo = drivers.find((d) => d._id === driverId);
        if (
          latestInfo &&
          JSON.stringify(marker.info) !== JSON.stringify(latestInfo)
        ) {
          next.set(driverId, {
            ...marker,
            info: latestInfo,
          });
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [drivers]);

  // Update markers when locations change
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;

    const filteredMap = new Map(filteredLocations.map((m) => [m.driverId, m]));

    filteredMap.forEach((marker, driverId) => {
      const pos = {
        lat: marker.location.latitude,
        lng: marker.location.longitude,
      };

      if (markersRef.current.has(driverId)) {
        const existing = markersRef.current.get(driverId)!;
        // Smooth animation
        const animateMarker = (
          from: google.maps.LatLng,
          to: google.maps.LatLngLiteral,
          steps: number = 10,
        ) => {
          let step = 0;
          const interval = setInterval(() => {
            step++;
            const lat = from.lat() + (to.lat - from.lat()) * (step / steps);
            const lng = from.lng() + (to.lng - from.lng()) * (step / steps);
            existing.setPosition(new google.maps.LatLng(lat, lng));
            if (step >= steps) clearInterval(interval);
          }, 20);
        };
        const fromPos = existing.getPosition();
        if (fromPos) animateMarker(fromPos, pos);
        else existing.setPosition(pos);

        // Update rotation dynamically
        const icon = existing.getIcon() as google.maps.Symbol;
        if (icon && icon.rotation !== marker.location.heading) {
          existing.setIcon({
            ...icon,
            rotation: marker.location.heading ?? 0,
          });
        }
      } else {
        const newMarker = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: marker.info?.userDetails
            ? `${marker.info.userDetails.firstName} ${marker.info.userDetails.lastName ?? ""}`
            : `Driver ${driverId.slice(-6)}`,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#8b5cf6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            rotation: marker.location.heading ?? 0,
          },
        });

        newMarker.addListener("click", () => setSelectedDriverId(driverId));
        markersRef.current.set(driverId, newMarker);
      }
    });

    // Remove stale markers
    markersRef.current.forEach((_, id) => {
      if (!filteredMap.has(id)) {
        markersRef.current.get(id)?.setMap(null);
        markersRef.current.delete(id);
      }
    });
  }, [filteredLocations, isMapLoaded]);

  const handleDriverSelect = (driverId: string) => {
    setSelectedDriverId(driverId);
    const loc = driverLocations.get(driverId)?.location;
    if (loc && googleMapRef.current) {
      googleMapRef.current.panTo({ lat: loc.latitude, lng: loc.longitude });
      googleMapRef.current.setZoom(15);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem-3rem)] flex flex-col">
      <div className="page-header flex items-center justify-between shrink-0">
        <div>
          <h1 className="page-title">Live Tracking</h1>
          <p className="page-description">Real-time driver locations</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
              isAblyConnected
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}
          >
            {isAblyConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {isAblyConnected ? "Live" : "Disconnected"}
          </div>
          <span className="text-sm text-muted-foreground">
            {driverLocations.size} tracked
          </span>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drivers…"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filterOnline}
              onChange={(e) => setFilterOnline(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            Online only
          </label>

          {/* Driver list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
            {driverLocations.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Car className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No active drivers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drivers will appear here when online
                </p>
              </div>
            ) : (
              filteredLocations.map((marker) => (
                <DriverCard
                  key={marker.driverId}
                  marker={marker}
                  isSelected={selectedDriverId === marker.driverId}
                  onClick={() => handleDriverSelect(marker.driverId)}
                />
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 rounded-2xl overflow-hidden border border-border relative">
          {!isMapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading map…</p>
              </div>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
