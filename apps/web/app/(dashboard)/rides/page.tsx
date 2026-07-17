import type { Metadata } from "next";
import { RidesPage } from "./_ridesPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Rides" };

export default async function Page() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialRides: any[] = [];
  if (sessionToken) {
    try {
      initialRides = await fetchQuery(api.routes.admin.getAllRidesAdmin, {
        sessionToken,
      });
    } catch (err) {
      console.error("Failed to fetch rides server-side:", err);
    }
  }

  return <RidesPage initialRides={initialRides} />;
}
