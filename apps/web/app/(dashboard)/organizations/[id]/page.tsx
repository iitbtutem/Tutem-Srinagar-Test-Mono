import type { Metadata } from "next";
import { OrganizationDetailPage } from "./_organizationDetail";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";

export const metadata: Metadata = { title: "Organization Details" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialOrganizations = await fetchQuery(
    api.routes.organizations.getAllOrganizations,
    {},
  );
  return (
    <OrganizationDetailPage
      id={id}
      initialOrganizations={initialOrganizations}
    />
  );
}
