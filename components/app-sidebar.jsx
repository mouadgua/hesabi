"use client"

import * as React from "react"
import { useState, useRef, useEffect, Suspense } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import {
  HomeIcon, SparklesIcon, FolderIcon, BellIcon,
  Settings2Icon, CreditCardIcon, CircleHelpIcon, CommandIcon, LogOutIcon,
  ChevronRightIcon, PlusIcon, PencilIcon, Trash2Icon, CheckIcon, XIcon,
  UsersIcon, ShieldIcon, BookOpenIcon,
} from "lucide-react"

const ADMIN_EMAIL = 'mouadguarraz@gmail.com'
import { logout } from "@/app/login/actions"
import { toast } from "sonner"
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
  { title: "Plan comptable", url: "/dashboard/settings/plan-comptable", icon: BookOpenIcon },
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

// ── Clients section (needs useSearchParams → wrapped in Suspense) ──────────────

function ClientRow({ client, isActive, onRenameStart, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/dashboard/extraction?client=${client.id}`}
        className={[
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-150 border-l-2 pr-16",
          isActive
            ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
            : "border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] hover:text-slate-800 dark:hover:text-slate-100",
        ].join(" ")}
      >
        <UsersIcon className="size-3.5 shrink-0 opacity-60" />
        <span className="truncate flex-1">{client.nom}</span>
        {client.pending > 0 && (
          <span className="shrink-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {client.pending > 99 ? "99+" : client.pending}
          </span>
        )}
      </Link>

      {/* Rename / Delete — show on hover */}
      {hovered && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 z-10">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onRenameStart(client.nom) }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Renommer"
          >
            <PencilIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onDelete() }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
            title="Supprimer"
          >
            <Trash2Icon className="size-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function ClientRenameRow({ value, onChange, onConfirm, onCancel }) {
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        ref={inputRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onConfirm()
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 rounded-md border border-[#1D9E75]/40 bg-white dark:bg-white/5 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#1D9E75] min-w-0"
        placeholder="Nom du client"
      />
      <button
        type="button"
        onClick={onConfirm}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#1D9E75] hover:bg-[#1D9E75]/10 cursor-pointer"
      >
        <CheckIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

function ClientCreateRow({ onConfirm, onCancel }) {
  const [name, setName] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onConfirm(name)
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 rounded-md border border-[#1D9E75]/40 bg-white dark:bg-white/5 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#1D9E75] min-w-0"
        placeholder="Nom du client"
      />
      <button
        type="button"
        onClick={() => onConfirm(name)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#1D9E75] hover:bg-[#1D9E75]/10 cursor-pointer"
      >
        <CheckIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}

function ClientsSection({ initialClients }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeClientId = searchParams.get('client')

  const [clients, setClients] = useState(initialClients)
  const [expanded, setExpanded] = useState(true)
  const [creating, setCreating] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Keep in sync when layout re-renders with fresh server data
  useEffect(() => { setClients(initialClients) }, [initialClients])

  async function handleCreate(rawName) {
    const nom = rawName.trim()
    setCreating(false)
    if (!nom) return
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom }),
    })
    if (res.ok) {
      const { client } = await res.json()
      setClients(prev => [...prev, client].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
      router.push(`/dashboard/extraction?client=${client.id}`)
      router.refresh()
    } else {
      toast.error("Impossible de créer le client")
    }
  }

  async function handleRename(id) {
    const nom = renameValue.trim()
    setRenamingId(null)
    if (!nom) return
    const res = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, nom }),
    })
    if (res.ok) {
      setClients(prev =>
        prev.map(c => c.id === id ? { ...c, nom } : c)
          .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
      )
      router.refresh()
    } else {
      toast.error("Impossible de renommer le client")
    }
  }

  async function handleDelete(id) {
    setDeleteConfirmId(null)
    const res = await fetch(`/api/clients?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setClients(prev => prev.filter(c => c.id !== id))
      if (activeClientId === id) router.push('/dashboard/extraction')
      router.refresh()
    } else {
      toast.error("Impossible de supprimer le client")
    }
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-1 px-3 mb-1">
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex flex-1 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
        >
          <ChevronRightIcon
            className={`size-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
          Clients
          {clients.length > 0 && (
            <span className="ml-0.5 text-[10px] font-normal">({clients.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(true); setCreating(true) }}
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-[#1D9E75] transition-colors cursor-pointer"
          title="Nouveau client"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      {/* Client list */}
      {expanded && (
        <div className="flex flex-col gap-0.5 pl-2">
          {clients.length === 0 && !creating && (
            <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
              Aucun client — cliquez sur +
            </p>
          )}

          {clients.map(client =>
            renamingId === client.id ? (
              <ClientRenameRow
                key={client.id}
                value={renameValue}
                onChange={setRenameValue}
                onConfirm={() => handleRename(client.id)}
                onCancel={() => setRenamingId(null)}
              />
            ) : deleteConfirmId === client.id ? (
              <div key={client.id} className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
                <p className="text-xs text-red-700 dark:text-red-400 mb-1.5">
                  Supprimer "{client.nom}" ?
                </p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDelete(client.id)}
                    className="flex-1 rounded-md bg-red-500 text-white text-[11px] py-1 hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    Supprimer
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 text-[11px] py-1 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <ClientRow
                key={client.id}
                client={client}
                isActive={activeClientId === client.id}
                onRenameStart={(nom) => { setRenamingId(client.id); setRenameValue(nom) }}
                onDelete={() => setDeleteConfirmId(client.id)}
              />
            )
          )}

          {creating && (
            <ClientCreateRow
              onConfirm={handleCreate}
              onCancel={() => setCreating(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function AppSidebar({ user, cabinet, clients = [], ...props }) {
  const pathname = usePathname()
  const { count: pendingCount } = useNotifications()

  const initials = (user?.name || "U")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const notifActive =
    pathname === "/dashboard/notifications" ||
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
      <SidebarContent className="px-2 pb-2 overflow-y-auto">
        {/* Top nav */}
        <div className="flex flex-col gap-0.5 mt-2">
          {navTop.map((item) => (
            <NavItem key={item.url} item={item} pathname={pathname} />
          ))}
        </div>

        {/* Notifications */}
        <div className="mt-0.5">
          <Link
            href="/dashboard/notifications"
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

        {/* Clients section */}
        <Suspense fallback={null}>
          <ClientsSection initialClients={clients} />
        </Suspense>

        {/* Separator */}
        <div className="my-3 h-px bg-slate-200/60 dark:bg-white/[0.06]" />

        {/* Bottom nav */}
        <div className="flex flex-col gap-0.5">
          {navBottom.map((item) => (
            <NavItem key={item.url} item={item} pathname={pathname} />
          ))}
        </div>

        {/* Admin link — only visible to the admin account */}
        {user?.email === ADMIN_EMAIL && (
          <>
            <div className="my-3 h-px bg-slate-200/60 dark:bg-white/[0.06]" />
            <Link
              href="/admin"
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 border-l-2",
                pathname.startsWith("/admin")
                  ? "border-[#1D9E75] bg-[#1D9E75]/10 text-[#1D9E75]"
                  : "border-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] hover:text-slate-700 dark:hover:text-slate-300",
              ].join(" ")}
            >
              <ShieldIcon className="size-4 shrink-0" />
              <span className="truncate">Admin</span>
              <span className="ml-auto rounded-full bg-[#1D9E75]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#1D9E75]">
                privé
              </span>
            </Link>
          </>
        )}
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
