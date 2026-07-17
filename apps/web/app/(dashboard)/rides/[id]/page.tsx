import type { Metadata } from "next";
import { RideDetailPage } from "./_rideDetail";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Ride Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialRide: any = null;
  if (sessionToken) {
    try {
      initialRide = await fetchQuery(api.routes.admin.getRideByIdAdmin, {
        sessionToken,
        id: id as any,
      });
    } catch (err) {
      console.error("Failed to fetch ride details server-side:", err);
    }
  }

  return <RideDetailPage id={id} initialRide={initialRide} />;
}
