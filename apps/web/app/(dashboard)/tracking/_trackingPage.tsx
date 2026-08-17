"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import PusherClient from "pusher-js";
import {
  Loader2,
  Wifi,
  WifiOff,
  Car,
  Search,
  Clock,
  ChevronDown,
  X,
  Building2,
  Phone,
  MapPin,
  Navigation,
  User,
  LocateFixed,
} from "lucide-react";
import { OnlineBadge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/utils";

// Types

interface DriverLocation {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface ActiveRideInfo {
  _id: string;
  status: "Active" | "Driver Arrived";
  fare?: number;
  pickup?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  destination?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  updatedAt?: number;
  riderDetails?: {
    firstName: string;
    lastName?: string;
    phoneNumber: string;
  } | null;
}

interface DriverInfo {
  _id: string;
  organizationId: string;
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
    class: "Bike" | "Auto" | "Cab" | string;
    registrationNumber: string;
    color?: string;
    type?: string;
    seatingCapacity?: number;
  } | null;
  organization: { name: string } | null;
  activeRide: ActiveRideInfo | null;
}

interface DriverMarkerState {
  driverId: string;
  location: DriverLocation;
  info?: DriverInfo;
}

// Driver helpers

function getVehicleIconUrl(cls: string): string {
  if (cls === "Bike") return "/assets/bike_icon.png";
  if (cls === "Auto") return "/assets/rickshaw_icon.png";
  return "/assets/cab_icon.png";
}

function getDriverProfilePic(info?: DriverInfo): string {
  return info?.userDetails?.profilePictureKey || "/assets/person.jpg";
}

function getDriverName(info?: DriverInfo) {
  if (!info?.userDetails) return "Unknown Driver";
  return `${info.userDetails.firstName} ${info.userDetails.lastName ?? ""}`.trim();
}

function isBooked(info?: DriverInfo): boolean {
  return !!info?.activeRide;
}

/** Purple for free, amber for booked */
function markerColor(info?: DriverInfo) {
  return isBooked(info) ? "#f59e0b" : "#8b5cf6";
}

// RegBadge — always visible, tooltip on hover

function RegBadge({
  vehicle,
}: {
  vehicle: NonNullable<DriverInfo["vehicle"]>;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex items-center gap-0.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span className="text-[11px] font-mono font-semibold tracking-wide cursor-default">
        {vehicle.registrationNumber}
      </span>
      {show && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-lg">
            <img
              src={getVehicleIconUrl(vehicle.class)}
              alt={vehicle.class}
              className="h-4 w-4 object-contain shrink-0"
            />
            <span className="font-mono font-bold tracking-wider">
              {vehicle.registrationNumber}
            </span>
          </span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-border" />
        </span>
      )}
    </span>
  );
}

// OrgFilterDropdown

interface OrgOption {
  id: string;
  name: string;
}

function OrgFilterDropdown({
  orgs,
  value,
  onChange,
}: {
  orgs: OrgOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () =>
      orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase())),
    [orgs, search],
  );

  const selectedName =
    value === "all"
      ? "All Organisations"
      : (orgs.find((o) => o.id === value)?.name ?? "All Organisations");

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring hover:border-primary/40 transition-colors"
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">{selectedName}</span>
        {value !== "all" && (
          <span
            className="p-0.5 rounded hover:bg-muted"
            onClick={(e) => {
              e.stopPropagation();
              onChange("all");
              setOpen(false);
            }}
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organisations…"
                className="w-full h-7 pl-7 pr-2 text-xs bg-transparent focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            <button
              onClick={() => {
                onChange("all");
                setOpen(false);
                setSearch("");
              }}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors ${value === "all" ? "bg-primary/5 text-primary font-medium" : ""}`}
            >
              All Organisations
            </button>
            {filtered.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  onChange(org.id);
                  setOpen(false);
                  setSearch("");
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors truncate ${value === org.id ? "bg-primary/5 text-primary font-medium" : ""}`}
              >
                {org.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                No results
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function createPulseDotSvg(color: string): string {
  const svg = `<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="16" fill="${color}" opacity="0.5">
      <animate attributeName="r" values="6;18;6" dur="1.2s" repeatCount="indefinite"/>
      <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="20" cy="20" r="8" fill="${color}" stroke="#ffffff" stroke-width="2.5"/>
  </svg>`;
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
}

// DriverCard

function DriverCard({
  marker,
  onClick,
  isSelected,
  onPickupClick,
  onDestinationClick,
  onLocateDriverClick,
}: {
  marker: DriverMarkerState;
  onClick: () => void;
  isSelected: boolean;
  onPickupClick?: (pickup: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  onDestinationClick?: (destination: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  onLocateDriverClick?: (location: DriverLocation) => void;
}) {
  const booked = isBooked(marker.info);
  const name = getDriverName(marker.info);

  const borderCls = isSelected
    ? booked
      ? "border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/20"
      : "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
    : booked
      ? "border-amber-200 dark:border-amber-800/50 hover:border-amber-400"
      : "border-border hover:border-primary/30 hover:bg-muted/50";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${borderCls} ${booked ? "bg-amber-500/[0.03]" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar — uses driver's profile picture or public/assets/person.jpg */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0 border border-border ${booked ? "bg-amber-500/10 text-amber-600" : "bg-purple-500/10 text-purple-500"}`}
        >
          <img
            src={getDriverProfilePic(marker.info)}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          {/* Name + status badge */}
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate">{name}</p>
            {booked && (
              <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                On Ride
              </span>
            )}
          </div>

          {/* Org name */}
          {marker.info?.organization && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5 shrink-0" />
              {marker.info.organization.name}
            </p>
          )}

          {/* Vehicle class icon + reg no — always visible */}
          {marker.info?.vehicle ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <img
                src={getVehicleIconUrl(marker.info.vehicle.class)}
                alt={marker.info.vehicle.class}
                className="h-5.5 w-5.5 object-contain shrink-0"
              />
              <span className="text-[11px] font-medium text-muted-foreground">
                {marker.info.vehicle.class}
              </span>
              <span className="opacity-30">·</span>
              <RegBadge vehicle={marker.info.vehicle} />
            </div>
          ) : null}

          {/* Timestamp */}
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="h-2.5 w-2.5" />
            {formatTimeAgo(marker.location.timestamp)}
          </p>
        </div>

        <OnlineBadge isOnline={marker.info?.isOnline ?? true} />
      </div>

      {/* Expanded details when card is selected */}
      {isSelected && marker.info && (
        <div className="mt-2.5 pt-2 border-t border-border/60 text-xs space-y-2 animate-in fade-in-0 duration-150">

          {marker.info.userDetails?.phoneNumber && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Phone:</span>
              <a
                href={`tel:${marker.info.userDetails.phoneNumber}`}
                onClick={(e) => e.stopPropagation()}
                className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span>{marker.info.userDetails.phoneNumber}</span>
              </a>
            </div>
          )}
          {marker.info.vehicle && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Model:</span>
                <span className="font-medium text-foreground truncate max-w-[140px]">
                  {marker.info.vehicle.model}
                </span>
              </div>
              {marker.info.vehicle.color && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Color:</span>
                  <span className="font-medium text-foreground">
                    {marker.info.vehicle.color}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Reg No:</span>
                <span className="font-mono font-bold text-foreground">
                  {marker.info.vehicle.registrationNumber}
                </span>
              </div>
            </div>
          )}

          {/* Active Ride details when on ride */}
          {marker.info.activeRide && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300/50 dark:border-amber-700/50 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between font-semibold text-amber-700 dark:text-amber-400 pb-1 border-b border-amber-300/40 dark:border-amber-800/40">
                <span className="flex items-center gap-1">
                  <Car className="h-3 w-3" /> Ride Info (
                  {marker.info.activeRide.status})
                </span>
                {marker.info.activeRide.fare != null && (
                  <span className="font-bold flex items-center gap-0.5">
                    ₹{marker.info.activeRide.fare}
                  </span>
                )}
              </div>

              {marker.info.activeRide.riderDetails && (
                <div className="flex items-center justify-between text-foreground">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3 text-amber-600 shrink-0" /> Rider:
                  </span>
                  <div className="font-medium text-right">
                    <span>
                      {marker.info.activeRide.riderDetails.firstName}{" "}
                      {marker.info.activeRide.riderDetails.lastName ?? ""}
                    </span>
                    {marker.info.activeRide.riderDetails.phoneNumber && (
                      <a
                        href={`tel:${marker.info.activeRide.riderDetails.phoneNumber}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ml-1 text-primary hover:underline"
                      >
                        ({marker.info.activeRide.riderDetails.phoneNumber})
                      </a>
                    )}
                  </div>
                </div>
              )}

              {marker.info.activeRide.pickup?.address && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (marker.info?.activeRide?.pickup) {
                      onPickupClick?.(marker.info.activeRide.pickup);
                    }
                  }}
                  className="flex items-start gap-1 text-foreground p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer group"
                  title="Click to highlight pickup location on map"
                >
                  <MapPin className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="text-muted-foreground shrink-0 font-medium">
                    Pickup:
                  </span>
                  <span className="font-medium truncate flex-1 text-right group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                    {marker.info.activeRide.pickup.address}
                  </span>
                </div>
              )}

              {marker.info.activeRide.destination?.address && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (marker.info?.activeRide?.destination) {
                      onDestinationClick?.(marker.info.activeRide.destination);
                    }
                  }}
                  className="flex items-start gap-1 text-foreground p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer group"
                  title="Click to highlight destination location on map"
                >
                  <Navigation className="h-3 w-3 text-rose-600 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="text-muted-foreground shrink-0 font-medium">Dest:</span>
                  <span className="font-medium truncate flex-1 text-right group-hover:text-rose-700 dark:group-hover:text-rose-400">
                    {marker.info.activeRide.destination.address}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-amber-200/50 dark:border-amber-800/30 text-[10px]">
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> Last update:
                </span>
                <span className="font-medium">
                  {formatTimeAgo(marker.location.timestamp)}
                </span>
              </div>
            </div>
          )}

          {/* Footer Action: Locate Driver on Map (Only for drivers on ride) */}
          {marker.info?.activeRide && (
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium">Map Action</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLocateDriverClick?.(marker.location);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer"
                title="Center map on driver location"
              >
                <LocateFixed className="h-3.5 w-3.5" />
                <span>Locate Driver</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// InfoWindow HTML (Google Maps marker hover)

function buildInfoWindowContent(marker: DriverMarkerState): string {
  const info = marker.info;
  const name = getDriverName(info);
  const org = info?.organization?.name ?? "";
  const phone = info?.userDetails?.phoneNumber ?? "";
  const v = info?.vehicle;
  const ride = info?.activeRide;
  const booked = isBooked(info);
  const accentColor = booked ? "#d97706" : "#8b5cf6";
  const bgContainer = booked ? "background:#fffdf5;" : "background:#ffffff;";

  const riderName = ride?.riderDetails
    ? `${ride.riderDetails.firstName} ${ride.riderDetails.lastName ?? ""}`.trim()
    : "N/A";
  const riderPhone = ride?.riderDetails?.phoneNumber ?? "";
  const timeAgo = formatTimeAgo(marker.location.timestamp);

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:6px 4px 4px;min-width:210px;max-width:260px;${bgContainer}">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <div style="font-weight:700;font-size:13px;color:#111;flex:1;">${name}</div>
        ${booked ? `<span style="font-size:10px;font-weight:600;padding:2px 6px;border-radius:99px;background:#fef3c7;color:#b45309;">On Ride</span>` : ""}
      </div>
      ${phone ? `<div style="font-size:11px;color:#4b5563;margin-bottom:4px;display:flex;align-items:center;gap:4px;">📞 <a href="tel:${phone}" style="color:inherit;text-decoration:none;">${phone}</a></div>` : ""}
      ${org ? `<div style="font-size:11px;color:#6b7280;margin-bottom:4px;display:flex;align-items:center;gap:4px;">🏢 ${org}</div>` : ""}
      ${
        v
          ? `
        <div style="border-top:1px solid #e5e7eb;padding-top:4px;font-size:11px;color:#374151;display:flex;flex-direction:column;gap:3px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <img src="${getVehicleIconUrl(v.class)}" style="width:16px;height:16px;object-fit:contain;vertical-align:middle;" alt="" />
            <span><strong>${v.class}</strong>${v.color ? ` &nbsp;·&nbsp; ${v.color}` : ""}</span>
          </div>
          <div style="font-family:monospace;font-weight:700;letter-spacing:0.06em;color:${accentColor};"><span style="color:#000000;">Reg. No. : </span> ${v.registrationNumber}</div>
          <div>Model: ${v.model}</div>
        </div>
      `
          : ""
      }
      ${
        booked && ride
          ? `
        <div style="border-top:1px solid #fcd34d;margin-top:6px;padding-top:6px;background:#fef3c7;border-radius:6px;padding:6px;font-size:11px;display:flex;flex-direction:column;gap:3px;color:#1f2937;">
          <div style="font-weight:700;color:#b45309;display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
            <span>🚗 Active Ride (${ride.status})</span>
            ${ride.fare != null ? `<span style="font-weight:800;color:#047857;">₹${ride.fare}</span>` : ""}
          </div>
          <div>👤 <strong>Rider:</strong> ${riderName} ${riderPhone ? `(<a href="tel:${riderPhone}" style="color:#2563eb;text-decoration:none;">${riderPhone}</a>)` : ""}</div>
          ${ride.pickup?.address ? `<div>📍 <strong>Pickup:</strong> ${ride.pickup.address}</div>` : ""}
          ${ride.destination?.address ? `<div>🏁 <strong>Dest:</strong> ${ride.destination.address}</div>` : ""}
          <div style="font-size:10px;color:#6b7280;margin-top:2px;border-top:1px border-dashed #fde68a;padding-top:2px;">⏱️ <strong>Last update:</strong> ${timeAgo}</div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Direct PNG vehicle marker from public/assets

function getVehicleMarkerIcon(vehicleClass?: string): google.maps.Icon {
  const url = getVehicleIconUrl(vehicleClass ?? "Cab");
  const size = vehicleClass === "Auto" ? 45 : 65;
  const anchor = Math.round(size / 2);
  return {
    url,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(anchor, anchor),
  };
}

// TrackingPage

export function TrackingPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const pusherRef = useRef<PusherClient | null>(null);
  const driverLocationsRef = useRef<Map<string, DriverMarkerState>>(new Map());
  const pulseMarkersRef = useRef<google.maps.Marker[]>([]);
  const pulseTimeoutRef = useRef<NodeJS.Timeout[]>([]);

  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isPusherConnected, setIsPusherConnected] = useState(false);
  const [driverLocations, setDriverLocations] = useState<
    Map<string, DriverMarkerState>
  >(new Map());
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [activeDriverIds, setActiveDriverIds] = useState<Set<string>>(
    new Set(),
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [rideFilter, setRideFilter] = useState<"all" | "free" | "booked">(
    "all",
  );
  const [selectedOrgId, setSelectedOrgId] = useState("all");
  const [selectedVehicleClass, setSelectedVehicleClass] = useState<
    "all" | "Bike" | "Auto" | "Cab"
  >("all");

  // Keep ref in sync
  useEffect(() => {
    driverLocationsRef.current = driverLocations;
  }, [driverLocations]);

  const drivers = useAuthenticatedQuery(api.routes.admin.getAllDrivers) as
    | DriverInfo[]
    | undefined;

  // Extract unique orgs from drivers
  const orgs = useMemo<{ id: string; name: string }[]>(() => {
    if (!drivers) return [];
    const map = new Map<string, string>();
    drivers.forEach((d) => {
      if (d.organizationId && d.organization?.name) {
        map.set(d.organizationId, d.organization.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [drivers]);

  // Apply filters to the tracked location list
  const filteredLocations = useMemo(() => {
    return Array.from(driverLocations.values()).filter((m) => {
      if (rideFilter === "booked" && !isBooked(m.info)) return false;
      if (rideFilter === "free" && isBooked(m.info)) return false;
      if (selectedOrgId !== "all" && m.info?.organizationId !== selectedOrgId)
        return false;
      if (
        selectedVehicleClass !== "all" &&
        m.info?.vehicle?.class !== selectedVehicleClass
      )
        return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name =
          `${m.info?.userDetails?.firstName ?? ""} ${m.info?.userDetails?.lastName ?? ""}`.toLowerCase();
        const phone = m.info?.userDetails?.phoneNumber ?? "";
        const reg = m.info?.vehicle?.registrationNumber?.toLowerCase() ?? "";
        if (!name.includes(q) && !phone.includes(q) && !reg.includes(q))
          return false;
      }
      return true;
    });
  }, [
    driverLocations,
    searchQuery,
    rideFilter,
    selectedOrgId,
    selectedVehicleClass,
  ]);

  const initMap = useCallback(() => {
    if (!mapRef.current) return;

    // Remove any leftover markers from previous hot-reload sessions
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 34.0837, lng: 74.7973 },
      zoom: 12,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    infoWindowRef.current = new google.maps.InfoWindow({
      disableAutoPan: true,
    });

    // Inject CSS to hide the InfoWindow close (X) button
    if (!document.getElementById("gm-iw-style")) {
      const s = document.createElement("style");
      s.id = "gm-iw-style";
      s.textContent = `
        .gm-ui-hover-effect { display: none !important; }
        .gm-style-iw-d { overflow: hidden !important; }
        .gm-style-iw { padding: 8px 12px !important; border-radius: 12px !important; }
      `;
      document.head.appendChild(s);
    }

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
    if (!document.getElementById("google-maps-script")) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      (window as any).initGoogleMap = initMap;
      document.head.appendChild(script);
    } else {
      const iv = setInterval(() => {
        if (window.google?.maps) {
          initMap();
          clearInterval(iv);
        }
      }, 100);
      return () => clearInterval(iv);
    }
    return () => {
      delete (window as any).initGoogleMap;
    };
  }, [initMap]);

  // Seed active driver IDs
  useEffect(() => {
    fetch("/api/pusher/active-drivers")
      .then((r) => r.json())
      .then((d: { activeDriverIds: string[] }) => {
        if (d.activeDriverIds) setActiveDriverIds(new Set(d.activeDriverIds));
      })
      .catch(() => {});
  }, []);

  const activeSubsRef = useRef<Set<string>>(new Set());

  // Pusher connection
  useEffect(() => {
    const appKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!appKey || !cluster) return;
    const pusher = new PusherClient(appKey, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });
    pusherRef.current = pusher;
    pusher.connection.bind("connected", () => setIsPusherConnected(true));
    pusher.connection.bind("disconnected", () => setIsPusherConnected(false));
    pusher.connection.bind("failed", () => setIsPusherConnected(false));
    const ch = pusher.subscribe("private-active-drivers");
    ch.bind("list-updated", (d: { activeDriverIds: string[] }) =>
      setActiveDriverIds(new Set(d.activeDriverIds)),
    );
    return () => {
      pusher.disconnect();
      pusherRef.current = null;
      setIsPusherConnected(false);
      activeSubsRef.current.clear();
    };
  }, []);

  // Per-driver Pusher subscriptions
  useEffect(() => {
    const pusher = pusherRef.current;
    if (!pusher || !isPusherConnected || !drivers) return;
    const currentIds = new Set(drivers.map((d) => d._id));
    const subs = activeSubsRef.current;
    subs.forEach((id) => {
      if (!currentIds.has(id)) {
        try {
          pusher.unsubscribe(`private-driver-location-${id}`);
          subs.delete(id);
        } catch {}
      }
    });
    drivers.forEach((driver) => {
      if (subs.has(driver._id)) return;
      try {
        const ch = pusher.subscribe(`private-driver-location-${driver._id}`);
        ch.bind("client-locationUpdate", (payload: DriverLocation) => {
          if (payload.latitude === undefined || payload.longitude === undefined)
            return;
          setDriverLocations((prev) => {
            const next = new Map(prev);
            next.set(driver._id, {
              driverId: driver._id,
              location: {
                ...payload,
                timestamp: payload.timestamp ?? Date.now(),
              },
              info: drivers.find((d) => d._id === driver._id),
            });
            return next;
          });
        });
        subs.add(driver._id);
      } catch {}
    });
  }, [drivers, isPusherConnected]);

  // Sync Convex data → location markers
  useEffect(() => {
    if (!drivers) return;
    setDriverLocations((prev) => {
      let changed = false;
      const next = new Map(prev);
      next.forEach((marker, id) => {
        const latest = drivers.find((d) => d._id === id);
        if (latest && JSON.stringify(marker.info) !== JSON.stringify(latest)) {
          next.set(id, { ...marker, info: latest });
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [drivers]);

  // Update Google Maps markers
  useEffect(() => {
    if (!googleMapRef.current || !isMapLoaded) return;
    const filteredMap = new Map(filteredLocations.map((m) => [m.driverId, m]));

    filteredMap.forEach((marker, driverId) => {
      const pos = {
        lat: marker.location.latitude,
        lng: marker.location.longitude,
      };
      const color = markerColor(marker.info);

      if (markersRef.current.has(driverId)) {
        const existing = markersRef.current.get(driverId)!;

        // Smooth animate position
        const from = existing.getPosition();
        if (from) {
          let step = 0;
          const iv = setInterval(() => {
            step++;
            existing.setPosition(
              new google.maps.LatLng(
                from.lat() + (pos.lat - from.lat()) * (step / 10),
                from.lng() + (pos.lng - from.lng()) * (step / 10),
              ),
            );
            if (step >= 10) clearInterval(iv);
          }, 20);
        } else {
          existing.setPosition(pos);
        }

        // Update icon (direct PNG from public/assets)
        existing.setIcon(getVehicleMarkerIcon(marker.info?.vehicle?.class));
      } else {
        const regLabel = marker.info?.vehicle?.registrationNumber
          ? ` (${marker.info.vehicle.registrationNumber})`
          : "";
        const newMarker = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: `${getDriverName(marker.info)}${regLabel}`,
          icon: getVehicleMarkerIcon(marker.info?.vehicle?.class),
        });

        newMarker.addListener("click", () => handleDriverSelect(driverId));

        newMarker.addListener("mouseover", () => {
          const latest = driverLocationsRef.current.get(driverId);
          if (!latest || !infoWindowRef.current) return;
          infoWindowRef.current.setContent(buildInfoWindowContent(latest));
          infoWindowRef.current.open({
            anchor: newMarker,
            map: googleMapRef.current,
          });
        });

        newMarker.addListener("mouseout", () => {
          infoWindowRef.current?.close();
        });

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

  const clearPulseMarkers = useCallback(() => {
    pulseMarkersRef.current.forEach((m) => m.setMap(null));
    pulseMarkersRef.current = [];
    pulseTimeoutRef.current.forEach((t) => clearTimeout(t));
    pulseTimeoutRef.current = [];
  }, []);

  const showSinglePulseMarker = useCallback(
    (
      coords: { latitude: number; longitude: number; address: string },
      type: "pickup" | "destination",
      durationMs = 5000,
    ) => {
      if (!googleMapRef.current || !coords.latitude || !coords.longitude) return;

      clearPulseMarkers();
      const map = googleMapRef.current;
      const pos = { lat: coords.latitude, lng: coords.longitude };
      const targetLatLng = new google.maps.LatLng(pos.lat, pos.lng);

      const currentBounds = map.getBounds();
      const isWithinScreen = currentBounds ? currentBounds.contains(targetLatLng) : false;

      if (isWithinScreen) {
        // Target is on screen — smoothly pan and ensure appropriate zoom level
        map.panTo(pos);
        if ((map.getZoom() ?? 0) < 14) {
          map.setZoom(15);
        }
      } else {
        // Target is NOT on screen — zoom out to show both current view & target location, then pan & zoom in
        const combinedBounds = new google.maps.LatLngBounds();
        if (currentBounds) {
          combinedBounds.union(currentBounds);
        }
        combinedBounds.extend(targetLatLng);

        // Step 1: Smoothly fit bounds (zoom out to include current view + target)
        map.fitBounds(combinedBounds, { top: 70, right: 70, bottom: 70, left: 70 });

        // Step 2: Smoothly pan to target and zoom in after brief delay
        const tPan = setTimeout(() => {
          map.panTo(pos);
          const tZoom = setTimeout(() => {
            map.setZoom(15);
          }, 300);
          pulseTimeoutRef.current.push(tZoom);
        }, 400);
        pulseTimeoutRef.current.push(tPan);
      }

      const color = type === "pickup" ? "#22c55e" : "#ef4444";
      const title = `${type === "pickup" ? "Pickup" : "Destination"}: ${coords.address}`;

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title,
        icon: {
          url: createPulseDotSvg(color),
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 20),
        },
        zIndex: 999,
      });

      pulseMarkersRef.current.push(marker);

      const t = setTimeout(() => {
        marker.setMap(null);
        pulseMarkersRef.current = pulseMarkersRef.current.filter((m) => m !== marker);
      }, durationMs);

      pulseTimeoutRef.current.push(t);
    },
    [clearPulseMarkers],
  );

  const showBothPulseMarkers = useCallback(
    (
      pickup?: { latitude: number; longitude: number; address: string },
      destination?: { latitude: number; longitude: number; address: string },
      driverLoc?: { latitude: number; longitude: number },
      durationMs = 5000,
    ) => {
      if (!googleMapRef.current) return;
      const map = googleMapRef.current;

      clearPulseMarkers();

      const bounds = new google.maps.LatLngBounds();
      let count = 0;

      if (pickup?.latitude && pickup?.longitude) {
        const pos = { lat: pickup.latitude, lng: pickup.longitude };
        bounds.extend(pos);
        count++;

        const pMarker = new google.maps.Marker({
          position: pos,
          map,
          title: `Pickup: ${pickup.address}`,
          icon: {
            url: createPulseDotSvg("#22c55e"),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          },
          zIndex: 999,
        });
        pulseMarkersRef.current.push(pMarker);

        const t1 = setTimeout(() => {
          pMarker.setMap(null);
          pulseMarkersRef.current = pulseMarkersRef.current.filter((m) => m !== pMarker);
        }, durationMs);
        pulseTimeoutRef.current.push(t1);
      }

      if (destination?.latitude && destination?.longitude) {
        const pos = { lat: destination.latitude, lng: destination.longitude };
        bounds.extend(pos);
        count++;

        const dMarker = new google.maps.Marker({
          position: pos,
          map,
          title: `Destination: ${destination.address}`,
          icon: {
            url: createPulseDotSvg("#ef4444"),
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          },
          zIndex: 999,
        });
        pulseMarkersRef.current.push(dMarker);

        const t2 = setTimeout(() => {
          dMarker.setMap(null);
          pulseMarkersRef.current = pulseMarkersRef.current.filter((m) => m !== dMarker);
        }, durationMs);
        pulseTimeoutRef.current.push(t2);
      }

      if (driverLoc?.latitude && driverLoc?.longitude) {
        bounds.extend({ lat: driverLoc.latitude, lng: driverLoc.longitude });
        count++;
      }

      if (count > 0) {
        const currentBounds = map.getBounds();
        const isFullyVisible = currentBounds
          ? currentBounds.contains(bounds.getNorthEast()) &&
            currentBounds.contains(bounds.getSouthWest())
          : false;

        if (count === 1) {
          const center = bounds.getCenter();
          if (isFullyVisible) {
            map.panTo(center);
            map.setZoom(15);
          } else {
            const combined = new google.maps.LatLngBounds();
            if (currentBounds) combined.union(currentBounds);
            combined.extend(center);
            map.fitBounds(combined, { top: 70, right: 70, bottom: 70, left: 70 });
            const tPan = setTimeout(() => {
              map.panTo(center);
              const tZoom = setTimeout(() => map.setZoom(15), 300);
              pulseTimeoutRef.current.push(tZoom);
            }, 400);
            pulseTimeoutRef.current.push(tPan);
          }
        } else {
          if (!isFullyVisible && currentBounds) {
            const combined = new google.maps.LatLngBounds();
            combined.union(currentBounds);
            combined.union(bounds);
            map.fitBounds(combined, { top: 70, right: 70, bottom: 70, left: 70 });
            const tFit = setTimeout(() => {
              map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
            }, 400);
            pulseTimeoutRef.current.push(tFit);
          } else {
            map.fitBounds(bounds, { top: 70, right: 70, bottom: 70, left: 70 });
          }
        }
      }
    },
    [clearPulseMarkers],
  );

  const locateDriverOnMap = useCallback(
    (loc: DriverLocation) => {
      if (!googleMapRef.current || !loc.latitude || !loc.longitude) return;

      clearPulseMarkers();
      const map = googleMapRef.current;
      const pos = { lat: loc.latitude, lng: loc.longitude };
      const targetLatLng = new google.maps.LatLng(pos.lat, pos.lng);

      const currentBounds = map.getBounds();
      const isWithinScreen = currentBounds ? currentBounds.contains(targetLatLng) : false;

      if (isWithinScreen) {
        map.panTo(pos);
        map.setZoom(16);
      } else {
        const combined = new google.maps.LatLngBounds();
        if (currentBounds) combined.union(currentBounds);
        combined.extend(targetLatLng);

        map.fitBounds(combined, { top: 70, right: 70, bottom: 70, left: 70 });
        const tPan = setTimeout(() => {
          map.panTo(pos);
          const tZoom = setTimeout(() => map.setZoom(16), 300);
          pulseTimeoutRef.current.push(tZoom);
        }, 400);
        pulseTimeoutRef.current.push(tPan);
      }
    },
    [clearPulseMarkers],
  );

  const handleDriverSelect = (driverId: string) => {
    setSelectedDriverId((prev) => {
      if (prev === driverId) {
        clearPulseMarkers();
        return null;
      }
      const markerState = driverLocations.get(driverId);
      const loc = markerState?.location;
      const ride = markerState?.info?.activeRide;

      if (ride && (ride.pickup || ride.destination)) {
        showBothPulseMarkers(ride.pickup, ride.destination, loc, 5000);
      } else if (loc) {
        locateDriverOnMap(loc);
      }
      return driverId;
    });
  };

  const onlineCount = drivers?.filter((d) => d.isOnline).length ?? 0;
  const bookedCount = Array.from(driverLocations.values()).filter((m) =>
    isBooked(m.info),
  ).length;
  const activeCount = activeDriverIds.size;

  return (
    <div className="h-[calc(100vh-4rem-3rem)] flex flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between shrink-0">
        <div>
          <h1 className="page-title">Live Tracking</h1>
          <p className="page-description">Real-time driver locations</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Connection */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${isPusherConnected ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
          >
            {isPusherConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {isPusherConnected ? "Live" : "Disconnected"}
          </div>
          {/* Active (sending location) */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            {activeCount} active
          </div>
          {/* Booked */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium">
            {bookedCount} on ride
          </div>
          <span className="text-sm text-muted-foreground">
            {onlineCount} online · {driverLocations.size} tracked
          </span>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-80 shrink-0 flex flex-col gap-2.5 min-h-0 h-full">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, reg…"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Org filter */}
          <OrgFilterDropdown
            orgs={orgs}
            value={selectedOrgId}
            onChange={setSelectedOrgId}
          />

          {/* Vehicle Class Filter */}
          <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-input text-xs font-medium">
            <span className="text-muted-foreground px-1.5 text-[11px] font-semibold shrink-0">
              Class:
            </span>
            {(["all", "Bike", "Auto", "Cab"] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setSelectedVehicleClass(cls)}
                className={`flex-1 py-1 rounded-md transition-all text-center cursor-pointer ${
                  selectedVehicleClass === cls
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {cls === "all" ? "All" : cls}
              </button>
            ))}
          </div>

          {/* Ride-status segmented filter — dots double as the colour legend */}
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            {(
              [
                {
                  key: "all",
                  label: "All",
                  dot: null,
                  active: "bg-muted/80 text-foreground",
                },
                {
                  key: "free",
                  label: "Free",
                  dot: "bg-purple-500",
                  active: "bg-purple-600 text-white",
                },
                {
                  key: "booked",
                  label: "On Ride",
                  dot: "bg-amber-500",
                  active: "bg-amber-500 text-white",
                },
              ] as const
            ).map(({ key, label, dot, active }, i) => (
              <button
                key={key}
                onClick={() => setRideFilter(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 transition-colors ${
                  rideFilter === key
                    ? active
                    : "hover:bg-muted/60 text-muted-foreground"
                } ${i > 0 ? "border-l border-border" : ""}`}
              >
                {dot && (
                  <span
                    className={`w-2 h-2 rounded-full ${rideFilter === key ? "bg-white/80" : dot}`}
                  />
                )}
                {label}
              </button>
            ))}
          </div>

          {/* Driver list — vertically scrollable flex container */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1.5">
            {driverLocations.size === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Car className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No active drivers</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drivers will appear when sending location
                </p>
              </div>
            ) : filteredLocations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-8 w-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No matches</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              filteredLocations.map((marker) => (
                <DriverCard
                  key={marker.driverId}
                  marker={marker}
                  isSelected={selectedDriverId === marker.driverId}
                  onClick={() => handleDriverSelect(marker.driverId)}
                  onPickupClick={(pickup) =>
                    showSinglePulseMarker(pickup, "pickup", 5000)
                  }
                  onDestinationClick={(destination) =>
                    showSinglePulseMarker(destination, "destination", 5000)
                  }
                  onLocateDriverClick={(loc) => locateDriverOnMap(loc)}
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
