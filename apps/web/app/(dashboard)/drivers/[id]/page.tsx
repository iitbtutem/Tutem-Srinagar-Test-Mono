import type { Metadata } from "next";
import { DriverDetailPage } from "./_driverDetail";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Driver Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialDriver: any = null;
  if (sessionToken) {
    try {
      initialDriver = await fetchQuery(api.routes.admin.getDriverById, {
        sessionToken,
        id: id as any,
      });
    } catch (err) {
      console.error("Failed to fetch driver details server-side:", err);
    }
  }

  return <DriverDetailPage id={id} initialDriver={initialDriver} />;
}
