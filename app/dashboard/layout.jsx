import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import prisma from '@/lib/prisma'
import KeyboardShortcuts from '@/components/keyboard-shortcuts'
import { NotificationProvider } from "@/components/notification-context"
import QualitySurvey from "@/components/quality-survey"

export default async function DashboardLayout({ children }) {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  const utilisateurDb = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    include: { cabinet: true },
  })

  if (!utilisateurDb || !utilisateurDb.cabinet_id) {
    redirect('/onboarding')
  }

  const pendingCount = await prisma.document.count({
    where: {
      client: { cabinet_id: utilisateurDb.cabinet_id },
      statut: { in: ['A_VERIFIER', 'REJETE'] },
    },
  })

  const userProfile = {
    name: user.user_metadata?.full_name || "Utilisateur",
    email: user.email,
    avatar: user.user_metadata?.avatar_url || "",
  }

  const cabinetProfile = utilisateurDb.cabinet

  return (
    <TooltipProvider>
      {/* Full-page wrapper */}
      <div className="min-h-screen relative overflow-hidden bg-[#f5fbf7] dark:bg-[#060d09] text-slate-800 dark:text-slate-200 transition-colors duration-300">

        {/* ── Background orbs — same as landing page ───────────────────── */}
        <div className="fixed inset-0 z-0 pointer-events-none select-none">
          <div className="absolute top-[-12%] left-[-8%] w-[550px] h-[550px] rounded-full bg-[#1D9E75]/10 dark:bg-[#1D9E75]/6 blur-[140px]" />
          <div className="absolute top-[25%] right-[-12%] w-[500px] h-[500px] rounded-full bg-emerald-300/8 dark:bg-emerald-500/4 blur-[120px]" />
          <div className="absolute bottom-[-15%] left-[25%] w-[650px] h-[650px] rounded-full bg-teal-200/8 dark:bg-teal-500/4 blur-[150px]" />
          {/* Subtle grid overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1D9E7508_1px,transparent_1px),linear-gradient(to_bottom,#1D9E7508_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_60%,transparent_100%)] opacity-60 dark:opacity-30" />
        </div>

        {/* ── App shell ─────────────────────────────────────────────────── */}
        <SidebarProvider
          style={{
            "--sidebar-width": "256px",
            "--header-height": "60px",
          }}
        >
          <NotificationProvider initialCount={pendingCount}>
          <AppSidebar user={userProfile} cabinet={cabinetProfile} />

          <SidebarInset className="bg-transparent border-l border-[#1D9E75]/10 dark:border-white/[0.05] flex flex-col overflow-hidden relative z-10">
            <SiteHeader user={userProfile} />

            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              {children}
            </main>
          </SidebarInset>

          <KeyboardShortcuts />
          <QualitySurvey />
          </NotificationProvider>
        </SidebarProvider>
      </div>
    </TooltipProvider>
  )
}
