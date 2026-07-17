import type { Metadata } from "next";
import { AdminUsersPage } from "./_adminUsersPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Admin Users" };

export default async function Page() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialAdmins: any[] = [];
  if (sessionToken) {
    try {
      initialAdmins = await fetchQuery(api.routes.admin.getAllAdminUsers, {
        sessionToken,
      });
    } catch (err) {
      console.error("Failed to fetch admin users server-side:", err);
    }
  }

  return <AdminUsersPage initialAdmins={initialAdmins} />;
}
