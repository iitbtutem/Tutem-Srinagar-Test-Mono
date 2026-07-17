import type { Metadata } from "next";
import { RiderDetailPage } from "./_riderDetail";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Rider Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialRider: any = null;
  if (sessionToken) {
    try {
      initialRider = await fetchQuery(api.routes.admin.getRiderById, {
        sessionToken,
        id: id as any,
      });
    } catch (err) {
      console.error("Failed to fetch rider details server-side:", err);
    }
  }

  return <RiderDetailPage id={id} initialRider={initialRider} />;
}
