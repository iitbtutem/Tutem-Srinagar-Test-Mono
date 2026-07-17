"use client";

import { AuthProvider } from "@/context/AuthContext";
import { convex } from "@/lib/convex";
import { ConvexProvider } from "convex/react";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ConvexProvider client={convex}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
          }}
        />
      </ConvexProvider>
    </ThemeProvider>
  );
}
