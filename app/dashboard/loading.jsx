import { Skeleton } from "@/components/ui/skeleton"

function MetricCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-2.5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-10 w-20 rounded-lg" />
    </div>
  )
}

function DocRowSkeleton() {
  return (
    <div className="flex items-center gap-5 px-8 py-4">
      <Skeleton className="size-11 shrink-0 rounded-xl" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-3.5 w-48 rounded" />
        <Skeleton className="h-3 w-32 rounded" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-3 w-10 rounded ml-auto" />
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="p-6 md:p-10 space-y-10">

      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
        <Skeleton className="h-11 w-48 rounded-xl" />
      </div>

      {/* Metric cards — 4 cols on lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Activity + shortcuts */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent docs — 2/3 width */}
        <div className="lg:col-span-2 rounded-[1.75rem] border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] overflow-hidden shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100/80 dark:border-white/[0.06] px-8 py-5">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-14 rounded" />
          </div>
          <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
            {Array.from({ length: 5 }).map((_, i) => <DocRowSkeleton key={i} />)}
          </div>
        </div>

        {/* Shortcuts — 1/3 width */}
        <div className="rounded-[1.75rem] border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] overflow-hidden shadow-sm">
          <div className="border-b border-slate-100/80 dark:border-white/[0.06] px-8 py-5">
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
