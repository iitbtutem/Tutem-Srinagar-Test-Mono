import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Columns: Ride Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main info card */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-40" />
                </div>
              ))}
            </div>
          </div>

          {/* Location details card */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Map and involved users */}
        <div className="space-y-6">
          {/* Map placeholder */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-[200px] w-full rounded-xl" />
          </div>

          {/* Rider and Driver summary cards */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>

          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-5 w-32" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
