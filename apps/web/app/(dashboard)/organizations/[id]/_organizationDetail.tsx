"use client";

import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  MapPin,
  CheckCircle,
  XCircle,
  Loader2,
  Edit,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { OrgRatesPanel } from "./_orgRatesPanel";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { OrgModal } from "../_organizationsPage";

function BooleanBadge({
  value,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean;
  yesLabel?: string;
  noLabel?: string;
}) {
  return value ? (
    <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
      <CheckCircle className="h-3.5 w-3.5" /> {yesLabel}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-muted-foreground text-sm">
      <XCircle className="h-3.5 w-3.5" /> {noLabel}
    </span>
  );
}

function OrgMap({
  polygon,
  boundingBox,
}: {
  polygon?: { latitude: number; longitude: number }[];
  boundingBox?: any;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps) return;

    let center = { lat: 34.0837, lng: 74.7973 }; // Default Srinagar
    let zoom = 12;

    if (polygon && polygon.length > 0) {
      // Calculate center
      const lats = polygon.map((p) => p.latitude);
      const lngs = polygon.map((p) => p.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
    }

    const map = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    if (polygon && polygon.length > 0) {
      const paths = polygon.map((p) => ({ lat: p.latitude, lng: p.longitude }));
      const poly = new google.maps.Polygon({
        paths,
        strokeColor: "#f97316", // orange-500
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#f97316",
        fillOpacity: 0.2,
      });
      poly.setMap(map);

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      paths.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);
    } else if (boundingBox) {
      const bounds = new google.maps.LatLngBounds(
        { lat: boundingBox.south.latitude, lng: boundingBox.west.longitude },
        { lat: boundingBox.north.latitude, lng: boundingBox.east.longitude },
      );
      map.fitBounds(bounds);
    }

    setMapLoaded(true);
  }, [polygon, boundingBox]);

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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initOrgGoogleMap`;
      script.async = true;
      script.defer = true;
      (window as any).initOrgGoogleMap = () => {
        initMap();
      };
      document.head.appendChild(script);
    } else {
      // Script script is injected but not loaded yet
      const interval = setInterval(() => {
        if (window.google?.maps) {
          initMap();
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      delete (window as any).initOrgGoogleMap;
    };
  }, [initMap]);

  return (
    <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border mt-3">
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}

export function OrganizationDetailPage({
  id,
  initialOrganizations,
}: {
  id: string;
  initialOrganizations?: any[];
}) {
  const router = useRouter();

  const liveOrganizations = useAuthenticatedQuery(
    api.routes.organizations.getAllOrganizations,
  ) as any[] | undefined;
  
  const organizations = liveOrganizations ?? initialOrganizations;
  const org = organizations?.find((o: any) => o._id === id);

  if (organizations === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Organization not found</h2>
        <Link
          href="/organizations"
          className="mt-4 text-primary hover:underline block"
        >
          Back to Organizations
        </Link>
      </div>
    );
  }

  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <div className="space-y-5">
      <OrgModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        orgToEdit={org}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{org.name}</h1>
            <p className="page-description">Organization Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/drivers?organization=${id}`)}
            className="flex items-center gap-2"
          >
            <Users className="h-4 w-4" />
            View Drivers
          </Button>
          <Button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Organization
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Info card */}
        <div className="card-glass p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{org.name}</h2>
              <p className="text-muted-foreground text-sm flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {org.address}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-border text-sm text-muted-foreground">
            Created {formatDate(org._creationTime)}
          </div>

          <div className="space-y-3 pt-1">
            <h3 className="font-semibold text-sm">Settings</h3>
            {[
              {
                label: "License Verification",
                value: org.isLicenseVerficationRequired,
              },
              {
                label: "Vehicle RC Verification",
                value: org.isVehicleRCVerificationRequired,
              },
              {
                label: "Vehicle Insurance",
                value: org.isVehicleInsuranceImageRequired,
              },
              {
                label: "Driver can edit license",
                value: org.canDriverEditLicense,
                yesLabel: "Allowed",
                noLabel: "Not allowed",
              },
              {
                label: "Driver can edit vehicle",
                value: org.canDriverEditVehicle,
                yesLabel: "Allowed",
                noLabel: "Not allowed",
              },
            ].map(({ label, value, yesLabel, noLabel }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <BooleanBadge
                  value={value}
                  yesLabel={yesLabel}
                  noLabel={noLabel}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Map/polygon card */}
        <div className="card-glass p-5">
          <h3 className="font-semibold mb-3">Service Area</h3>
          {org.polygon ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Polygon with {org.polygon.length} coordinate points defined.
              </p>
              <OrgMap polygon={org.polygon} />
              <div className="rounded-lg bg-muted p-3 max-h-32 overflow-y-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left pb-1">#</th>
                      <th className="text-left pb-1">Latitude</th>
                      <th className="text-left pb-1">Longitude</th>
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {org.polygon.map((pt: any, i: number) => (
                      <tr key={i}>
                        <td className="text-muted-foreground pr-3">{i + 1}</td>
                        <td className="pr-3">{pt.latitude.toFixed(6)}</td>
                        <td>{pt.longitude.toFixed(6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : org.boundingBox ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Bounding box defined.
              </p>
              <OrgMap boundingBox={org.boundingBox} />
              <pre className="text-xs bg-muted rounded-lg p-3 overflow-auto">
                {JSON.stringify(org.boundingBox, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <MapPin className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">
                No service area polygon defined.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                This organization operates without geographic restrictions.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Rates */}
      <OrgRatesPanel orgId={id} />
    </div>
  );
}
