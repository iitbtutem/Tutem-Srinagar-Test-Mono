"use client";

import {
  useAuthenticatedQuery,
  useAuthenticatedMutation,
} from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, getInitials } from "@/lib/utils";
import { Star, ArrowLeft, Phone, Calendar, Shield, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function RiderDetailPage({
  id,
  initialRider,
}: {
  id: string;
  initialRider?: any;
}) {
  const router = useRouter();

  const liveRider = useAuthenticatedQuery(api.routes.admin.getRiderById, {
    id: id as any,
  }) as any;

  const rider = liveRider ?? initialRider;

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isRidesDialogOpen, setIsRidesDialogOpen] = useState(false);
  const [ridesPage, setRidesPage] = useState(1);
  const [ridesFilter, setRidesFilter] = useState<
    "All" | "Completed" | "Canceled"
  >("All");

  const completedRides =
    rider?.rideHistory?.filter((r: any) => r.status === "Completed").length ??
    0;
  const cancelledRides =
    rider?.rideHistory?.filter(
      (r: any) => r.status === "Canceled" || r.status === "Abort",
    ).length ?? 0;

  const filteredRides = (rider?.rideHistory || []).filter((ride: any) => {
    if (ridesFilter === "Completed") return ride.status === "Completed";
    if (ridesFilter === "Canceled")
      return ride.status === "Canceled" || ride.status === "Abort";
    return true;
  });

  const ITEMS_PER_PAGE = 5;
  const totalRides = filteredRides.length;
  const totalRidesPages = Math.ceil(totalRides / ITEMS_PER_PAGE);
  const paginatedRides = filteredRides.slice(
    (ridesPage - 1) * ITEMS_PER_PAGE,
    ridesPage * ITEMS_PER_PAGE,
  );

  const toggleBlacklistMut = useAuthenticatedMutation(
    api.routes.admin.toggleRiderBlacklist,
  );
  const verifyRiderMut = useAuthenticatedMutation(
    api.routes.admin.verifyRiderAdmin,
  );

  const handleToggleBlacklist = async () => {
    try {
      await toggleBlacklistMut({
        riderId: rider._id,
        isBlacklisted: !rider.isBlacklisted,
      });
    } catch (err) {
      console.error("Failed to toggle blacklist status:", err);
    }
  };

  const handleVerifyRider = async () => {
    try {
      await verifyRiderMut({
        riderId: rider._id,
        isVerified: "Verified",
      });
    } catch (err) {
      console.error("Failed to verify rider:", err);
    }
  };

  const handleRejectRider = async () => {
    try {
      await verifyRiderMut({
        riderId: rider._id,
        isVerified: "Rejected",
      });
    } catch (err) {
      console.error("Failed to reject rider:", err);
    }
  };

  if (rider === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!rider) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold">Rider not found</h2>
        <Link href="/riders" className="mt-4 text-primary hover:underline">
          Back to Riders
        </Link>
      </div>
    );
  }

  const name =
    `${rider.userDetails.firstName} ${rider.userDetails.lastName ?? ""}`.trim();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="page-title">{name}</h1>
            <p className="page-description">Rider Profile</p>
          </div>
        </div>
        {/* Blacklist/Unblock Rider */}
        {rider.isBlacklisted ? (
          <Button
            variant="outline"
            className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 cursor-pointer"
            onClick={handleToggleBlacklist}
          >
            Unblock Rider
          </Button>
        ) : (
          <Button
            variant="destructive"
            className="cursor-pointer"
            onClick={handleToggleBlacklist}
          >
            Blacklist Rider
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel */}
        <div className="space-y-4">
          {/* Profile card */}
          <div className="card-glass p-5 flex flex-col items-center text-center gap-3">
            <div
              className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold ring-4 ring-primary/20 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
              onClick={() => {
                if (rider.userDetails.profilePictureKey) {
                  setActiveImage(rider.userDetails.profilePictureKey);
                }
              }}
            >
              {rider.userDetails.profilePictureKey ? (
                <img
                  src={rider.userDetails.profilePictureKey}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                getInitials(
                  rider.userDetails.firstName,
                  rider.userDetails.lastName,
                )
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{name}</h2>
              <p className="text-muted-foreground text-sm">
                {rider.userDetails.phoneNumber}
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-center">
              <StatusBadge status={rider.isVerified} />
              {rider.isBlacklisted && (
                <span className="badge-status bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Blacklisted
                </span>
              )}
            </div>
            {rider.averageRating !== null && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">
                  {rider.averageRating.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({rider.totalRatings} ratings)
                </span>
              </div>
            )}
            <div className="w-full border-t border-border pt-4 mt-2 space-y-2">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider text-left">
                Admin Actions
              </p>
              <div className="flex flex-col gap-2 w-full">
                {/* Verify/Reject Rider */}
                {rider.isVerified === "Verified" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    onClick={handleRejectRider}
                  >
                    Reject Verification
                  </Button>
                ) : (
                  <div className="flex gap-2 w-full">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                      onClick={handleVerifyRider}
                    >
                      Verify Rider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      onClick={handleRejectRider}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setRidesFilter("Completed");
                setRidesPage(1);
                setIsRidesDialogOpen(true);
              }}
              className="card-glass p-4 text-center cursor-pointer hover:bg-muted/10 transition-colors focus:outline-none"
            >
              <div className="text-2xl font-bold text-green-500">
                {completedRides}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Completed
              </div>
            </button>
            <button
              onClick={() => {
                setRidesFilter("Canceled");
                setRidesPage(1);
                setIsRidesDialogOpen(true);
              }}
              className="card-glass p-4 text-center cursor-pointer hover:bg-muted/10 transition-colors focus:outline-none"
            >
              <div className="text-2xl font-bold text-red-500">
                {cancelledRides}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Cancelled
              </div>
            </button>
          </div>

          {/* Info */}
          <div className="card-glass p-5 space-y-3">
            <h3 className="font-semibold text-sm">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{rider.userDetails.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>DOB: {rider.userDetails.dob}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Gender: {rider.userDetails.gender}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Joined: {formatDate(rider._creationTime)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ratings */}
          {rider.ratings?.length > 0 && (
            <div className="card-glass p-5">
              <h3 className="font-semibold mb-3">Recent Ratings</h3>
              <div className="space-y-3">
                {rider.ratings.slice(0, 5).map((rating: any) => (
                  <div
                    key={rating._id}
                    className="flex items-start gap-3 border-b border-border last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= rating.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rating.comment || "No comment"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Rides */}
          <div className="card-glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Recent Rides</h3>
              {(rider.rideHistory?.length || 0) > 0 && (
                <button
                  onClick={() => {
                    setRidesFilter("All");
                    setRidesPage(1);
                    setIsRidesDialogOpen(true);
                  }}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  View All ({rider.rideHistory?.length || 0})
                </button>
              )}
            </div>
            {!rider.rideHistory || rider.rideHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No rides yet</p>
            ) : (
              <div className="space-y-2">
                {rider.rideHistory?.slice(0, 3).map((ride: any) => (
                  <Link
                    key={ride._id}
                    href={`/rides/${ride._id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors w-full text-left cursor-pointer"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {ride.pickup.address}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          → {ride.destination.address}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <StatusBadge status={ride.status} />
                      <p className="text-xs text-muted-foreground mt-1">
                        ₹{ride.fare}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!activeImage}
        onOpenChange={(open) => !open && setActiveImage(null)}
      >
        <DialogContent className="max-w-3xl p-1 bg-transparent border-none shadow-none flex items-center justify-center">
          {activeImage && (
            <img
              src={activeImage}
              alt="Full size view"
              className="max-h-[85vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Paginated Rides Dialog */}
      <Dialog
        open={isRidesDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsRidesDialogOpen(false);
        }}
      >
        <DialogContent className="max-w-xl p-5 bg-card border border-border shadow-2xl rounded-2xl">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">
                {ridesFilter === "All"
                  ? "Recent Rides"
                  : ridesFilter === "Completed"
                    ? "Completed Rides"
                    : "Cancelled Rides"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                {Math.min(totalRides, (ridesPage - 1) * ITEMS_PER_PAGE + 1)}–
                {Math.min(totalRides, ridesPage * ITEMS_PER_PAGE)} of{" "}
                {totalRides} rides
              </p>
            </div>

            {totalRides === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No rides yet.
              </p>
            ) : (
              <div className="space-y-3">
                {paginatedRides.map((ride: any) => (
                  <div
                    key={ride._id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <MapPin className="h-4.5 w-4.5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {ride.pickup.address}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          → {ride.destination.address}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Requested: {formatDate(ride.requestedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0 ml-3">
                      <div className="text-right">
                        <StatusBadge status={ride.status} />
                        <p className="text-xs font-semibold mt-1">
                          ₹{ride.fare}
                        </p>
                      </div>
                      <Link
                        href={`/rides/${ride._id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalRidesPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ridesPage === 1}
                  onClick={() => setRidesPage((prev) => Math.max(1, prev - 1))}
                  className="cursor-pointer"
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {ridesPage} of {totalRidesPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={ridesPage === totalRidesPages}
                  onClick={() =>
                    setRidesPage((prev) => Math.min(totalRidesPages, prev + 1))
                  }
                  className="cursor-pointer"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
