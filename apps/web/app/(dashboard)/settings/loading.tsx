import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="max-w-xl space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Settings Form Card */}
      <div className="card-glass p-6 space-y-6">
        <Skeleton className="h-6 w-44" />
        
        {/* Settings fields */}
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-3 w-72" />
            </div>
          ))}
        </div>

        {/* Action button */}
        <Skeleton className="h-10 w-32 rounded-lg pt-2" />
      </div>
    </div>
  );
}
