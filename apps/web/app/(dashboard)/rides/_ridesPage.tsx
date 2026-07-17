"use client";

import { useState } from "react";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatCurrency, formatDistance } from "@/lib/utils";
import { Eye } from "lucide-react";
import { isAfter, startOfDay, subDays } from "date-fns";

export type Ride = {
  _id: string;
  _creationTime: number;
  status: string;
  requestStatus: string;
  fare: number;
  distance: number;
  requestedAt: number;
  pickup: { address: string };
  destination: { address: string };
  rider: {
    userDetails: {
      firstName: string;
      lastName?: string;
      phoneNumber: string;
    } | null;
  } | null;
  driver: {
    userDetails: {
      firstName: string;
      lastName?: string;
      phoneNumber: string;
    } | null;
  } | null;
};

export const columns: ColumnDef<Ride>[] = [
  {
    id: "rider",
    header: "Rider",
    accessorFn: (r) =>
      r.rider?.userDetails
        ? `${r.rider.userDetails.firstName} ${r.rider.userDetails.lastName ?? ""}`.trim()
        : "",
    cell: ({ row }) => {
      const rd = row.original.rider?.userDetails;
      return rd ? (
        <div>
          <p className="font-medium text-sm">
            {rd.firstName} {rd.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{rd.phoneNumber}</p>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  },
  {
    id: "driver",
    header: "Driver",
    accessorFn: (r) =>
      r.driver?.userDetails
        ? `${r.driver.userDetails.firstName} ${r.driver.userDetails.lastName ?? ""}`.trim()
        : "",
    cell: ({ row }) => {
      const dr = row.original.driver?.userDetails;
      return dr ? (
        <div>
          <p className="font-medium text-sm">
            {dr.firstName} {dr.lastName}
          </p>
          <p className="text-xs text-muted-foreground">{dr.phoneNumber}</p>
        </div>
      ) : (
        <span className="text-muted-foreground text-xs">—</span>
      );
    },
  },
  {
    id: "pickup",
    header: "Pickup",
    accessorFn: (r) => r.pickup.address,
    cell: ({ row }) => (
      <span className="text-sm max-w-[180px] truncate block">
        {row.original.pickup.address}
      </span>
    ),
  },
  {
    id: "destination",
    header: "Destination",
    accessorFn: (r) => r.destination.address,
    cell: ({ row }) => (
      <span className="text-sm max-w-[180px] truncate block">
        {row.original.destination.address}
      </span>
    ),
  },
  {
    id: "distance",
    header: "Distance",
    accessorFn: (r) => r.distance,
    cell: ({ row }) => (
      <span className="text-sm">{formatDistance(row.original.distance)}</span>
    ),
  },
  {
    id: "fare",
    header: "Fare",
    accessorFn: (r) => r.fare,
    cell: ({ row }) => (
      <span className="font-medium">{formatCurrency(row.original.fare)}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.status,
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: "date",
    header: "Date",
    accessorFn: (r) => r.requestedAt,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {formatDate(row.original.requestedAt)}
      </span>
    ),
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: () => <Eye className="h-4 w-4 text-muted-foreground" />,
  },
];

const filterFields = [
  {
    id: "status",
    label: "Status",
    options: [
      { label: "Open", value: "Open" },
      { label: "Active", value: "Active" },
      { label: "Driver Arrived", value: "Driver Arrived" },
      { label: "Completed", value: "Completed" },
      { label: "Canceled", value: "Canceled" },
      { label: "Abort", value: "Abort" },
    ],
  },
];

const DATE_FILTERS = ["All time", "Today", "Last 7 days", "Last 30 days"];

export function RidesPage({ initialRides }: { initialRides?: Ride[] }) {
  const router = useRouter();
  const [dateFilter, setDateFilter] = useState("All time");

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  const statusFilter = columnFilters.find((f) => f.id === "status")?.value;

  const liveRides = useAuthenticatedQuery(
    api.routes.admin.getAllRidesAdmin,
    {
      search: globalFilter || undefined,
      status:
        statusFilter && statusFilter.length > 0 ? statusFilter : undefined,
      dateFilter: dateFilter !== "All time" ? dateFilter : undefined,
    },
  ) as Ride[] | undefined;

  const rides =
    liveRides ??
    (globalFilter || columnFilters.length > 0 || dateFilter !== "All time"
      ? undefined
      : initialRides);

  const filterBar = (
    <select
      value={dateFilter}
      onChange={(e) => setDateFilter(e.target.value)}
      className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium text-muted-foreground focus:outline-none cursor-pointer hover:bg-muted/80"
    >
      {DATE_FILTERS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rides</h1>
        <p className="page-description">
          {rides !== undefined ? `${rides.length} total rides` : "Loading…"}
        </p>
      </div>
      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={rides ?? []}
          isLoading={rides === undefined}
          searchPlaceholder="Search rides…"
          filterBar={filterBar}
          filterFields={filterFields}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          onRowClick={(r) => router.push(`/rides/${r._id}`)}
          emptyTitle="No rides found"
          emptyDescription="Rides will appear here once booked"
        />
      </div>
    </div>
  );
}
