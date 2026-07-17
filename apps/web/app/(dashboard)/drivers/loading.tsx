import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Filter and Table Card */}
      <div className="card-glass p-6 space-y-4">
        {/* Search, Filter buttons, and Sync */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        {/* Skeleton Table */}
        <SkeletonTable rows={15} />
      </div>
    </div>
  );
}
