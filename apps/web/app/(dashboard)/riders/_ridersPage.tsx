"use client";

import { useState } from "react";

import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTimeAgo, getInitials } from "@/lib/utils";
import { Star, Eye } from "lucide-react";

export type Rider = {
  _id: string;
  _creationTime: number;
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
  averageRating: number | null;
  totalRatings: number;
};

export const columns: ColumnDef<Rider>[] = [
  {
    id: "avatar",
    header: "",
    enableSorting: false,
    cell: ({ row }) => {
      const r = row.original;
      const name =
        `${r.userDetails.firstName} ${r.userDetails.lastName ?? ""}`.trim();
      return (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
          {r.userDetails.profilePictureKey ? (
            <img
              src={r.userDetails.profilePictureKey}
              alt={name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            getInitials(r.userDetails.firstName, r.userDetails.lastName)
          )}
        </div>
      );
    },
  },
  {
    id: "name",
    header: "Name",
    accessorFn: (r) =>
      `${r.userDetails.firstName} ${r.userDetails.lastName ?? ""}`.trim(),
    cell: ({ row }) => {
      const r = row.original;
      return (
        <div>
          <p className="font-medium">
            {r.userDetails.firstName} {r.userDetails.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.userDetails.phoneNumber}
          </p>
        </div>
      );
    },
  },
  {
    id: "gender",
    header: "Gender",
    accessorFn: (r) => r.userDetails.gender,
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (r) => r.isVerified,
    cell: ({ row }) => <StatusBadge status={row.original.isVerified} />,
    filterFn: "equals",
  },
  {
    id: "rating",
    header: "Rating",
    accessorFn: (r) => r.averageRating ?? 0,
    cell: ({ row }) => {
      const r = row.original;
      return r.averageRating !== null ? (
        <span className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{r.averageRating.toFixed(1)}</span>
          <span className="text-muted-foreground text-xs">
            ({r.totalRatings})
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
    accessorFn: (r) => r._creationTime,
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
    id: "status",
    label: "Status",
    options: [
      { label: "Unverified", value: "Unverified" },
      { label: "Verified", value: "Verified" },
      { label: "Rejected", value: "Rejected" },
    ],
  },
  {
    id: "gender",
    label: "Gender",
    options: [
      { label: "Male", value: "Male" },
      { label: "Female", value: "Female" },
      { label: "Other", value: "Other" },
    ],
  },
];

export function RidersPage({
  initialRiders,
}: {
  initialRiders?: Rider[];
}) {
  const router = useRouter();

  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<any[]>([]);

  const genderFilter = columnFilters.find((f) => f.id === "gender")?.value;

  const liveRiders = useAuthenticatedQuery(
    api.routes.admin.getAllRiders,
    {
      search: globalFilter || undefined,
      gender: genderFilter && genderFilter.length > 0 ? genderFilter : undefined,
    },
  ) as Rider[] | undefined;

  const riders = liveRiders ?? (globalFilter || columnFilters.length > 0 ? undefined : initialRiders);

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Riders</h1>
          <p className="page-description">
            {riders !== undefined
              ? `${riders.length} total riders`
              : "Loading..."}
          </p>
        </div>
      </div>

      <div className="card-glass p-4">
        <DataTable
          columns={columns}
          data={riders ?? []}
          isLoading={riders === undefined}
          searchPlaceholder="Search riders…"
          filterFields={filterFields}
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          onRowClick={(r) => router.push(`/riders/${r._id}`)}
          emptyTitle="No riders found"
          emptyDescription="Riders will appear here once they register"
        />
      </div>
    </div>
  );
}
