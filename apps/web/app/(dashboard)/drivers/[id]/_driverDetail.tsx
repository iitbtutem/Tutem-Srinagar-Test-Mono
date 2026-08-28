"use client";

import {
  useAuthenticatedQuery,
  useAuthenticatedMutation,
} from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  StatusBadge,
  OnlineBadge,
  VerificationBadge,
} from "@/components/ui/badge";
import {
  formatDate,
  getInitials,
  calculateAge,
  toDateInputValue,
} from "@/lib/utils";
import {
  Star,
  ArrowLeft,
  Phone,
  Calendar,
  Building2,
  Car,
  Shield,
  MapPin,
  FileText,
  CreditCard,
  Pencil,
  User,
  CheckCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "convex/react";

export function DriverDetailPage({
  id,
  initialDriver,
}: {
  id: string;
  initialDriver?: any;
}) {
  const router = useRouter();

  const liveDriver = useAuthenticatedQuery(api.routes.admin.getDriverById, {
    id: id as any,
  }) as any;

  const ageSettings = useQuery(api.routes.settings.getUserAgeSettings) as any;

  const driver = liveDriver ?? initialDriver;

  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [isRidesDialogOpen, setIsRidesDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isVehicleEditDialogOpen, setIsVehicleEditDialogOpen] = useState(false);
  const [ridesPage, setRidesPage] = useState(1);
  const [ridesFilter, setRidesFilter] = useState<
    "All" | "Completed" | "Canceled"
  >("All");

  // Edit driver form state
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "Male" as "Male" | "Female" | "Other",
    phoneNumber: "",
    licenseNumber: "",
    isLicenseVerified: "Pending" as "Pending" | "Verified" | "Rejected",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Edit vehicle form state
  const [editVehicleForm, setEditVehicleForm] = useState({
    model: "",
    type: "Hatchback" as "Hatchback" | "Sedan" | "Suv" | "Auto" | "Bike",
    fuelType: "Petrol" as "Petrol" | "Diesel" | "EV",
    class: "Cab" as "Bike" | "Auto" | "Cab",
    color: "",
    registrationNumber: "",
    seatingCapacity: 4,
  });
  const [vehicleEditError, setVehicleEditError] = useState<string | null>(null);
  const [vehicleEditSaving, setVehicleEditSaving] = useState(false);

  const filteredRides = (driver?.rideHistory || []).filter((ride: any) => {
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
    api.routes.admin.toggleDriverBlacklist,
  );
  const verifyLicenseMut = useAuthenticatedMutation(
    api.routes.admin.verifyDriverLicenseAdmin,
  );
  const verifyVehicleMut = useAuthenticatedMutation(
    api.routes.admin.verifyVehicleAdmin,
  );
  const updateDriverMut = useAuthenticatedMutation(
    api.routes.admin.updateDriverAdmin,
  );
  const updateVehicleMut = useAuthenticatedMutation(
    api.routes.admin.updateDriverVehicleAdmin,
  );

  const handleToggleBlacklist = async () => {
    try {
      await toggleBlacklistMut({
        driverId: driver._id,
        isBlacklisted: !driver.isBlacklisted,
      });
    } catch (err) {
      console.error("Failed to toggle blacklist status:", err);
    }
  };

  const handleVerifyLicense = async () => {
    try {
      await verifyLicenseMut({
        driverId: driver._id,
        isLicenseVerified: "Verified",
      });
    } catch (err) {
      console.error("Failed to verify license:", err);
    }
  };

  const handleRejectLicense = async () => {
    try {
      await verifyLicenseMut({
        driverId: driver._id,
        isLicenseVerified: "Rejected",
      });
    } catch (err) {
      console.error("Failed to reject license:", err);
    }
  };

  const handleVerifyVehicle = async () => {
    if (!driver.vehicle) return;
    try {
      await verifyVehicleMut({
        vehicleId: driver.vehicle._id,
        isVerified: "Verified",
      });
    } catch (err) {
      console.error("Failed to verify vehicle:", err);
    }
  };

  const handleRejectVehicle = async () => {
    if (!driver.vehicle) return;
    try {
      await verifyVehicleMut({
        vehicleId: driver.vehicle._id,
        isVerified: "Rejected",
      });
    } catch (err) {
      console.error("Failed to reject vehicle:", err);
    }
  };

  const openEditDialog = () => {
    setEditForm({
      firstName: driver.userDetails.firstName ?? "",
      lastName: driver.userDetails.lastName ?? "",
      dob: toDateInputValue(driver.userDetails.dob),
      gender: driver.userDetails.gender ?? "Male",
      phoneNumber: driver.userDetails.phoneNumber ?? "",
      licenseNumber: driver.licenseNumber ?? "",
      isLicenseVerified: driver.isLicenseVerified ?? "Pending",
    });
    setEditError(null);
    setIsEditDialogOpen(true);
  };

  const openVehicleEditDialog = () => {
    if (!driver.vehicle) return;
    setEditVehicleForm({
      model: driver.vehicle.model ?? "",
      type: driver.vehicle.type ?? "Hatchback",
      fuelType: driver.vehicle.fuelType ?? "Petrol",
      class: driver.vehicle.class ?? "Cab",
      color: driver.vehicle.color ?? "",
      registrationNumber: driver.vehicle.registrationNumber ?? "",
      seatingCapacity: driver.vehicle.seatingCapacity ?? 4,
    });
    setVehicleEditError(null);
    setIsVehicleEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    // Hard block: first name required
    if (!editForm.firstName.trim()) {
      setEditError("First name cannot be empty.");
      return;
    }

    setEditError(null);
    setEditSaving(true);
    try {
      await updateDriverMut({
        driverId: driver._id,
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim() || undefined,
        dob: editForm.dob,
        gender: editForm.gender,
        phoneNumber: editForm.phoneNumber,
        licenseNumber: editForm.licenseNumber,
        isLicenseVerified: editForm.isLicenseVerified,
      });
      setIsEditDialogOpen(false);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  };

  const handleSaveVehicleEdit = async () => {
    if (!driver.vehicle) return;

    // Hard validation
    const seats = Number(editVehicleForm.seatingCapacity);
    if (!seats || seats < 1) {
      setVehicleEditError("Seating capacity must be at least 1.");
      return;
    }
    if (seats > 50) {
      setVehicleEditError("Seating capacity must be at most 50.");
      return;
    }

    setVehicleEditError(null);
    setVehicleEditSaving(true);
    try {
      await updateVehicleMut({
        vehicleId: driver.vehicle._id,
        model: editVehicleForm.model,
        type: editVehicleForm.type,
        fuelType: editVehicleForm.fuelType,
        class: editVehicleForm.class,
        color: editVehicleForm.color,
        registrationNumber: editVehicleForm.registrationNumber,
        seatingCapacity: seats,
      });
      setIsVehicleEditDialogOpen(false);
    } catch (err: any) {
      setVehicleEditError(err?.message ?? "Failed to save vehicle changes");
    } finally {
      setVehicleEditSaving(false);
    }
  };

  if (driver === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80" />
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold">Driver not found</h2>
        <Link
          href="/drivers"
          className="mt-4 text-primary hover:underline block"
        >
          Back to Drivers
        </Link>
      </div>
    );
  }

  const name =
    `${driver.userDetails.firstName} ${driver.userDetails.lastName ?? ""}`.trim();
  const completedRides =
    driver.rideHistory?.filter((r: any) => r.status === "Completed").length ??
    0;
  const cancelledRides =
    driver.rideHistory?.filter(
      (r: any) => r.status === "Canceled" || r.status === "Abort",
    ).length ?? 0;

  const lastEditedAdminName = driver.lastEditedByAdmin
    ? `${driver.lastEditedByAdmin.firstName} ${driver.lastEditedByAdmin.lastName ?? ""}`.trim()
    : null;

  return (
    <div className="space-y-5">
      <div className="flex justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="page-title">{name}</h1>
            <p className="page-description">Driver Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="cursor-pointer gap-2"
            onClick={openEditDialog}
          >
            <Pencil className="h-4 w-4" />
            Edit Driver
          </Button>
          {driver.isBlacklisted ? (
            <Button
              variant="outline"
              className="border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 cursor-pointer"
              onClick={handleToggleBlacklist}
            >
              Unblock Driver
            </Button>
          ) : (
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={handleToggleBlacklist}
            >
              Blacklist Driver
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left panel */}
        <div className="space-y-4">
          <div className="card-glass p-5 flex flex-col items-center text-center gap-3">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold ring-4 ring-primary/20 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => {
                  if (driver.userDetails.profilePictureKey) {
                    setActiveImage(driver.userDetails.profilePictureKey);
                  }
                }}
              >
                {driver.userDetails.profilePictureKey ? (
                  <img
                    src={driver.userDetails.profilePictureKey}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(
                    driver.userDetails.firstName,
                    driver.userDetails.lastName,
                  )
                )}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-card ${driver.isOnline ? "bg-green-500" : "bg-gray-400"}`}
              />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{name}</h2>
              <p className="text-muted-foreground text-sm">
                {driver.userDetails.phoneNumber}
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap justify-center">
              <OnlineBadge isOnline={driver.isOnline} />
              {driver.isBlacklisted && (
                <span className="badge-status bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  Blacklisted
                </span>
              )}
            </div>
            {driver.averageRating !== null && (
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">
                  {driver.averageRating.toFixed(1)}
                </span>
                <span className="text-muted-foreground text-sm">
                  ({driver.totalRatings})
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setRidesFilter("Completed");
                setRidesPage(1);
                setIsRidesDialogOpen(true);
              }}
              className="card-glass p-4 text-center cursor-pointer hover:bg-muted/10 transition-colors w-full h-auto flex flex-col"
            >
              <div className="text-2xl font-bold text-green-500">
                {completedRides}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Completed
              </div>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRidesFilter("Canceled");
                setRidesPage(1);
                setIsRidesDialogOpen(true);
              }}
              className="card-glass p-4 text-center cursor-pointer hover:bg-muted/10 transition-colors w-full h-auto flex flex-col"
            >
              <div className="text-2xl font-bold text-red-500">
                {cancelledRides}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Cancelled
              </div>
            </Button>
          </div>

          {/* Personal info */}
          <div className="card-glass p-5 space-y-3">
            <h3 className="font-semibold text-sm">Personal Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{driver.userDetails.phoneNumber}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>
                  DOB: {formatDate(driver.userDetails.dob)}{" "}
                  <span className="text-foreground font-medium">
                    ({calculateAge(driver.userDetails.dob)} yrs)
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-4 w-4 shrink-0" />
                <span>Gender: {driver.userDetails.gender}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                {driver.organization ? (
                  <Link
                    href={`/organizations/${driver.organizationId}`}
                    className="text-primary hover:underline font-medium transition-colors"
                  >
                    {driver.organization.name}
                  </Link>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Joined: {formatDate(driver._creationTime)}</span>
              </div>
              {lastEditedAdminName && (
                <div className="flex items-start gap-2 text-muted-foreground pt-2 border-t border-border mt-2">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
                  <span className="text-xs">
                    Last edited by{" "}
                    <span className="font-medium text-foreground">
                      {lastEditedAdminName}
                    </span>
                    {driver.lastEditedAt && (
                      <>
                        <br />
                        {formatDate(driver.lastEditedAt)}
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* License */}
          <div className="card-glass p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold">License</h3>
              <div className="flex items-center gap-2">
                <VerificationBadge status={driver.isLicenseVerified} />
                {driver.organization?.isLicenseVerficationRequired && (
                  <>
                    {driver.isLicenseVerified === "Verified" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 cursor-pointer"
                        onClick={handleRejectLicense}
                      >
                        Reject
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800 cursor-pointer"
                          onClick={handleVerifyLicense}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 cursor-pointer"
                          onClick={handleRejectLicense}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              License #:{" "}
              <span className="text-foreground font-medium">
                {driver.licenseNumber}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {driver.licenseImageFrontKey && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Front</p>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveImage(driver.licenseImageFrontKey)}
                    className="w-full text-left focus:outline-none cursor-pointer p-0 h-auto block"
                  >
                    <img
                      src={driver.licenseImageFrontKey}
                      alt="License front"
                      className="rounded-lg border border-border w-full h-32 object-cover hover:opacity-90 transition-opacity"
                    />
                  </Button>
                </div>
              )}
              {driver.licenseImageBackKey && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Back</p>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveImage(driver.licenseImageBackKey)}
                    className="w-full text-left focus:outline-none cursor-pointer p-0 h-auto block"
                  >
                    <img
                      src={driver.licenseImageBackKey}
                      alt="License back"
                      className="rounded-lg border border-border w-full h-32 object-cover hover:opacity-90 transition-opacity"
                    />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle */}
          {driver.vehicle && (
            <div className="card-glass p-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Vehicle</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs gap-1.5 cursor-pointer"
                    onClick={openVehicleEditDialog}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit Vehicle
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <VerificationBadge status={driver.vehicle.isVerified} />
                  {driver.organization?.isVehicleRCVerificationRequired && (
                    <>
                      {driver.vehicle.isVerified === "Verified" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 cursor-pointer"
                          onClick={handleRejectVehicle}
                        >
                          Reject
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:text-green-800 cursor-pointer"
                            onClick={handleVerifyVehicle}
                          >
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:text-red-800 cursor-pointer"
                            onClick={handleRejectVehicle}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {[
                  { label: "Model", value: driver.vehicle.model },
                  { label: "Type", value: driver.vehicle.type },
                  { label: "Class", value: driver.vehicle.class },
                  { label: "Fuel", value: driver.vehicle.fuelType },
                  { label: "Color", value: driver.vehicle.color },
                  { label: "Reg #", value: driver.vehicle.registrationNumber },
                  { label: "Seats", value: driver.vehicle.seatingCapacity },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {driver.vehicle.lastEditedByAdminId &&
                driver.vehicle.lastEditedAt && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <CheckCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Last edited by{" "}
                      <span className="font-medium text-foreground">
                        {lastEditedAdminName}{" "}
                      </span>
                      {/* todo: replace with actual admin name who edited the vehicle */}
                      {formatDate(driver.vehicle.lastEditedAt)}
                    </span>
                  </div>
                )}
              <div className="grid grid-cols-2 gap-3 mt-3">
                {driver.vehicle.rcImageKey && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">RC</p>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveImage(driver.vehicle.rcImageKey)}
                      className="w-full text-left focus:outline-none cursor-pointer p-0 h-auto block"
                    >
                      <img
                        src={driver.vehicle.rcImageKey}
                        alt="RC"
                        className="rounded-lg border border-border w-full h-28 object-cover hover:opacity-90 transition-opacity"
                      />
                    </Button>
                  </div>
                )}
                {driver.vehicle.insuranceImageKey && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Insurance
                    </p>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setActiveImage(driver.vehicle.insuranceImageKey)
                      }
                      className="w-full text-left focus:outline-none cursor-pointer p-0 h-auto block"
                    >
                      <img
                        src={driver.vehicle.insuranceImageKey}
                        alt="Insurance"
                        className="rounded-lg border border-border w-full h-28 object-cover hover:opacity-90 transition-opacity"
                      />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ratings */}
          {driver.ratings?.length > 0 && (
            <div className="card-glass p-5">
              <h3 className="font-semibold mb-3">Recent Ratings</h3>
              <div className="space-y-3">
                {driver.ratings.slice(0, 5).map((rating: any) => (
                  <div
                    key={rating._id}
                    className="flex items-start gap-3 border-b border-border last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center gap-0.5 shrink-0">
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
              {(driver.rideHistory?.length || 0) > 0 && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setRidesFilter("All");
                    setRidesPage(1);
                    setIsRidesDialogOpen(true);
                  }}
                  className="text-xs text-primary font-medium p-0 h-auto"
                >
                  View All ({driver.rideHistory?.length || 0})
                </Button>
              )}
            </div>
            {!driver.rideHistory || driver.rideHistory.length === 0 ? (
              <p className="text-muted-foreground text-sm">No rides yet</p>
            ) : (
              <div className="space-y-2">
                {driver.rideHistory?.slice(0, 3).map((ride: any) => (
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

      {/* Image lightbox */}
      <Dialog
        open={!!activeImage}
        onOpenChange={(open) => !open && setActiveImage(null)}
      >
        <DialogTitle />
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

      {/* Edit Driver Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Driver Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Personal Info Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Personal Information
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-firstName">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-firstName"
                    value={editForm.firstName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                    placeholder="First name"
                    className={
                      !editForm.firstName.trim() ? "border-red-400" : ""
                    }
                  />
                  {!editForm.firstName.trim() && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      First name is required
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input
                    id="edit-lastName"
                    value={editForm.lastName}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                    placeholder="Last name (optional)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-dob">Date of Birth</Label>
                  <Input
                    id="edit-dob"
                    type="date"
                    value={editForm.dob}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, dob: e.target.value }))
                    }
                    max={new Date().toISOString().split("T")[0]}
                  />
                  {editForm.dob &&
                    ageSettings &&
                    (() => {
                      const age = calculateAge(editForm.dob);
                      const minAge = ageSettings.minDriverAge;
                      const maxAge = ageSettings.maxDriverAge;

                      if (age < minAge) {
                        return (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠ Driver must be at least {minAge} years old.
                            Current age: {age}
                          </p>
                        );
                      }

                      if (maxAge && age > maxAge) {
                        return (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠ Driver must be at most {maxAge} years old. Current
                            age: {age}
                          </p>
                        );
                      }

                      return null;
                    })()}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.phoneNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        phoneNumber: e.target.value,
                      }))
                    }
                    placeholder="+91XXXXXXXXXX"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select
                    value={editForm.gender}
                    onValueChange={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        gender: v as "Male" | "Female" | "Other",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* License Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-border">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  License
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-licenseNumber">License Number</Label>
                  <Input
                    id="edit-licenseNumber"
                    value={editForm.licenseNumber}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        licenseNumber: e.target.value,
                      }))
                    }
                    placeholder="DL-XXXXXXXXXXXXXXX"
                  />
                  {editForm.licenseNumber.length > 0 &&
                    (editForm.licenseNumber.length < 14 ||
                      editForm.licenseNumber.length > 20) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠ License number should be between 14 and 20 characters
                      </p>
                    )}
                </div>
                <div className="space-y-1.5">
                  <Label>License Status</Label>
                  <Select
                    value={editForm.isLicenseVerified}
                    onValueChange={(v) =>
                      setEditForm((f) => ({
                        ...f,
                        isLicenseVerified: v as
                          | "Pending"
                          | "Verified"
                          | "Rejected",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Verified">Verified</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Vehicle Section — removed; use the Edit Vehicle dialog instead */}

            {/* Error */}
            {editError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {editError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
                disabled={editSaving}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="cursor-pointer gap-2"
              >
                {editSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog
        open={isVehicleEditDialogOpen}
        onOpenChange={setIsVehicleEditDialogOpen}
      >
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Car className="h-5 w-5 text-primary" />
              Edit Vehicle Details
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="vedit-model">Model</Label>
                <Input
                  id="vedit-model"
                  value={editVehicleForm.model}
                  onChange={(e) =>
                    setEditVehicleForm((f) => ({ ...f, model: e.target.value }))
                  }
                  placeholder="e.g. Maruti Swift"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vedit-regNumber">Registration #</Label>
                <Input
                  id="vedit-regNumber"
                  value={editVehicleForm.registrationNumber}
                  onChange={(e) =>
                    setEditVehicleForm((f) => ({
                      ...f,
                      registrationNumber: e.target.value,
                    }))
                  }
                  placeholder="JK-01-AB-1234"
                />
                {editVehicleForm.registrationNumber.length > 0 &&
                  editVehicleForm.registrationNumber.length < 10 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      ⚠ Registration number is typically at least 10 characters
                    </p>
                  )}
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Type</Label>
                <Select
                  value={editVehicleForm.type}
                  onValueChange={(v) =>
                    setEditVehicleForm((f) => ({
                      ...f,
                      type: v as
                        | "Hatchback"
                        | "Sedan"
                        | "Suv"
                        | "Auto"
                        | "Bike",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hatchback">Hatchback</SelectItem>
                    <SelectItem value="Sedan">Sedan</SelectItem>
                    <SelectItem value="Suv">SUV</SelectItem>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fuel Type</Label>
                <Select
                  value={editVehicleForm.fuelType}
                  onValueChange={(v) =>
                    setEditVehicleForm((f) => ({
                      ...f,
                      fuelType: v as "Petrol" | "Diesel" | "EV",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Petrol">Petrol</SelectItem>
                    <SelectItem value="Diesel">Diesel</SelectItem>
                    <SelectItem value="EV">EV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vehicle Class</Label>
                <Select
                  value={editVehicleForm.class}
                  onValueChange={(v) =>
                    setEditVehicleForm((f) => ({
                      ...f,
                      class: v as "Bike" | "Auto" | "Cab",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="Auto">Auto</SelectItem>
                    <SelectItem value="Cab">Cab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vedit-color">Color</Label>
                <Input
                  id="vedit-color"
                  value={editVehicleForm.color}
                  onChange={(e) =>
                    setEditVehicleForm((f) => ({ ...f, color: e.target.value }))
                  }
                  placeholder="e.g. White"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vedit-seats">Seating Capacity</Label>
                <Input
                  id="vedit-seats"
                  type="number"
                  min={1}
                  max={50}
                  value={editVehicleForm.seatingCapacity}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditVehicleForm((f) => ({
                      ...f,
                      seatingCapacity: val < 1 ? 1 : val > 50 ? 50 : val,
                    }));
                  }}
                />
                {editVehicleForm.seatingCapacity < 1 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Seating capacity must be at least 1
                  </p>
                )}
                {editVehicleForm.seatingCapacity > 50 && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Seating capacity must be at most 50
                  </p>
                )}
              </div>
            </div>

            {vehicleEditError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {vehicleEditError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setIsVehicleEditDialogOpen(false)}
                disabled={vehicleEditSaving}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveVehicleEdit}
                disabled={vehicleEditSaving}
                className="cursor-pointer gap-2"
              >
                {vehicleEditSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Save Vehicle
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
