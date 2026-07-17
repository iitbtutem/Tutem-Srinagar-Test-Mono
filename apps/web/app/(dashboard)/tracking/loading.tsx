import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
      {/* Page Header */}
      <div className="space-y-2 flex-shrink-0">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Grid Content */}
      <div className="grid gap-6 lg:grid-cols-4 flex-1 min-h-0">
        {/* Left Column: Active list */}
        <div className="lg:col-span-1 card-glass p-4 space-y-4 flex flex-col h-full">
          <Skeleton className="h-6 w-32 flex-shrink-0" />
          <Skeleton className="h-10 w-full rounded-lg flex-shrink-0" />
          <div className="space-y-3 flex-1 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Tracking Map */}
        <div className="lg:col-span-3 card-glass p-4 h-full">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
