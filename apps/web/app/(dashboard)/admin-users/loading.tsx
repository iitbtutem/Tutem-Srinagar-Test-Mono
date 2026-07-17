import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Table Card */}
      <div className="card-glass p-6 space-y-4">
        {/* Search and Columns selectors */}
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-20 rounded-lg" />
          </div>
        </div>

        {/* Skeleton Table */}
        <SkeletonTable rows={10} />
      </div>
    </div>
  );
}
