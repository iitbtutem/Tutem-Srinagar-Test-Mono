import type { Metadata } from "next";
import { DriversPage } from "./_driversPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Drivers" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;
  const { organization } = await searchParams;

  let initialDrivers: any[] = [];
  if (sessionToken) {
    try {
      initialDrivers = await fetchQuery(api.routes.admin.getAllDrivers, {
        sessionToken,
      });
    } catch (err) {
      console.error("Failed to fetch drivers server-side:", err);
    }
  }

  return <DriversPage initialDrivers={initialDrivers} organizationFilter={organization} />;
}
