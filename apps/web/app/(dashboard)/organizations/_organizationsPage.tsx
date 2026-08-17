"use client";

import { useState, useEffect } from "react";
import { useAuthenticatedQuery, useAuthenticatedMutation } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Building2,
  Eye,
  Trash2,
  PlusCircle,
  Globe,
  Square,
  Hexagon,
  Shield,
  FileText,
  Image,
  User,
  Settings,
  Edit,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Import new shadcn UI components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type Organization = {
  _id: string;
  _creationTime: number;
  name: string;
  address: string;
  isLicenseVerficationRequired: boolean;
  isVehicleRCVerificationRequired: boolean;
  isVehicleInsuranceImageRequired: boolean;
  canDriverEditLicense: boolean;
  canDriverEditVehicle: boolean;
  polygon?: { latitude: number; longitude: number }[];
  boundingBox?: object;
  isSuspended?: boolean;
  suspendedReason?: string;
  suspendedAt?: number;
  suspendedByAdminId?: string;
};

let onEditOrganizationGlobal: ((org: Organization) => void) | null = null;
let onSuspendOrganizationGlobal: ((org: Organization) => void) | null = null;

export const columns: ColumnDef<Organization>[] = [
  {
    id: "name",
    header: "Name",
    accessorFn: (o) => o.name,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.original.address}
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "licenseRequired",
    header: "License Verify",
    accessorFn: (o) => (o.isLicenseVerficationRequired ? "Yes" : "No"),
    cell: ({ row }) => (
      <span
        className={`badge-status ${row.original.isLicenseVerficationRequired ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
      >
        {row.original.isLicenseVerficationRequired
          ? "Required"
          : "Not required"}
      </span>
    ),
  },
  {
    id: "rcRequired",
    header: "RC Verify",
    accessorFn: (o) => (o.isVehicleRCVerificationRequired ? "Yes" : "No"),
    cell: ({ row }) => (
      <span
        className={`badge-status ${row.original.isVehicleRCVerificationRequired ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
      >
        {row.original.isVehicleRCVerificationRequired
          ? "Required"
          : "Not required"}
      </span>
    ),
  },
  {
    id: "hasPolygon",
    header: "Service Area",
    accessorFn: (o) => (o.polygon ? "Defined" : "None"),
    cell: ({ row }) => (
      <span
        className={`badge-status ${row.original.polygon ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800"}`}
      >
        {row.original.polygon
          ? `${row.original.polygon.length} points`
          : "No polygon"}
      </span>
    ),
  },
  {
    id: "created",
    header: "Created",
    accessorFn: (o) => o._creationTime,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.original._creationTime)}
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (o) => (o.isSuspended ? "Suspended" : "Active"),
    cell: ({ row }) => (
      <span
        title={
          row.original.isSuspended && row.original.suspendedReason
            ? `Reason: ${row.original.suspendedReason}`
            : undefined
        }
        className={`badge-status ${
          row.original.isSuspended
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
        }`}
      >
        {row.original.isSuspended ? "Suspended" : "Active"}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => (
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 cursor-pointer ${
            row.original.isSuspended
              ? "text-green-600 hover:text-green-700 hover:bg-green-500/10"
              : "text-destructive hover:text-destructive hover:bg-destructive/10"
          }`}
          title={row.original.isSuspended ? "Unsuspend Organization" : "Suspend Organization"}
          onClick={() => {
            if (onSuspendOrganizationGlobal) {
              onSuspendOrganizationGlobal(row.original);
            }
          }}
        >
          <ShieldAlert className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
          title="Edit"
          onClick={() => {
            if (onEditOrganizationGlobal) {
              onEditOrganizationGlobal(row.original);
            }
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
          title="Open in new tab"
          onClick={() => {
            window.open(`/organizations/${row.original._id}`);
          }}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    ),
  },
];

const orgFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  isLicenseVerficationRequired: z.boolean(),
  isVehicleRCVerificationRequired: z.boolean(),
  isVehicleInsuranceImageRequired: z.boolean(),
  canDriverEditLicense: z.boolean(),
  canDriverEditVehicle: z.boolean(),
  noRestrictions: z.boolean(),
  northLat: z.string().optional(),
  northLng: z.string().optional(),
  southLat: z.string().optional(),
  southLng: z.string().optional(),
  eastLat: z.string().optional(),
  eastLng: z.string().optional(),
  westLat: z.string().optional(),
  westLng: z.string().optional(),
});

type OrgFormValues = z.infer<typeof orgFormSchema>;

const addRateSchema = z.object({
  vehicleClass: z.enum(["Bike", "Auto", "Cab"]),
  baseDistance: z.coerce.number().min(100, "Minimum 100 meters"),
  baseDistanceRate: z.coerce.number().min(0, "Must be positive"),
  ratePerKm: z.coerce.number().min(0, "Must be positive"),
  waitingPerMinute: z.coerce.number().min(0, "Must be positive"),
});

interface ConfigureRatesStepProps {
  orgId: string;
  orgName: string;
  onClose: () => void;
}

function ConfigureRatesStep({
  orgId,
  orgName,
  onClose,
}: ConfigureRatesStepProps) {
  const createRate = useAuthenticatedMutation(
    api.routes.organizations.createOrganizationRate,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rates = useAuthenticatedQuery(api.routes.organizations.getOrganizationRates, {
    organizationId: orgId as any,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof addRateSchema>>({
    resolver: zodResolver(addRateSchema),
    defaultValues: {
      vehicleClass: "Cab",
      baseDistance: 1000,
      baseDistanceRate: 50,
      ratePerKm: 15,
      waitingPerMinute: 2,
    },
  });

  const existingClasses = rates?.map((r) => r.vehicleClass) || [];
  const availableClasses = (["Bike", "Auto", "Cab"] as const).filter(
    (c) => !existingClasses.includes(c),
  );

  const onSubmit = async (data: z.infer<typeof addRateSchema>) => {
    setIsSubmitting(true);
    try {
      await createRate({
        organizationId: orgId as any,
        vehicleClass: data.vehicleClass,
        baseDistance: data.baseDistance,
        baseDistanceRate: data.baseDistanceRate,
        ratePerKm: data.ratePerKm,
        waitingPerMinute: data.waitingPerMinute,
      });
      toast.success(`${data.vehicleClass} rate added successfully!`);

      // Determine next available class
      const nextClasses = (["Bike", "Auto", "Cab"] as const).filter(
        (c) => c !== data.vehicleClass && !existingClasses.includes(c),
      );
      reset({
        vehicleClass: nextClasses[0] || "Cab",
        baseDistance: 1000,
        baseDistanceRate: 50,
        ratePerKm: 15,
        waitingPerMinute: 2,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add rate");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Configured Rates for {orgName}
        </h3>
        <div className="mt-2 border border-border rounded-xl p-3 bg-muted/10">
          {rates === undefined ? (
            <p className="text-xs text-muted-foreground">Loading rates...</p>
          ) : rates.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No rates configured yet. Add at least one rate below.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rates.map((rate) => (
                <div
                  key={rate._id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card text-xs"
                >
                  <div className="font-semibold text-primary">
                    {rate.vehicleClass}
                  </div>
                  <div className="text-muted-foreground text-[11px]">
                    Base: {rate.baseDistance}m (₹{rate.baseDistanceRate}) | ₹
                    {rate.ratePerKm}/km
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {availableClasses.length > 0 ? (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3 border-t border-border pt-4"
        >
          <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">
            Add Vehicle Rate
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="vehicleClass">Vehicle Class</Label>
              <select
                id="vehicleClass"
                {...register("vehicleClass")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1"
              >
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="baseDistance">Base Distance (meters)</Label>
              <Input
                id="baseDistance"
                type="number"
                {...register("baseDistance")}
                className="mt-1"
              />
              {errors.baseDistance && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.baseDistance.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="baseDistanceRate">Base Fare (₹)</Label>
              <Input
                id="baseDistanceRate"
                type="number"
                {...register("baseDistanceRate")}
                className="mt-1"
              />
              {errors.baseDistanceRate && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.baseDistanceRate.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="ratePerKm">Rate per Km (₹)</Label>
              <Input
                id="ratePerKm"
                type="number"
                {...register("ratePerKm")}
                className="mt-1"
              />
              {errors.ratePerKm && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.ratePerKm.message}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="waitingPerMinute">
                Waiting Charge per Minute (₹)
              </Label>
              <Input
                id="waitingPerMinute"
                type="number"
                {...register("waitingPerMinute")}
                className="mt-1"
              />
              {errors.waitingPerMinute && (
                <p className="text-destructive text-[11px] mt-1">
                  {errors.waitingPerMinute.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Skip / Finish
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Rate"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4 pt-2">
          <div className="bg-green-500/10 text-green-600 border border-green-500/20 rounded-lg p-3 text-sm text-center">
            All vehicle class rates are fully configured!
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose} className="w-full">
              Finish
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface OrgModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgToEdit?: Organization;
}

export function OrgModal({ open, onOpenChange, orgToEdit }: OrgModalProps) {
  const createOrg = useAuthenticatedMutation(api.routes.organizations.createOrganization);
  const updateOrg = useAuthenticatedMutation(api.routes.organizations.updateOrganization);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [createdOrg, setCreatedOrg] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [activeGeofenceTab, setActiveGeofenceTab] = useState<
    "boundingBox" | "polygon"
  >("boundingBox");

  // Manage Polygon Points
  const [polygonPoints, setPolygonPoints] = useState<
    { latitude: string; longitude: string }[]
  >([
    { latitude: "", longitude: "" },
    { latitude: "", longitude: "" },
    { latitude: "", longitude: "" },
  ]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema),
    defaultValues: {
      noRestrictions: false,
      isLicenseVerficationRequired: true,
      isVehicleRCVerificationRequired: true,
      isVehicleInsuranceImageRequired: false,
      canDriverEditLicense: false,
      canDriverEditVehicle: false,
    },
  });

  const noRestrictions = watch("noRestrictions");

  // Reset form values dynamically when modal state or orgToEdit changes
  useEffect(() => {
    if (open) {
      if (orgToEdit) {
        reset({
          name: orgToEdit.name,
          address: orgToEdit.address,
          isLicenseVerficationRequired: orgToEdit.isLicenseVerficationRequired,
          isVehicleRCVerificationRequired:
            orgToEdit.isVehicleRCVerificationRequired,
          isVehicleInsuranceImageRequired:
            orgToEdit.isVehicleInsuranceImageRequired,
          canDriverEditLicense: orgToEdit.canDriverEditLicense,
          canDriverEditVehicle: orgToEdit.canDriverEditVehicle,
          noRestrictions: !orgToEdit.polygon && !orgToEdit.boundingBox,
          northLat:
            (orgToEdit.boundingBox as any)?.north?.latitude?.toString() ?? "",
          northLng:
            (orgToEdit.boundingBox as any)?.north?.longitude?.toString() ?? "",
          southLat:
            (orgToEdit.boundingBox as any)?.south?.latitude?.toString() ?? "",
          southLng:
            (orgToEdit.boundingBox as any)?.south?.longitude?.toString() ?? "",
          eastLat:
            (orgToEdit.boundingBox as any)?.east?.latitude?.toString() ?? "",
          eastLng:
            (orgToEdit.boundingBox as any)?.east?.longitude?.toString() ?? "",
          westLat:
            (orgToEdit.boundingBox as any)?.west?.latitude?.toString() ?? "",
          westLng:
            (orgToEdit.boundingBox as any)?.west?.longitude?.toString() ?? "",
        });
        if (orgToEdit.polygon && orgToEdit.polygon.length > 0) {
          setPolygonPoints(
            orgToEdit.polygon.map((p) => ({
              latitude: p.latitude.toString(),
              longitude: p.longitude.toString(),
            })),
          );
          setActiveGeofenceTab("polygon");
        } else {
          setPolygonPoints([
            { latitude: "", longitude: "" },
            { latitude: "", longitude: "" },
            { latitude: "", longitude: "" },
          ]);
          setActiveGeofenceTab("boundingBox");
        }
      } else {
        reset({
          name: "",
          address: "",
          isLicenseVerficationRequired: true,
          isVehicleRCVerificationRequired: true,
          isVehicleInsuranceImageRequired: false,
          canDriverEditLicense: false,
          canDriverEditVehicle: false,
          noRestrictions: false,
          northLat: "",
          northLng: "",
          southLat: "",
          southLng: "",
          eastLat: "",
          eastLng: "",
          westLat: "",
          westLng: "",
        });
        setPolygonPoints([
          { latitude: "", longitude: "" },
          { latitude: "", longitude: "" },
          { latitude: "", longitude: "" },
        ]);
        setActiveGeofenceTab("boundingBox");
      }
    }
  }, [open, orgToEdit, reset]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setCreatedOrg(null);
      setPolygonPoints([
        { latitude: "", longitude: "" },
        { latitude: "", longitude: "" },
        { latitude: "", longitude: "" },
      ]);
      reset();
    }
    onOpenChange(isOpen);
  };

  const updatePolygonPoint = (
    index: number,
    field: "latitude" | "longitude",
    value: string,
  ) => {
    const updated = [...polygonPoints];
    updated[index][field] = value;
    setPolygonPoints(updated);
  };

  const addPolygonPoint = () => {
    setPolygonPoints([...polygonPoints, { latitude: "", longitude: "" }]);
  };

  const removePolygonPoint = (index: number) => {
    if (polygonPoints.length <= 3) {
      toast.error("A polygon must have at least 3 points");
      return;
    }
    setPolygonPoints(polygonPoints.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: OrgFormValues) => {
    setIsSubmitting(true);
    try {
      let polygon: { latitude: number; longitude: number }[] | undefined =
        undefined;
      let boundingBox: any = undefined;

      if (!data.noRestrictions) {
        if (activeGeofenceTab === "boundingBox") {
          // Bounding Box Validation
          const bbKeys = [
            "northLat",
            "northLng",
            "southLat",
            "southLng",
            "eastLat",
            "eastLng",
            "westLat",
            "westLng",
          ] as const;
          const hasBBValue = bbKeys.some((k) => {
            const val = data[k];
            return typeof val === "string" && val.trim() !== "";
          });
          if (hasBBValue) {
            for (const k of bbKeys) {
              const val = data[k];
              if (
                typeof val !== "string" ||
                val.trim() === "" ||
                isNaN(parseFloat(val))
              ) {
                toast.error(
                  `Please provide valid coordinates for Bounding Box ${k.replace("Lat", " Latitude").replace("Lng", " Longitude")}`,
                );
                setIsSubmitting(false);
                return;
              }
            }

            boundingBox = {
              north: {
                latitude: parseFloat(data.northLat || "0"),
                longitude: parseFloat(data.northLng || "0"),
              },
              south: {
                latitude: parseFloat(data.southLat || "0"),
                longitude: parseFloat(data.southLng || "0"),
              },
              east: {
                latitude: parseFloat(data.eastLat || "0"),
                longitude: parseFloat(data.eastLng || "0"),
              },
              west: {
                latitude: parseFloat(data.westLat || "0"),
                longitude: parseFloat(data.westLng || "0"),
              },
            };
          }
        } else if (activeGeofenceTab === "polygon") {
          // Polygon Validation
          const hasPolygonValue = polygonPoints.some(
            (pt) => pt.latitude.trim() !== "" || pt.longitude.trim() !== "",
          );
          if (hasPolygonValue) {
            if (polygonPoints.length < 3) {
              toast.error("A polygon must have at least 3 points");
              setIsSubmitting(false);
              return;
            }

            const parsed = polygonPoints.map((p) => ({
              latitude: parseFloat(p.latitude),
              longitude: parseFloat(p.longitude),
            }));

            if (
              parsed.some((pt) => isNaN(pt.latitude) || isNaN(pt.longitude))
            ) {
              toast.error(
                "Please fill in valid coordinate numbers for the polygon",
              );
              setIsSubmitting(false);
              return;
            }

            polygon = parsed;
          }
        }
      }

      if (orgToEdit) {
        await updateOrg({
          id: orgToEdit._id as any,
          name: data.name,
          address: data.address,
          isLicenseVerficationRequired: data.isLicenseVerficationRequired,
          isVehicleRCVerificationRequired: data.isVehicleRCVerificationRequired,
          isVehicleInsuranceImageRequired: data.isVehicleInsuranceImageRequired,
          canDriverEditLicense: data.canDriverEditLicense,
          canDriverEditVehicle: data.canDriverEditVehicle,
          polygon,
          boundingBox,
        });

        toast.success("Organization updated successfully!");
        onOpenChange(false);
      } else {
        const orgId = await createOrg({
          name: data.name,
          address: data.address,
          isLicenseVerficationRequired: data.isLicenseVerficationRequired,
          isVehicleRCVerificationRequired: data.isVehicleRCVerificationRequired,
          isVehicleInsuranceImageRequired: data.isVehicleInsuranceImageRequired,
          canDriverEditLicense: data.canDriverEditLicense,
          canDriverEditVehicle: data.canDriverEditVehicle,
          polygon,
          boundingBox,
        });

        toast.success("Organization created");
        setCreatedOrg({ id: orgId, name: data.name });
        setStep(2);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save organization",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const rules = [
    {
      id: "isLicenseVerficationRequired",
      title: "Require License Verification",
      description: "Drivers must verify their license to operate.",
      icon: Shield,
      iconColor: "text-blue-500 bg-blue-500/10",
    },
    {
      id: "isVehicleRCVerificationRequired",
      title: "Require Vehicle RC Verification",
      description: "Drivers must submit valid RC documents.",
      icon: FileText,
      iconColor: "text-amber-500 bg-amber-500/10",
    },
    {
      id: "isVehicleInsuranceImageRequired",
      title: "Require Vehicle Insurance",
      description: "Vehicle insurance images are mandatory.",
      icon: Image,
      iconColor: "text-emerald-500 bg-emerald-500/10",
    },
    {
      id: "canDriverEditLicense",
      title: "Driver Can Edit License",
      description: "Allow drivers to update license details directly.",
      icon: User,
      iconColor: "text-indigo-500 bg-indigo-500/10",
    },
    {
      id: "canDriverEditVehicle",
      title: "Driver Can Edit Vehicle",
      description: "Allow drivers to update vehicle details directly.",
      icon: Settings,
      iconColor: "text-rose-500 bg-rose-500/10",
    },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          step === 1
            ? "sm:max-w-5xl max-h-[90vh] overflow-y-auto"
            : "sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>
            {step === 1
              ? orgToEdit
                ? "Edit Organization"
                : "Create Organization"
              : "Configure Organization Rates"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? orgToEdit
                ? "Modify details, settings, and geofencing configuration for the organization."
                : "Provide details, settings, and geofencing configuration for the new organization."
              : `Configure pricing rates for ${createdOrg?.name} to complete setup.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Info & Settings */}
              <div className="space-y-4">
                {/* General Information Card */}
                <div className="bg-card border border-border rounded-xl p-4.5 space-y-4 text-left">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <Building2 className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-sm text-foreground">
                      Organization Details
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3.5 text-left">
                    <div className="space-y-1.5 text-left">
                      <Label
                        htmlFor="name"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Name
                      </Label>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="Organization name"
                        className="bg-muted/5 border-border focus-visible:ring-primary h-10 mt-1"
                      />
                      {errors.name && (
                        <p className="text-destructive text-[11px] font-medium mt-1">
                          {errors.name.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5 text-left">
                      <Label
                        htmlFor="address"
                        className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      >
                        Address
                      </Label>
                      <Input
                        id="address"
                        {...register("address")}
                        placeholder="Organization address"
                        className="bg-muted/5 border-border focus-visible:ring-primary h-10 mt-1"
                      />
                      {errors.address && (
                        <p className="text-destructive text-[11px] font-medium mt-1">
                          {errors.address.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rules & Verification Card */}
                <div className="bg-card border border-border rounded-xl p-4.5 space-y-4 text-left">
                  <div className="flex items-center gap-2 border-b border-border pb-2.5">
                    <Shield className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-sm text-foreground">
                      Rules & Verifications
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    {rules.map((rule) => {
                      const Icon = rule.icon;
                      const checked = watch(rule.id as any);
                      return (
                        <label
                          key={rule.id}
                          htmlFor={rule.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-all duration-200 cursor-pointer select-none ${
                            checked
                              ? "border-primary/30 bg-primary/[0.02]"
                              : "border-border hover:bg-muted/10 bg-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${rule.iconColor}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <p className="text-xs font-semibold text-foreground">
                                {rule.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                                {rule.description}
                              </p>
                            </div>
                          </div>
                          <Checkbox
                            id={rule.id}
                            checked={checked === true}
                            onCheckedChange={(checked) => {
                              setValue(rule.id as any, checked === true);
                            }}
                            className="h-4.5 w-4.5 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Geofencing */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 text-left">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider text-left mb-2">
                  Geofencing & Service Area
                </h3>

                <div className="space-y-4">
                  {/* Global Operations Check Card */}
                  <div
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      noRestrictions
                        ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                        : "border-border bg-card"
                    }`}
                  >
                    <label
                      htmlFor="noRestrictions"
                      className="flex items-start gap-3 cursor-pointer select-none"
                    >
                      <div
                        className={`p-2.5 rounded-lg flex items-center justify-center shrink-0 ${noRestrictions ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                      >
                        <Globe className="h-5 w-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="text-sm font-semibold text-foreground">
                          No Boundary Restrictions
                        </h4>
                        <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                          Disable geographic geofencing and allow operations
                          globally.
                        </p>
                      </div>
                      <Checkbox
                        id="noRestrictions"
                        checked={noRestrictions === true}
                        onCheckedChange={(checked) => {
                          setValue("noRestrictions", checked === true);
                        }}
                        className="h-5 w-5 mt-1 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div
                    className={`space-y-4 transition-all duration-300 ${noRestrictions ? "opacity-40 pointer-events-none select-none" : ""}`}
                  >
                    {/* Tabs Header */}
                    <div className="grid grid-cols-2 p-1 bg-muted rounded-lg border border-border">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setActiveGeofenceTab("boundingBox")}
                        disabled={noRestrictions}
                        className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          activeGeofenceTab === "boundingBox"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Square className="h-3.5 w-3.5" />
                        Bounding Box
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setActiveGeofenceTab("polygon")}
                        disabled={noRestrictions}
                        className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                          activeGeofenceTab === "polygon"
                            ? "bg-card text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Hexagon className="h-3.5 w-3.5" />
                        Polygon Area
                      </Button>
                    </div>

                    {/* Bounding Box Inputs */}
                    {activeGeofenceTab === "boundingBox" && (
                      <div className="space-y-4 bg-card border border-border rounded-xl p-4.5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-start gap-2.5 text-left">
                          <div className="bg-primary/10 text-primary p-1.5 rounded">
                            <Square className="h-4 w-4" />
                          </div>
                          <div className="text-left">
                            <h5 className="text-xs font-bold text-foreground">
                              Bounding Box Coordinates
                            </h5>
                            <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                              Define boundary limits in decimal degrees (e.g.
                              34.0837).
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3">
                          {[
                            { key: "north", label: "North Boundary Point" },
                            { key: "south", label: "South Boundary Point" },
                            { key: "east", label: "East Boundary Point" },
                            { key: "west", label: "West Boundary Point" },
                          ].map(({ key, label }) => (
                            <div
                              key={key}
                              className="flex flex-col gap-2 border border-border/60 bg-muted/5 p-2.5 px-3 rounded-lg text-left"
                            >
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                {label}
                              </span>
                              <div className="flex gap-3">
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                    Lat:
                                  </span>
                                  <Input
                                    placeholder="Lat"
                                    {...register(`${key}Lat` as any)}
                                    type="text"
                                    className="h-8 text-xs bg-card"
                                    disabled={noRestrictions}
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                                    Lng:
                                  </span>
                                  <Input
                                    placeholder="Lng"
                                    {...register(`${key}Lng` as any)}
                                    type="text"
                                    className="h-8 text-xs bg-card"
                                    disabled={noRestrictions}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Polygon Inputs */}
                    {activeGeofenceTab === "polygon" && (
                      <div className="space-y-4 bg-card border border-border rounded-xl p-4.5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center border-b border-border pb-2.5 text-left">
                          <div className="flex items-start gap-2.5">
                            <div className="bg-primary/10 text-primary p-1.5 rounded">
                              <Hexagon className="h-4 w-4" />
                            </div>
                            <div className="text-left">
                              <h5 className="text-xs font-bold text-foreground">
                                Polygon Corner Points
                              </h5>
                              <p className="text-[10px] text-muted-foreground leading-normal mt-0.5">
                                Custom perimeter vertices (min. 3 points).
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 text-xs flex items-center gap-1.5 cursor-pointer"
                            onClick={addPolygonPoint}
                            disabled={noRestrictions}
                          >
                            <PlusCircle className="h-3.5 w-3.5" /> Add Point
                          </Button>
                        </div>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {polygonPoints.map((pt, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-muted/10"
                            >
                              <span className="text-[10px] font-bold text-muted-foreground w-6 text-center">
                                #{index + 1}
                              </span>
                              <div className="grid grid-cols-2 gap-2 flex-1">
                                <Input
                                  placeholder="Latitude"
                                  value={pt.latitude}
                                  onChange={(e) =>
                                    updatePolygonPoint(
                                      index,
                                      "latitude",
                                      e.target.value,
                                    )
                                  }
                                  className="h-8.5 text-xs bg-card"
                                  type="text"
                                  disabled={noRestrictions}
                                />
                                <Input
                                  placeholder="Longitude"
                                  value={pt.longitude}
                                  onChange={(e) =>
                                    updatePolygonPoint(
                                      index,
                                      "longitude",
                                      e.target.value,
                                    )
                                  }
                                  className="h-8.5 text-xs bg-card"
                                  type="text"
                                  disabled={noRestrictions}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0 cursor-pointer"
                                onClick={() => removePolygonPoint(index)}
                                disabled={
                                  noRestrictions || polygonPoints.length <= 3
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? orgToEdit
                    ? "Saving..."
                    : "Creating..."
                  : orgToEdit
                    ? "Save Changes"
                    : "Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          createdOrg && (
            <ConfigureRatesStep
              orgId={createdOrg.id}
              orgName={createdOrg.name}
              onClose={() => handleOpenChange(false)}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface SuspendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: Organization | null;
}

export function SuspendModal({ open, onOpenChange, org }: SuspendModalProps) {
  const toggleSuspend = useAuthenticatedMutation(
    api.routes.organizations.toggleSuspendOrganization,
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  if (!org) return null;

  const isSuspended = org.isSuspended === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error(`Please provide a reason to ${isSuspended ? "unsuspend" : "suspend"} the organization`);
      return;
    }

    setIsSubmitting(true);
    try {
      await toggleSuspend({
        id: org._id as any,
        reason: reason.trim(),
      });
      toast.success(
        `Organization ${org.name} has been ${isSuspended ? "unsuspended" : "suspended"}`
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update organization status"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className={`h-5 w-5 ${isSuspended ? "text-green-500" : "text-destructive"}`} />
            {isSuspended ? "Unsuspend Organization" : "Suspend Organization"}
          </DialogTitle>
          <DialogDescription>
            {isSuspended
              ? `Are you sure you want to unsuspend "${org.name}"? This will reactivate drivers under this organization.`
              : `Are you sure you want to suspend "${org.name}"? Drivers belonging to this organization will be ignored in search and cannot receive ride requests.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="suspendReason" className="text-xs font-semibold text-foreground">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Input
              id="suspendReason"
              placeholder={`Enter reason to ${isSuspended ? "unsuspend" : "suspend"} organization...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-background"
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={isSuspended ? "default" : "destructive"}
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting
                ? isSuspended
                  ? "Unsuspending..."
                  : "Suspending..."
                : isSuspended
                  ? "Unsuspend Organization"
                  : "Suspend Organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const filterFields = [
  {
    id: "status",
    label: "Status",
    options: [
      { label: "Active", value: "Active" },
      { label: "Suspended", value: "Suspended" },
    ],
  },
  {
    id: "licenseRequired",
    label: "License Verification",
    options: [
      { label: "Required", value: "Yes" },
      { label: "Not required", value: "No" },
    ],
  },
  {
    id: "rcRequired",
    label: "RC Verification",
    options: [
      { label: "Required", value: "Yes" },
      { label: "Not required", value: "No" },
    ],
  },
  {
    id: "hasPolygon",
    label: "Service Area",
    options: [
      { label: "Defined", value: "Defined" },
      { label: "None", value: "None" },
    ],
  },
];

export function OrganizationsPage({
  initialOrganizations,
}: {
  initialOrganizations?: Organization[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<Organization | undefined>(
    undefined,
  );
  const [showSuspend, setShowSuspend] = useState(false);
  const [orgToSuspend, setOrgToSuspend] = useState<Organization | null>(null);

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  useEffect(() => {
    onEditOrganizationGlobal = (org) => {
      setOrgToEdit(org);
      setShowEdit(true);
    };
    onSuspendOrganizationGlobal = (org) => {
      setOrgToSuspend(org);
      setShowSuspend(true);
    };
    return () => {
      onEditOrganizationGlobal = null;
      onSuspendOrganizationGlobal = null;
    };
  }, []);

  const statusFilter = columnFilters.find((f) => f.id === "status")?.value;
  const licenseFilter = columnFilters.find((f) => f.id === "licenseRequired")?.value;
  const rcFilter = columnFilters.find((f) => f.id === "rcRequired")?.value;
  const polyFilter = columnFilters.find((f) => f.id === "hasPolygon")?.value;

  const liveOrganizations = useAuthenticatedQuery(
    api.routes.organizations.getAllOrganizations,
    {
      search: globalFilter || undefined,
      status: statusFilter && statusFilter.length > 0 ? statusFilter : undefined,
      licenseRequired: licenseFilter && licenseFilter.length > 0 ? licenseFilter : undefined,
      rcRequired: rcFilter && rcFilter.length > 0 ? rcFilter : undefined,
      hasPolygon: polyFilter && polyFilter.length > 0 ? polyFilter : undefined,
    }
  ) as Organization[] | undefined;

  const organizations = liveOrganizations ?? (globalFilter || columnFilters.length > 0 ? undefined : initialOrganizations);

  return (
    <div>
      <OrgModal open={showCreate} onOpenChange={setShowCreate} />
      <OrgModal
        open={showEdit}
        onOpenChange={(open) => {
          setShowEdit(open);
          if (!open) setOrgToEdit(undefined);
        }}
        orgToEdit={orgToEdit}
      />
      <SuspendModal
        open={showSuspend}
        onOpenChange={(open) => {
          setShowSuspend(open);
          if (!open) setOrgToSuspend(null);
        }}
        org={orgToSuspend}
      />

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-description">
            {organizations !== undefined
              ? `${organizations.length} organizations`
              : "Loading…"}
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </Button>
      </div>

      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={organizations ?? []}
          isLoading={organizations === undefined}
          searchPlaceholder="Search organizations…"
          filterFields={filterFields}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          onRowClick={(o) => router.push(`/organizations/${o._id}`)}
          emptyTitle="No organizations"
          emptyDescription="Create your first organization to get started"
        />
      </div>
    </div>
  );
}
