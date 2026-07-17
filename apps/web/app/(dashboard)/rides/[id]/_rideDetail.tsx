"use client";

import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatDistance,
  getInitials,
} from "@/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Star,
  Printer,
  Clock,
  User,
  Car,
  CreditCard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function TimelineItem({
  label,
  time,
  done,
}: {
  label: string;
  time?: number;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-3 h-3 rounded-full mt-1 shrink-0 ring-2 ${done ? "bg-primary ring-primary/30" : "bg-muted ring-border"}`}
      />
      <div>
        <p
          className={`text-sm font-medium ${done ? "" : "text-muted-foreground"}`}
        >
          {label}
        </p>
        {time && (
          <p className="text-xs text-muted-foreground">
            {formatDateTime(time)}
          </p>
        )}
      </div>
    </div>
  );
}

export function RideDetailPage({
  id,
  initialRide,
}: {
  id: string;
  initialRide?: any;
}) {
  const router = useRouter();

  const liveRide = useAuthenticatedQuery(api.routes.admin.getRideByIdAdmin, {
    id: id as any,
  }) as any;

  const ride = liveRide ?? initialRide;

  if (ride === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Ride not found</h2>
        <Link href="/rides" className="mt-4 text-primary hover:underline block">
          Back to Rides
        </Link>
      </div>
    );
  }

  const riderName = ride.rider?.userDetails
    ? `${ride.rider.userDetails.firstName} ${ride.rider.userDetails.lastName ?? ""}`.trim()
    : "Unknown Rider";

  const driverName = ride.driver?.userDetails
    ? `${ride.driver.userDetails.firstName} ${ride.driver.userDetails.lastName ?? ""}`.trim()
    : "Unknown Driver";

  const riderRating = ride.ratings?.find((r: any) => r.raterType === "Rider");
  const driverRating = ride.ratings?.find((r: any) => r.raterType === "Driver");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors print:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">Ride Details</h1>
            <p className="page-description">
              {formatDateTime(ride.requestedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ride.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-2 print:hidden"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Route */}
          <div className="card-glass p-5">
            <h3 className="font-semibold mb-4">Route</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 ring-4 ring-green-500/20" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="font-medium">{ride.pickup.address}</p>
                </div>
              </div>
              <div className="ml-1.5 h-8 border-l-2 border-dashed border-border" />
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0 ring-4 ring-red-500/20" />
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium">{ride.destination.address}</p>
                </div>
              </div>
              {ride.dropOff && (
                <>
                  <div className="ml-1.5 h-8 border-l-2 border-dashed border-orange-300" />
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-orange-500 mt-1 shrink-0 ring-4 ring-orange-500/20" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Actual Drop-off
                      </p>
                      <p className="font-medium">{ride.dropOff.address}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Distance</p>
                <p className="font-semibold">{formatDistance(ride.distance)}</p>
              </div>
              {ride.expectedDuration && (
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold">{ride.expectedDuration}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Fare</p>
                <p className="font-semibold text-primary">
                  {formatCurrency(ride.fare)}
                </p>
              </div>
            </div>
          </div>

          {/* People */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Rider */}
            <div className="card-glass p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Rider</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-sm overflow-hidden">
                  {ride.rider?.userDetails?.profilePictureKey ? (
                    <img
                      src={ride.rider.userDetails.profilePictureKey}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(
                      ride.rider?.userDetails?.firstName ?? "?",
                      ride.rider?.userDetails?.lastName,
                    )
                  )}
                </div>
                <div>
                  <p className="font-medium">{riderName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ride.rider?.userDetails?.phoneNumber}
                  </p>
                </div>
              </div>
              {riderRating && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Rider's Rating
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= riderRating.score ? "fill-yellow-400 text-yellow-400" : "text-muted/30"}`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">
                      {riderRating.comment}
                    </span>
                  </div>
                </div>
              )}
              {ride.rider?._id && (
                <Link
                  href={`/riders/${ride.rider._id}`}
                  className="mt-3 text-xs text-primary hover:underline block"
                >
                  View full profile →
                </Link>
              )}
            </div>

            {/* Driver */}
            <div className="card-glass p-5">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Driver</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-sm overflow-hidden">
                  {ride.driver?.userDetails?.profilePictureKey ? (
                    <img
                      src={ride.driver.userDetails.profilePictureKey}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    getInitials(
                      ride.driver?.userDetails?.firstName ?? "?",
                      ride.driver?.userDetails?.lastName,
                    )
                  )}
                </div>
                <div>
                  <p className="font-medium">{driverName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ride.driver?.userDetails?.phoneNumber}
                  </p>
                </div>
              </div>
              {ride.vehicle && (
                <p className="text-xs text-muted-foreground mt-2">
                  {ride.vehicle.model} • {ride.vehicle.registrationNumber}
                </p>
              )}
              {driverRating && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-1">
                    Driver's Rating
                  </p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3.5 w-3.5 ${s <= driverRating.score ? "fill-yellow-400 text-yellow-400" : "text-muted/30"}`}
                      />
                    ))}
                    <span className="text-xs text-muted-foreground ml-1">
                      {driverRating.comment}
                    </span>
                  </div>
                </div>
              )}
              {ride.driver?._id && (
                <Link
                  href={`/drivers/${ride.driver._id}`}
                  className="mt-3 text-xs text-primary hover:underline block"
                >
                  View full profile →
                </Link>
              )}
            </div>
          </div>

          {/* Cancellation reason */}
          {ride.reasons?.length > 0 && (
            <div className="card-glass p-5">
              <h3 className="font-semibold mb-2">Cancellation Reason</h3>
              <p className="text-sm text-muted-foreground">
                {ride.reasons[0].reason}
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Fare breakdown */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Fare Breakdown</h3>
            </div>
            {ride.orgRates?.length > 0 &&
              ride.vehicle &&
              (() => {
                const rate = ride.orgRates.find(
                  (r: any) => r.vehicleClass === ride.vehicle.class,
                );
                if (!rate) return null;
                const distKm = ride.distance / 1000;
                const baseKm = rate.baseDistance / 1000;
                const extraKm = Math.max(0, distKm - baseKm);
                const extraFare = extraKm * rate.ratePerKm;
                return (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Base fare ({baseKm}km)
                      </span>
                      <span>₹{rate.baseDistanceRate}</span>
                    </div>
                    {extraKm > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Extra {extraKm.toFixed(1)}km × ₹{rate.ratePerKm}
                        </span>
                        <span>₹{extraFare.toFixed(0)}</span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-primary">
                        {formatCurrency(ride.fare)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            {(!ride.orgRates?.length || !ride.vehicle) && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Fare</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(ride.fare)}
                </span>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold">Timeline</h3>
            </div>
            <div className="space-y-3 relative">
              <div className="absolute left-1.5 top-3 bottom-3 w-px bg-border" />
              <TimelineItem
                label="Ride Requested"
                time={ride.requestedAt}
                done={true}
              />
              <TimelineItem
                label="Driver Accepted"
                time={ride.acceptedAt}
                done={!!ride.acceptedAt}
              />
              <TimelineItem
                label="Driver Arrived"
                time={ride.arrivedAt}
                done={!!ride.arrivedAt}
              />
              <TimelineItem
                label="Ride Started"
                time={ride.startedAt}
                done={!!ride.startedAt}
              />
              <TimelineItem
                label="Ride Completed"
                time={ride.completedAt}
                done={!!ride.completedAt}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
