"use client"

import { usePathname } from "next/navigation"
import { SunIcon, MoonIcon } from "lucide-react"
import Image from "next/image"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import NotificationDropdown from "@/components/notification-dropdown"

const PAGE_TITLES = {
  "/dashboard": "Accueil",
  "/dashboard/extraction": "Extraction",
  "/dashboard/models": "Modèles",
  "/dashboard/verification": "Notifications",
  "/dashboard/settings/billing": "Abonnement",
  "/dashboard/settings": "Paramètres",
  "/dashboard/support": "Support & Aide",
}

function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const sorted = Object.keys(PAGE_TITLES).sort((a, b) => b.length - a.length)
  for (const path of sorted) {
    if (pathname.startsWith(path + "/")) return PAGE_TITLES[path]
  }
  return "Dashboard"
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="h-8 w-8" />

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
      aria-label="Changer de thème"
    >
      {isDark ? (
        <SunIcon className="size-4 text-amber-400" />
      ) : (
        <MoonIcon className="size-4 text-slate-500" />
      )}
    </button>
  )
}

export function SiteHeader({ user }) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <header className="flex h-[60px] shrink-0 items-center border-b border-[#1D9E75]/10 dark:border-white/[0.05] bg-[#f5fbf7]/80 dark:bg-[#060d09]/80 backdrop-blur-2xl px-4 lg:px-6 sticky top-0 z-40">
      <div className="flex w-full items-center gap-3">
        <SidebarTrigger className="-ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]" />

        <div className="h-4 w-px bg-slate-200/80 dark:bg-white/10" />

        <h1 className="text-sm font-semibold text-slate-700 dark:text-slate-200 tracking-tight">
          {title}
        </h1>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notification bell */}
          <NotificationDropdown />

          {/* Separator */}
          <div className="h-4 w-px bg-slate-200/80 dark:bg-white/10 mx-1" />

          {/* Avatar */}
          {user?.avatar ? (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-200/70 dark:ring-white/10">
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
        </div>
      </div>
    </header>
  )
}
