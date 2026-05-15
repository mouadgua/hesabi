import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingClientDrive() {
  return (
    <div className="p-4 md:p-8 space-y-6 w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Info Cards Skeleton */}
      <Skeleton className="h-24 w-full rounded-xl" />

      {/* Toolbar Skeleton */}
      <div className="flex justify-between items-center gap-4">
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-10 w-96 rounded-md" />
      </div>

      {/* Table Skeleton */}
      <div className="border rounded-xl p-4 space-y-4 bg-white">
        <Skeleton className="h-10 w-full bg-gray-100" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  )
}