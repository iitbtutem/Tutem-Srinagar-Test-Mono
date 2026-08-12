import type { Metadata } from "next";
import { OrganizationDetailPage } from "./_organizationDetail";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "Organization Details" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("tutem_admin_session")?.value;

  let initialOrganizations: any[] = [];
  if (sessionToken) {
    try {
      initialOrganizations = await fetchQuery(
        api.routes.organizations.getAllOrganizations,
        { sessionToken },
      );
    } catch (err) {
      console.error("Failed to fetch organizations server-side:", err);
    }
  }

  return (
    <OrganizationDetailPage
      id={id}
      initialOrganizations={initialOrganizations}
    />
  );
}
