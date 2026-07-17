import type { Metadata } from "next";
import { OrganizationsPage } from "./_organizationsPage";
import { fetchQuery } from "convex/nextjs";
import { api } from "@tutem/api";

export const metadata: Metadata = { title: "Organizations" };

export default async function Page() {
  const initialOrganizations = await fetchQuery(
    api.routes.organizations.getAllOrganizations,
    {},
  );
  return <OrganizationsPage initialOrganizations={initialOrganizations} />;
}
