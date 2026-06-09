"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboardIcon, UsersIcon, ZapIcon, BarChart2Icon,
  MailIcon, StarIcon, KeyIcon, ScrollTextIcon, ShieldIcon,
  LogOutIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin',             label: 'Overview',           icon: LayoutDashboardIcon, exact: true },
  { href: '/admin/users',       label: 'Utilisateurs',       icon: UsersIcon },
  { href: '/admin/extractions', label: 'Extractions',        icon: ZapIcon },
  { href: '/admin/visits',      label: 'Visits & Demo',      icon: BarChart2Icon },
  { href: '/admin/emails',      label: 'Emails Collectés',   icon: MailIcon },
  { href: '/admin/ratings',     label: 'Ratings & Inbox',    icon: StarIcon },
  { href: '/admin/beta',        label: 'Beta & Codes',       icon: KeyIcon },
  { href: '/admin/logs',        label: 'Logs',               icon: ScrollTextIcon },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-slate-950">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-slate-200/70 dark:border-white/[0.06] px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1D9E75]">
          <ShieldIcon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 leading-none">Admin</p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400 dark:text-slate-500">hesabi.ma — privé</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-[#1D9E75]/10 text-[#1D9E75]'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-100'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200/70 dark:border-white/[0.06] p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <LogOutIcon className="h-3.5 w-3.5" />
          Retour au dashboard
        </Link>
      </div>
    </aside>
  )
}
