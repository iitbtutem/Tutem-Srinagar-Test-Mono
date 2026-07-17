import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details & Ratings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Rider Profile Card */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Ratings Summary Card */}
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>

        {/* Right Column: Ride History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-glass p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-border">
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
