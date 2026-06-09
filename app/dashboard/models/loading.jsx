import { Skeleton } from "@/components/ui/skeleton"

function ModelCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-7 w-7 rounded-lg shrink-0" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/4 rounded" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  )
}

export default function ModelsLoading() {
  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">

      {/* Centered header */}
      <div className="flex flex-col items-center text-center gap-5">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48 rounded mx-auto" />
          <Skeleton className="h-4 w-64 rounded mx-auto" />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3 w-full max-w-xl">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-44 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
      </div>

      {/* Model cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => <ModelCardSkeleton key={i} />)}
      </div>
    </div>
  )
}
