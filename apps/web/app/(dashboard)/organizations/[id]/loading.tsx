import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Organization Details & Rules */}
        <div className="lg:col-span-1 space-y-6">
          {/* Org Info Card */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Verification Rules */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </div>
          </div>
        </div>

        {/* Right Column: Map / Geographical Polygon Boundaries */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            {/* Map placeholder */}
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
