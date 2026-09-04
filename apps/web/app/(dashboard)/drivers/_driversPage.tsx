"use client";

import { useState } from "react";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge, OnlineBadge } from "@/components/ui/badge";
import { formatDate, getInitials } from "@/lib/utils";
import { Star, Eye, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Driver = {
  _id: string;
  _creationTime: number;
  isOnline: boolean;
  isAvailableForRide: boolean;
  isVerified: "Unverified" | "Verified" | "Rejected";
  genderMatching: boolean;
  userDetails: {
    firstName: string;
    lastName?: string;
    phoneNumber: string;
    gender: string;
    dob: string;
    profilePictureKey?: string;
  };
  vehicle: {
    model: string;
    class: string;
    registrationNumber: string;
  } | null;
  averageRating: number | null;
  totalRatings: number;
};

export const columns: ColumnDef<Driver>[] = [
  {
    id: "avatar",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const d = row.original;
      const name =
        `${d.userDetails.firstName} ${d.userDetails.lastName ?? ""}`.trim();
      return (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
          {d.userDetails.profilePictureKey ? (
            <img
              src={d.userDetails.profilePictureKey}
              alt={name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(d.userDetails.firstName, d.userDetails.lastName)
          )}
        </div>
      );
    },
  },
  {
    id: "name",
    header: "Name",
    accessorFn: (d) =>
      `${d.userDetails.firstName} ${d.userDetails.lastName ?? ""}`.trim(),
    cell: ({ row }) => {
      const d = row.original;
      return (
        <div>
          <p className="font-medium">
            {d.userDetails.firstName} {d.userDetails.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {d.userDetails.phoneNumber}
          </p>
        </div>
      );
    },
  },
  {
    id: "vehicle",
    header: "Vehicle",
    accessorFn: (d) => d.vehicle?.model,
    cell: ({ row }) => {
      const d = row.original;
      return d.vehicle ? (
        <div>
          <p className="font-medium">{d.vehicle.model}</p>
          <p className="text-xs text-muted-foreground">
            {d.vehicle.registrationNumber} • {d.vehicle.class}
          </p>
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">No vehicle</span>
      );
    },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (d) => d.isVerified,
    cell: ({ row }) => <StatusBadge status={row.original.isVerified} />,
    filterFn: "equals",
  },
  {
    id: "online",
    header: "Online",
    accessorFn: (d) => (d.isOnline ? "Online" : "Offline"),
    cell: ({ row }) => <OnlineBadge isOnline={row.original.isOnline} />,
    filterFn: "equals",
  },
  {
    id: "rating",
    header: "Rating",
    accessorFn: (d) => d.averageRating ?? 0,
    cell: ({ row }) => {
      const d = row.original;
      return d.averageRating !== null ? (
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{d.averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">
            ({d.totalRatings})
          </span>
        </span>
      ) : (
        <span className="text-muted-foreground text-xs">No ratings</span>
      );
    },
  },
  {
    id: "createdAt",
    header: "Joined",
    accessorFn: (d) => d._creationTime,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.original._creationTime)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: () => (
      <Eye className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    ),
  },
];

const filterFields = [
  {
    id: "online",
    label: "Availability",
    options: [
      { label: "Online", value: "Online" },
      { label: "Offline", value: "Offline" },
    ],
  },
  {
    id: "license",
    label: "Verification",
    options: [
      { label: "Unverified", value: "Unverified" },
      { label: "Verified", value: "Verified" },
      { label: "Rejected", value: "Rejected" },
    ],
  },
];

export function DriversPage({
  initialDrivers,
  organizationFilter,
}: {
  initialDrivers?: Driver[];
  organizationFilter?: string;
}) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  const onlineFilter = columnFilters.find((f) => f.id === "online")?.value;
  const licenseFilter = columnFilters.find((f) => f.id === "license")?.value;

  const liveDrivers = useAuthenticatedQuery(
    api.routes.admin.getAllDrivers,
    {
      search: globalFilter || undefined,
      online: onlineFilter && onlineFilter.length > 0 ? onlineFilter : undefined,
      license: licenseFilter && licenseFilter.length > 0 ? licenseFilter : undefined,
    },
  ) as Driver[] | undefined;

  const allDrivers = liveDrivers ?? (globalFilter || columnFilters.length > 0 ? undefined : initialDrivers);

  // Apply organization filter if present
  const drivers = organizationFilter
    ? allDrivers?.filter((d: any) => d.organizationId === organizationFilter)
    : allDrivers;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Drivers</h1>
        <p className="page-description">
          {drivers !== undefined
            ? `${drivers.length} total • ${drivers.filter((d) => d.isOnline).length} online`
            : "Loading…"}
        </p>
      </div>

      {organizationFilter && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm">
          <Building2 className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-orange-700 dark:text-orange-300 font-medium">
            Filtered by organization
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-orange-600 hover:text-orange-800 hover:bg-orange-500/20"
            onClick={() => router.push("/drivers")}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Clear filter
          </Button>
        </div>
      )}

      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={drivers ?? []}
          isLoading={drivers === undefined}
          searchPlaceholder="Search drivers…"
          filterFields={filterFields}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          onRowClick={(d) => router.push(`/drivers/${d._id}`)}
          emptyTitle="No drivers found"
          emptyDescription="Drivers will appear here once they register"
        />
      </div>
    </div>
  );
}
