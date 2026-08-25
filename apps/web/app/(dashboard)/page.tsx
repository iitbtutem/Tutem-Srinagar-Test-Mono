import type { Metadata } from "next";
import { DashboardPage } from "./_dashboardPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Dashboard | Tutem Admin",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  await new Promise((r) => {
    setTimeout(() => {
      r("resolved");
    }, 2500);
  });

  let initialRiders: any[] = [];
  let initialDrivers: any[] = [];
  let initialOrgs: any[] = [];
  let initialRides: any[] = [];

  if (sessionToken) {
    try {
      initialOrgs = await fetchQuery(
        api.routes.organizations.getAllOrganizations,
        { sessionToken },
      );
    } catch (err) {
      console.error("Failed to fetch organizations server-side:", err);
    }
  }

  if (sessionToken) {
    try {
      const [riders, drivers, rides] = await Promise.all([
        fetchQuery(api.routes.admin.getAllRiders, { sessionToken }),
        fetchQuery(api.routes.admin.getAllDrivers, { sessionToken }),
        fetchQuery(api.routes.admin.getAllRidesAdmin, { sessionToken }),
      ]);
      initialRiders = riders;
      initialDrivers = drivers;
      initialRides = rides;
    } catch (err) {
      console.error("Failed to fetch admin dashboard stats server-side:", err);
    }
  }

  return (
    <DashboardPage
      initialRiders={initialRiders}
      initialDrivers={initialDrivers}
      initialOrganizations={initialOrgs}
      initialRides={initialRides}
    />
  );
}
