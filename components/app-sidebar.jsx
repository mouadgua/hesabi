"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  HomeIcon, SparklesIcon, FolderIcon, BellIcon,
  Settings2Icon, CreditCardIcon, CircleHelpIcon, CommandIcon, LogOutIcon,
} from "lucide-react"
import { logout } from "@/app/login/actions"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
} from "@/components/ui/sidebar"
import { useNotifications } from "@/components/notification-context"

const navTop = [
  { title: "Accueil", url: "/dashboard", icon: HomeIcon, exact: true },
  { title: "Extraction", url: "/dashboard/extraction", icon: SparklesIcon },
  { title: "Modèles", url: "/dashboard/models", icon: FolderIcon },
]

const navBottom = [
  { title: "Paramètres", url: "/dashboard/settings", icon: Settings2Icon, exact: true },
  { title: "Abonnement", url: "/dashboard/settings/billing", icon: CreditCardIcon },
  { title: "Support & Aide", url: "/dashboard/support", icon: CircleHelpIcon },
]

function NavItem({ item, pathname }) {
  const isActive = item.exact
    ? pathname === item.url
    : pathname === item.url || pathname.startsWith(item.url + "/")
  const Icon = item.icon

  return (
    <Link
      href={item.url}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        "border-l-2",
        isActive
          ? "border-[#1D9E75] bg-[#1D9E75]/10 dark:bg-[#1D9E75]/10 text-[#1D9E75]"
          : "border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-slate-100",
      ].join(" ")}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{item.title}</span>
    </Link>
  )
}

export function AppSidebar({ user, cabinet, ...props }) {
  const pathname = usePathname()
  const { count: pendingCount } = useNotifications()

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const notifActive =
    pathname === "/dashboard/verification" ||
    pathname.startsWith("/dashboard/verification/")

  return (
    <Sidebar
      collapsible="offcanvas"
      className="border-r-0"
      {...props}
    >
      {/* Logo + Cabinet name */}
      <SidebarHeader className="px-4 py-4 border-b border-slate-200/50 dark:border-white/[0.05]">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          {cabinet?.logo_url ? (
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
              <Image
                src={cabinet.logo_url}
                alt="Logo"
                fill
                sizes="28px"
                className="object-contain p-0.5"
              />
            </div>
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1D9E75] shadow-lg shadow-[#1D9E75]/30">
              <CommandIcon className="size-4 text-white" />
            </div>
          )}
          <span className="truncate text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            {cabinet?.nom || "Hesabi"}
          </span>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-2 pb-2">
        {/* Top nav */}
        <div className="flex flex-col gap-0.5 mt-2">
          {navTop.map((item) => (
            <NavItem key={item.url} item={item} pathname={pathname} />
          ))}
        </div>

        {/* Notifications */}
        <div className="mt-0.5">
          <Link
            href="/dashboard/verification"
            className={[
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
              "border-l-2",
              notifActive
                ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-slate-100",
            ].join(" ")}
          >
            <BellIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate">Notifications</span>
            {pendingCount > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1D9E75] px-1.5 text-[10px] font-bold text-white shadow-sm">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Link>
        </div>

        {/* Separator */}
        <div className="my-3 h-px bg-slate-200/60 dark:bg-white/[0.06]" />

        {/* Bottom nav */}
        <div className="flex flex-col gap-0.5">
          {navBottom.map((item) => (
            <NavItem key={item.url} item={item} pathname={pathname} />
          ))}
        </div>
      </SidebarContent>

      {/* User footer */}
      <SidebarFooter className="border-t border-slate-200/50 dark:border-white/[0.05] px-4 py-4">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-200/60 dark:ring-white/10">
              <Image
                src={user.avatar}
                alt={user.name || ""}
                fill
                sizes="32px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-xs font-bold text-white">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {user?.name}
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{user?.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              title="Se déconnecter"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOutIcon className="size-3.5" />
            </button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
