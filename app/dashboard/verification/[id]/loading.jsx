import { Skeleton } from "@/components/ui/skeleton"

export default function VerificationLoading() {
  return (
    <div className="flex h-[calc(100vh-60px)] flex-col overflow-hidden">

      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/60 dark:border-white/[0.05] bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl px-4 py-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-40 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>

      {/* Split panel */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — PDF viewer */}
        <div className="hidden md:block w-1/2 border-r border-slate-200/60 dark:border-white/[0.05] p-3">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>

        {/* Right — Extracted data */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto p-4 md:p-6 w-full md:w-1/2">
          {/* Card header */}
          <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] overflow-hidden shadow-sm flex-1">
            <div className="flex items-center justify-between border-b border-slate-100/80 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] px-6 py-4">
              <Skeleton className="h-4 w-32 rounded" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-28 rounded-lg" />
              </div>
            </div>
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
