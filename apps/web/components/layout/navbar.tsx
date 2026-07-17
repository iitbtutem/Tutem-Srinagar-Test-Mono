"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAuthenticatedQuery } from "@/hooks/customApi";
import { api } from "@tutem/api";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { getInitials } from "@/lib/utils";

const pathLabels: Record<string, string> = {
  "/": "Dashboard",
  "/riders": "Riders",
  "/drivers": "Drivers",
  "/rides": "Rides",
  "/tracking": "Live Tracking",
  "/organizations": "Organizations",
  "/admin-users": "Admin Users",
  "/settings": "Settings",
  "/profile": "Profile",
};

function RiderCrumbLabel({ id, fallback }: { id: string; fallback: string }) {
  const rider = useAuthenticatedQuery(api.routes.admin.getRiderById, {
    id: id as any,
  }) as any;
  if (!rider) return <span className="animate-pulse">Loading...</span>;
  const name = `${rider.userDetails?.firstName || ""} ${rider.userDetails?.lastName || ""}`.trim();
  return <span>{name || fallback}</span>;
}

function DriverCrumbLabel({ id, fallback }: { id: string; fallback: string }) {
  const driver = useAuthenticatedQuery(api.routes.admin.getDriverById, {
    id: id as any,
  }) as any;
  if (!driver) return <span className="animate-pulse">Loading...</span>;
  const name = `${driver.userDetails?.firstName || ""} ${driver.userDetails?.lastName || ""}`.trim();
  return <span>{name || fallback}</span>;
}

function OrganizationCrumbLabel({
  id,
  fallback,
}: {
  id: string;
  fallback: string;
}) {
  const org = useAuthenticatedQuery(
    api.routes.organizations.getOrganizationById,
    { id: id as any },
  ) as any;
  if (!org) return <span className="animate-pulse">Loading...</span>;
  return <span>{org.name || fallback}</span>;
}

function RideCrumbLabel({ id, fallback }: { id: string; fallback: string }) {
  const ride = useAuthenticatedQuery(api.routes.admin.getRideByIdAdmin, {
    id: id as any,
  }) as any;
  if (!ride) return <span className="animate-pulse">Loading...</span>;
  const riderName = ride.rider?.userDetails
    ? `${ride.rider.userDetails.firstName} ${ride.rider.userDetails.lastName ?? ""}`.trim()
    : "Rider";
  return <span>Ride details ({riderName})</span>;
}

function CrumbLabel({
  segment,
  href,
  index,
  segments,
}: {
  segment: string;
  href: string;
  index: number;
  segments: string[];
}) {
  if (pathLabels[href]) {
    return <span>{pathLabels[href]}</span>;
  }

  const parent = index > 0 ? segments[index - 1] : "";

  if (parent === "riders") {
    return <RiderCrumbLabel id={segment} fallback={segment} />;
  }
  if (parent === "drivers") {
    return <DriverCrumbLabel id={segment} fallback={segment} />;
  }
  if (parent === "organizations") {
    return <OrganizationCrumbLabel id={segment} fallback={segment} />;
  }
  if (parent === "rides") {
    return <RideCrumbLabel id={segment} fallback={segment} />;
  }

  const fallbackLabel = segment.charAt(0).toUpperCase() + segment.slice(1);
  return <span>{fallbackLabel}</span>;
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    return { segment: seg, href, index: i };
  });

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <Link
        href="/"
        className="transition-colors"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <span
            style={{ color: "var(--color-muted-foreground)", opacity: 0.4 }}
          >
            /
          </span>
          {i === crumbs.length - 1 ? (
            <span className="font-medium">
              <CrumbLabel
                segment={crumb.segment}
                href={crumb.href}
                index={crumb.index}
                segments={segments}
              />
            </span>
          ) : (
            <Link
              href={crumb.href}
              className="transition-colors"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <CrumbLabel
                segment={crumb.segment}
                href={crumb.href}
                index={crumb.index}
                segments={segments}
              />
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function UserMenu({
  onLogout,
  name,
  initials,
  profilePictureUrl,
}: {
  onLogout: () => void;
  name: string;
  initials: string;
  profilePictureUrl?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
        style={{ cursor: "pointer" }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-muted)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = "transparent")
        }
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm overflow-hidden"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--color-primary) 12%, transparent)",
            color: "var(--color-primary)",
          }}
        >
          {profilePictureUrl ? (
            <img
              src={profilePictureUrl}
              alt={name || "Admin"}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <span className="hidden sm:block text-sm font-medium">
          {name || "Admin"}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--color-muted-foreground)" }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-xl border shadow-lg overflow-hidden z-50"
          style={{
            backgroundColor: "var(--color-popover)",
            borderColor: "var(--color-border)",
          }}
        >
          <div
            className="p-3"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <p className="text-sm font-medium">{name || "Admin"}</p>
            <p
              className="text-xs"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Administrator
            </p>
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors w-full"
              style={{ color: "var(--color-foreground)" }}
            >
              <User
                className="h-4 w-4"
                style={{ color: "var(--color-muted-foreground)" }}
              />
              Profile
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors w-full"
              style={{ color: "var(--color-foreground)" }}
            >
              <Settings
                className="h-4 w-4"
                style={{ color: "var(--color-muted-foreground)" }}
              />
              Settings
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors w-full text-left"
              style={{ color: "var(--color-destructive)" }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface NavbarProps {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();

  // Fetch admin profile to show real name in the navbar
  const profile = useAuthenticatedQuery(api.routes.admin.getAdminProfile) as any;

  const name = profile
    ? `${profile.firstName} ${profile.lastName ?? ""}`.trim()
    : "";
  const initials = profile
    ? getInitials(profile.firstName, profile.lastName)
    : "A";

  const handleLogout = () => {
    // Clear the local session token
    signOut();
    toast.success("Signed out successfully");
    router.replace("/login");
  };

  return (
    <header
      className="h-16 sticky top-0 z-30 flex items-center px-4 gap-4 backdrop-blur-sm"
      style={{
        borderBottom: "1px solid var(--color-border)",
        backgroundColor:
          "color-mix(in oklch, var(--color-background) 85%, transparent)",
      }}
    >
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
        style={{ color: "var(--color-foreground)" }}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs */}
      <div className="flex-1 min-w-0">
        <Breadcrumbs />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Notifications */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors relative"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          <Bell className="h-4 w-4" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--color-primary)" }}
          />
        </button>

        {/* User menu */}
        <UserMenu
          onLogout={handleLogout}
          name={name}
          initials={initials}
          profilePictureUrl={profile?.profilePictureKey}
        />
      </div>
    </header>
  );
}
