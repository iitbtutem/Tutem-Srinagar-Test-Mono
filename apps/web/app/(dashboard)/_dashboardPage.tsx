"use client";

import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { StatCard } from "./_statCard";
import { RidesChart, RegistrationChart } from "./_ridesChart";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useState, useEffect, useMemo } from "react";
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
  Wifi,
  Activity,
  Calendar,
  Flame,
} from "lucide-react";
import PusherClient from "pusher-js";
import {
  subDays,
  startOfDay,
  endOfDay,
  startOfMonth,
  format,
} from "date-fns";

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

  // Active drivers from Pusher live location updates
  const [activeDriverIds, setActiveDriverIds] = useState<Set<string>>(new Set());

  // Date range filter state (Default: last 14 days)
  const [preset, setPreset] = useState<
    "7d" | "14d" | "30d" | "month" | "all" | "custom"
  >("14d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const liveRiders = useAuthenticatedQuery(api.routes.admin.getAllRiders);
  const liveDrivers = useAuthenticatedQuery(api.routes.admin.getAllDrivers);
  const liveOrganizations = useAuthenticatedQuery(
    api.routes.organizations.getAllOrganizations
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

  // ── 1. Fetch & Subscribe to Active Drivers (via Pusher + REST API) ──────
  useEffect(() => {
    const fetchActive = () => {
      fetch("/api/pusher/active-drivers")
        .then((r) => r.json())
        .then((d: { activeDriverIds?: string[] }) => {
          if (d.activeDriverIds) {
            setActiveDriverIds(new Set(d.activeDriverIds));
          }
        })
        .catch(() => {});
    };

    fetchActive();
    const pollTimer = setInterval(fetchActive, 10000); // 10s poll fallback

    const appKey = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!appKey || !cluster) return () => clearInterval(pollTimer);

    const pusher = new PusherClient(appKey, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe("private-active-drivers");
    channel.bind("list-updated", (d: { activeDriverIds?: string[] }) => {
      if (d.activeDriverIds) {
        setActiveDriverIds(new Set(d.activeDriverIds));
      }
    });

    return () => {
      clearInterval(pollTimer);
      pusher.disconnect();
    };
  }, []);

  // ── 2. Compute Date Range (Default: Last 14 days) ──────────────────────
  const { startDate, endDate, dateLabel } = useMemo(() => {
    const now = new Date();
    if (preset === "7d") {
      return {
        startDate: startOfDay(subDays(now, 6)),
        endDate: endOfDay(now),
        dateLabel: "Last 7 days",
      };
    }
    if (preset === "14d") {
      return {
        startDate: startOfDay(subDays(now, 13)),
        endDate: endOfDay(now),
        dateLabel: "Last 14 days",
      };
    }
    if (preset === "30d") {
      return {
        startDate: startOfDay(subDays(now, 29)),
        endDate: endOfDay(now),
        dateLabel: "Last 30 days",
      };
    }
    if (preset === "month") {
      return {
        startDate: startOfMonth(now),
        endDate: endOfDay(now),
        dateLabel: "This month",
      };
    }
    if (preset === "custom" && customStart && customEnd) {
      const start = startOfDay(new Date(customStart));
      const end = endOfDay(new Date(customEnd));
      return {
        startDate: start,
        endDate: end,
        dateLabel: `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`,
      };
    }
    // "all" or fallback
    return {
      startDate: undefined,
      endDate: undefined,
      dateLabel: preset === "all" ? "All time" : "Last 14 days",
    };
  }, [preset, customStart, customEnd]);

  // ── 3. Filter Rides by Date Range ─────────────────────────────────────
  const filteredRides = useMemo(() => {
    if (!rides) return [];
    if (!startDate || !endDate) return rides;
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return rides.filter(
      (r: any) => r.requestedAt >= startMs && r.requestedAt <= endMs
    );
  }, [rides, startDate, endDate]);

  // ── 4. Compute Dashboard Statistics ───────────────────────────────────
  const totalRiders = riders?.length ?? 0;
  const totalDrivers = drivers?.length ?? 0;
  const onlineDrivers = drivers?.filter((d: any) => d.isOnline).length ?? 0;
  const availableDrivers = drivers?.filter((d: any) => d.isAvailableForRide).length ?? 0;
  const totalOrgs = organizations?.length ?? 0;

  // Active Rides: Status is Open, Active, or Driver Arrived
  const activeRides = useMemo(() => {
    return (
      rides?.filter(
        (r: any) =>
          r.status === "Open" ||
          r.status === "Active" ||
          r.status === "Driver Arrived"
      ) ?? []
    );
  }, [rides]);

  // Active Drivers list (from live Pusher registry)
  const activeDriversList = useMemo(() => {
    return drivers?.filter((d: any) => activeDriverIds.has(d._id)) ?? [];
  }, [drivers, activeDriverIds]);

  const totalRidesInPeriod = filteredRides.length;
  const completedRidesInPeriod =
    filteredRides.filter((r: any) => r.status === "Completed").length;
  const cancelledRidesInPeriod =
    filteredRides.filter(
      (r: any) => r.status === "Canceled" || r.status === "Abort"
    ).length;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-description">
            Overview of your ride-hailing platform
          </p>
        </div>

        {/* Date Range Picker Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-background/80 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-xs">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2">
            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-medium text-foreground">Date Range:</span>
          </div>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as any)}
            className="bg-muted/50 dark:bg-muted/30 border border-border/50 text-xs font-medium rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:bg-muted"
          >
            <option value="14d">Last 14 days (Default)</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
            <option value="custom">Custom range...</option>
          </select>

          {preset === "custom" && (
            <div className="flex items-center gap-1 text-xs pl-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-muted/50 border border-border rounded-md px-2 py-1 text-xs focus:outline-none"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-muted/50 border border-border rounded-md px-2 py-1 text-xs focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stat cards grid */}
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
              description={`${availableDrivers} available for ride`}
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
              title="Active Drivers"
              value={activeDriverIds.size}
              icon={Flame}
              color="teal"
              description="Actively sending location"
              onClick={() =>
                setSelectedCard({
                  title: "Active Drivers",
                  type: "driver",
                  data: activeDriversList,
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
              value={totalRidesInPeriod}
              icon={Route}
              color="indigo"
              description={dateLabel}
              onClick={() =>
                setSelectedCard({
                  title: `Total Rides (${dateLabel})`,
                  type: "ride",
                  data: filteredRides,
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

            {/* Active Rides Card (Replaces Total Revenue) */}
            <StatCard
              title="Active Rides"
              value={activeRides.length}
              icon={Activity}
              color="emerald"
              description="Open, Active & Arrived"
              onClick={() =>
                setSelectedCard({
                  title: "Active Rides",
                  type: "ride",
                  data: activeRides,
                  columns: rideColumns,
                  filterFields: [
                    {
                      id: "status",
                      label: "Status",
                      options: [
                        { label: "Open", value: "Open" },
                        { label: "Active", value: "Active" },
                        { label: "Driver Arrived", value: "Driver Arrived" },
                      ],
                    },
                  ],
                })
              }
            />

            <StatCard
              title="Completed Rides"
              value={completedRidesInPeriod}
              icon={CheckCircle}
              color="green"
              description={dateLabel}
              trend={`${totalRidesInPeriod ? Math.round((completedRidesInPeriod / totalRidesInPeriod) * 100) : 0}% completion`}
              onClick={() =>
                setSelectedCard({
                  title: `Completed Rides (${dateLabel})`,
                  type: "ride",
                  data: filteredRides.filter((r: any) => r.status === "Completed"),
                  columns: rideColumns,
                })
              }
            />

            <StatCard
              title="Cancelled Rides"
              value={cancelledRidesInPeriod}
              icon={XCircle}
              color="red"
              description={dateLabel}
              onClick={() =>
                setSelectedCard({
                  title: `Cancelled Rides (${dateLabel})`,
                  type: "ride",
                  data: filteredRides.filter(
                    (r: any) => r.status === "Canceled" || r.status === "Abort"
                  ),
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
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RidesChart
          rides={rides ?? []}
          startDate={startDate}
          endDate={endDate}
          label={dateLabel}
        />
        <RegistrationChart
          riders={riders ?? []}
          drivers={drivers ?? []}
          startDate={startDate}
          endDate={endDate}
          label={dateLabel}
        />
      </div>

      {/* Detail Dialog */}
      <Dialog
        open={selectedCard !== null}
        onOpenChange={(open) => !open && setSelectedCard(null)}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedCard?.title}</DialogTitle>
            <DialogDescription>
              Viewing {selectedCard?.data.length}{" "}
              {selectedCard?.title.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          {selectedCard && (
            <div className="flex-1 overflow-y-auto min-h-0 mt-4 pr-1">
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
