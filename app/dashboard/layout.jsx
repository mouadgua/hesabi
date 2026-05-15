import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import prisma from '@/lib/prisma'
import KeyboardShortcuts from '@/components/keyboard-shortcuts'

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

  const [pendingCount, processingCount] = await Promise.all([
    prisma.document.count({
      where: { client: { cabinet_id: utilisateurDb.cabinet_id }, statut: 'A_VERIFIER' }
    }),
    prisma.document.count({
      where: { client: { cabinet_id: utilisateurDb.cabinet_id }, statut: 'EN_COURS_IA' }
    }),
  ])

  const userProfile = {
    name: user.user_metadata?.full_name || "Utilisateur",
    email: user.email,
    avatar: user.user_metadata?.avatar_url || "",
  }

  const cabinetProfile = utilisateurDb.cabinet;

  return (
    <TooltipProvider>
      <SidebarProvider
        style={{
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        }}
      >
        <AppSidebar user={userProfile} cabinet={cabinetProfile} pendingCount={pendingCount} processingCount={processingCount} variant="inset" />

        <SidebarInset>
          <SiteHeader />
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>

        <KeyboardShortcuts />
      </SidebarProvider>
    </TooltipProvider>
  );
}