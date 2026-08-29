import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminSidebar from '@/components/admin-sidebar'
// Importée plutôt que redéclarée : deux copies de la même adresse finissent
// par diverger, et c'est la copie oubliée qui ouvre l'accès.
import { ADMIN_EMAIL } from '@/lib/admin-auth'

export const metadata = {
  title: 'Admin — Hesabi',
  robots: 'noindex,nofollow',
}

export default async function AdminLayout({ children }) {
  // Defense-in-depth: middleware already blocks non-admins, but we double-check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect('/')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
