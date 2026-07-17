import type { Metadata } from "next";
import { RidersPage } from "./_ridersPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Riders" };

export default async function Page() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialRiders: any[] = [];
  if (sessionToken) {
    try {
      initialRiders = await fetchQuery(api.routes.admin.getAllRiders, {
        sessionToken,
      });
    } catch (err) {
      console.error("Failed to fetch riders server-side:", err);
    }
  }

  return <RidersPage initialRiders={initialRiders} />;
}
