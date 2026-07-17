import type { Metadata } from "next";
import { ProfilePage } from "./_profile";

export const metadata: Metadata = { title: "Profile" };

export default function Page() {
  return <ProfilePage />;
}
