import type { Metadata } from "next";
import { SettingsPage } from "./_settingsPage";

export const metadata: Metadata = { title: "Ride Settings" };

export default function Page() {
  return <SettingsPage />;
}
