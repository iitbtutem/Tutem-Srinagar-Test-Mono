import type { Metadata } from "next";
import { TrackingPage } from "./_trackingPage";

export const metadata: Metadata = { title: "Live Tracking" };

export default function Page() {
  return <TrackingPage />;
}
