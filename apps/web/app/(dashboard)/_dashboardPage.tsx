"use client";

import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { StatCard } from "./_statCard";
import { RidesChart } from "./_ridesChart";
import { RegistrationChart } from "./_registrationChart";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { columns as riderColumns } from "./riders/_ridersPage";
import { columns as driverColumns } from "./drivers/_driversPage";
import { columns as rideColumns } from "./rides/_ridesPage";
import { columns as orgColumns } from "./organizations/_organizationsPage";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users,
  Car,
  Building2,
  Route,
  CheckCircle,
  XCircle,
  TrendingUp,
  Wifi,
  Clock,
  Activity,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export function DashboardPage({
  initialRiders,
  initialDrivers,
  initialOrganizations,
  initialRides,
}: {
  initialRiders?: any[];
  initialDrivers?: any[];
  initialOrganizations?: any[];
  initialRides?: any[];
}) {
  const router = useRouter();

  const [selectedCard, setSelectedCard] = useState<{
    title: string;
    type: "rider" | "driver" | "ride" | "organization";
    data: any[];
    columns: any[];
    filterFields?: any[];
  } | null>(null);

  const liveRiders = useAuthenticatedQuery(api.routes.admin.getAllRiders);

  const liveDrivers = useAuthenticatedQuery(api.routes.admin.getAllDrivers);

  const liveOrganizations = useAuthenticatedQuery(
    api.routes.organizations.getAllOrganizations,
  );

  const liveRides = useAuthenticatedQuery(api.routes.admin.getAllRidesAdmin);

  const riders = liveRiders ?? initialRiders;
  const drivers = liveDrivers ?? initialDrivers;
  const organizations = liveOrganizations ?? initialOrganizations;
  const rides = liveRides ?? initialRides;

  const isLoading =
    riders === undefined ||
    drivers === undefined ||
    organizations === undefined;

  // Compute stats
  const totalRiders = riders?.length ?? 0;
  const totalDrivers = drivers?.length ?? 0;
  const onlineDrivers = drivers?.filter((d: any) => d.isOnline).length ?? 0;
  const availableDrivers =
    drivers?.filter((d: any) => d.isAvailableForRide).length ?? 0;
  const totalOrgs = organizations?.length ?? 0;
  const totalRides = rides?.length ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayRides =
    rides?.filter((r: any) => r.requestedAt >= today.getTime()).length ?? 0;

  const completedRides =
    rides?.filter((r: any) => r.status === "Completed").length ?? 0;

  const cancelledRides =
    rides?.filter((r: any) => r.status === "Canceled" || r.status === "Abort")
      .length ?? 0;

  const totalRevenue =
    rides
      ?.filter((r: any) => r.status === "Completed")
      .reduce((sum: number, r: any) => sum + (r.fare ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">
          Overview of your ride-hailing platform
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {isLoading ? (
          [...Array(10)].map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Riders"
              value={totalRiders}
              icon={Users}
              color="blue"
              trend="+12% this month"
              onClick={() =>
                setSelectedCard({
                  title: "Total Riders",
                  type: "rider",
                  data: riders ?? [],
                  columns: riderColumns,
                  filterFields: [
                    {
                      id: "status",
                      label: "Status",
                      options: [
                        { label: "Pending", value: "Pending" },
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
                  ],
                })
              }
            />
            <StatCard
              title="Total Drivers"
              value={totalDrivers}
              icon={Car}
              color="purple"
              trend="+5% this month"
              onClick={() =>
                setSelectedCard({
                  title: "Total Drivers",
                  type: "driver",
                  data: drivers ?? [],
                  columns: driverColumns,
                  filterFields: [
                    {
                      id: "online",
                      label: "Status",
                      options: [
                        { label: "Online", value: "Online" },
                        { label: "Offline", value: "Offline" },
                      ],
                    },
                    {
                      id: "license",
                      label: "License Verification",
                      options: [
                        { label: "Pending", value: "Pending" },
                        { label: "Verified", value: "Verified" },
                        { label: "Rejected", value: "Rejected" },
                      ],
                    },
                  ],
                })
              }
            />
            <StatCard
              title="Online Drivers"
              value={onlineDrivers}
              icon={Wifi}
              color="green"
              description={`${availableDrivers} available`}
              onClick={() =>
                setSelectedCard({
                  title: "Online Drivers",
                  type: "driver",
                  data: drivers?.filter((d: any) => d.isOnline) ?? [],
                  columns: driverColumns,
                  filterFields: [
                    {
                      id: "license",
                      label: "License Verification",
                      options: [
                        { label: "Pending", value: "Pending" },
                        { label: "Verified", value: "Verified" },
                        { label: "Rejected", value: "Rejected" },
                      ],
                    },
                  ],
                })
              }
            />
            <StatCard
              title="Organizations"
              value={totalOrgs}
              icon={Building2}
              color="orange"
              onClick={() =>
                setSelectedCard({
                  title: "Organizations",
                  type: "organization",
                  data: organizations ?? [],
                  columns: orgColumns,
                  filterFields: [
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
                  ],
                })
              }
            />
            <StatCard
              title="Total Rides"
              value={totalRides}
              icon={Route}
              color="indigo"
              onClick={() =>
                setSelectedCard({
                  title: "Total Rides",
                  type: "ride",
                  data: rides ?? [],
                  columns: rideColumns,
                  filterFields: [
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
                  ],
                })
              }
            />
            <StatCard
              title="Today's Rides"
              value={todayRides}
              icon={Clock}
              color="cyan"
              onClick={() =>
                setSelectedCard({
                  title: "Today's Rides",
                  type: "ride",
                  data:
                    rides?.filter(
                      (r: any) => r.requestedAt >= today.getTime(),
                    ) ?? [],
                  columns: rideColumns,
                  filterFields: [
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
                  ],
                })
              }
            />
            <StatCard
              title="Completed Rides"
              value={completedRides}
              icon={CheckCircle}
              color="green"
              trend={`${totalRides ? Math.round((completedRides / totalRides) * 100) : 0}% completion`}
              onClick={() =>
                setSelectedCard({
                  title: "Completed Rides",
                  type: "ride",
                  data:
                    rides?.filter((r: any) => r.status === "Completed") ?? [],
                  columns: rideColumns,
                })
              }
            />
            <StatCard
              title="Cancelled Rides"
              value={cancelledRides}
              icon={XCircle}
              color="red"
              onClick={() =>
                setSelectedCard({
                  title: "Cancelled Rides",
                  type: "ride",
                  data:
                    rides?.filter(
                      (r: any) =>
                        r.status === "Canceled" || r.status === "Abort",
                    ) ?? [],
                  columns: rideColumns,
                  filterFields: [
                    {
                      id: "status",
                      label: "Status",
                      options: [
                        { label: "Canceled", value: "Canceled" },
                        { label: "Abort", value: "Abort" },
                      ],
                    },
                  ],
                })
              }
            />
            <StatCard
              title="Active Drivers"
              value={availableDrivers}
              icon={Activity}
              color="teal"
              onClick={() =>
                setSelectedCard({
                  title: "Active Drivers",
                  type: "driver",
                  data: drivers?.filter((d: any) => d.isAvailableForRide) ?? [],
                  columns: driverColumns,
                  filterFields: [
                    {
                      id: "online",
                      label: "Status",
                      options: [
                        { label: "Online", value: "Online" },
                        { label: "Offline", value: "Offline" },
                      ],
                    },
                    {
                      id: "license",
                      label: "License Verification",
                      options: [
                        { label: "Pending", value: "Pending" },
                        { label: "Verified", value: "Verified" },
                        { label: "Rejected", value: "Rejected" },
                      ],
                    },
                  ],
                })
              }
            />
            <StatCard
              title="Total Revenue"
              value={formatCurrency(totalRevenue)}
              icon={TrendingUp}
              color="emerald"
              description="From completed rides"
              onClick={() =>
                setSelectedCard({
                  title: "Total Revenue",
                  type: "ride",
                  data:
                    rides?.filter((r: any) => r.status === "Completed") ?? [],
                  columns: rideColumns,
                })
              }
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RidesChart rides={rides ?? []} />
        <RegistrationChart riders={riders ?? []} drivers={drivers ?? []} />
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={selectedCard !== null}
        onOpenChange={(open) => !open && setSelectedCard(null)}
      >
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCard?.title}</DialogTitle>
            <DialogDescription>
              Viewing {selectedCard?.data.length}{" "}
              {selectedCard?.title.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="mt-4">
              <DataTable
                columns={selectedCard.columns}
                data={selectedCard.data}
                filterFields={selectedCard.filterFields}
                onRowClick={(row: any) => {
                  setSelectedCard(null);
                  if (selectedCard.type === "rider") {
                    router.push(`/riders/${row._id}`);
                  } else if (selectedCard.type === "driver") {
                    router.push(`/drivers/${row._id}`);
                  } else if (selectedCard.type === "ride") {
                    router.push(`/rides/${row._id}`);
                  } else if (selectedCard.type === "organization") {
                    router.push(`/organizations/${row._id}`);
                  }
                }}
                emptyTitle={`No ${selectedCard.title.toLowerCase()} found`}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
