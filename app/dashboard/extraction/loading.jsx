import { Skeleton } from "@/components/ui/skeleton"

function DocRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-white/[0.05]">
      <Skeleton className="size-8 shrink-0 rounded-lg" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-44 rounded" />
        <Skeleton className="h-3 w-28 rounded" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full shrink-0" />
      <Skeleton className="h-5 w-5 rounded shrink-0" />
    </div>
  )
}

export default function ExtractionLoading() {
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28 rounded" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-48 rounded" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      {/* Upload zone */}
      <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="size-11 rounded-xl" />
          <Skeleton className="h-4 w-52 rounded" />
          <Skeleton className="h-3 w-64 rounded" />
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
      </div>

      {/* Document list */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.07] bg-white dark:bg-white/[0.03] overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.05]">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => <DocRowSkeleton key={i} />)}
      </div>
    </div>
  )
}
