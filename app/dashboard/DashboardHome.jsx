"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  ScanIcon, CheckCircle2Icon, ClockIcon, LayoutGridIcon,
  UploadIcon, ChevronRightIcon, FileTextIcon, ImageIcon, FileIcon,
  ArrowRightIcon, SparklesIcon, CalendarIcon
} from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"

// ─── Animation Variants ───────────────────────────────────────────────────────
const containerVar = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
}
const itemVar = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}j`
}

function formatDate() {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

function FileTypeIcon({ name }) {
  const ext = (name || "").split(".").pop().toLowerCase()
  if (ext === "pdf") return <FileTextIcon className="size-5 text-[#1D9E75]" />
  if (["jpg", "jpeg", "png", "webp"].includes(ext))
    return <ImageIcon className="size-5 text-teal-500 dark:text-teal-400" />
  return <FileIcon className="size-5 text-slate-400 dark:text-slate-500" />
}

// ─── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <motion.div
      variants={itemVar}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="relative overflow-hidden rounded-2xl border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] p-6 backdrop-blur-xl shadow-sm cursor-default hover:shadow-md transition-shadow"
    >
      {/* Decorative orb */}
      <div className={`absolute -right-4 -top-4 size-24 rounded-full blur-2xl opacity-30 dark:opacity-20 ${iconBg}`} />

      <div className="flex items-center justify-between">
        <div className={`flex size-10 items-center justify-center rounded-xl border border-black/[0.06] dark:border-white/10 ${iconBg} ${iconColor}`}>
          <Icon className="size-5" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
      </div>

      <div className="mt-5">
        <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DashboardHome({ firstName, stats, recentDocs }) {
  const { totalDocs, validatedDocs, pendingDocs, totalModeles } = stats

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVar}
      className="p-6 md:p-10 space-y-10"
    >

      {/* ── Section 1 — Greeting ────────────────────────────────────────── */}
      <motion.div variants={itemVar} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1D9E75]/10 dark:bg-[#1D9E75]/10 border border-[#1D9E75]/20 backdrop-blur-md text-[#1D9E75] text-xs font-semibold shadow-sm">
            <SparklesIcon className="size-3" />
            Dashboard IA
          </div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Ravi de vous revoir,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1D9E75] via-emerald-400 to-teal-300">
              {firstName}
            </span>
          </h2>
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium flex-wrap">
            <CalendarIcon className="size-4 shrink-0" />
            <p className="text-sm capitalize">{formatDate()}</p>
            {pendingDocs > 0 && (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200/60 dark:border-white/10">
                <div className="size-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {pendingDocs} action{pendingDocs > 1 ? "s" : ""} requise{pendingDocs > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>

        <Link href="/dashboard/extraction">
          <Button
            size="lg"
            className="rounded-xl px-6 font-bold shadow-lg shadow-[#1D9E75]/20 transition-all hover:scale-105"
          >
            <UploadIcon className="mr-2 size-5" />
            Nouvelle extraction
          </Button>
        </Link>
      </motion.div>

      {/* ── Section 2 — Metrics ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={ScanIcon}
          iconBg="bg-[#1D9E75]/10 dark:bg-[#1D9E75]/10"
          iconColor="text-[#1D9E75]"
          label="Documents"
          value={totalDocs}
        />
        <MetricCard
          icon={CheckCircle2Icon}
          iconBg="bg-emerald-100 dark:bg-emerald-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
          label="Validés"
          value={validatedDocs}
        />
        <MetricCard
          icon={ClockIcon}
          iconBg="bg-amber-100 dark:bg-amber-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
          label="En attente"
          value={pendingDocs}
        />
        <MetricCard
          icon={LayoutGridIcon}
          iconBg="bg-teal-100 dark:bg-teal-500/10"
          iconColor="text-teal-600 dark:text-teal-400"
          label="Modèles"
          value={totalModeles}
        />
      </div>

      {/* ── Section 3+4 — Activity + Shortcuts ─────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent activity */}
        <motion.div
          variants={itemVar}
          className="lg:col-span-2 rounded-[1.75rem] border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] backdrop-blur-xl overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100/80 dark:border-white/[0.06] px-8 py-5">
            <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">
              Extractions récentes
            </h3>
            <Link
              href="/dashboard/verification"
              className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-[#1D9E75] dark:hover:text-[#1D9E75] transition-colors uppercase tracking-widest"
            >
              Voir tout
            </Link>
          </div>

          {recentDocs.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="mx-auto size-16 rounded-2xl bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center border border-slate-200/60 dark:border-white/[0.07]">
                <FileIcon className="size-8 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
                Aucun document traité
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100/80 dark:divide-white/[0.04]">
              {recentDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/dashboard/verification/${doc.id}`}
                  className="flex items-center gap-5 px-8 py-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-all group cursor-pointer"
                >
                  <div className="size-11 rounded-xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.07] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <FileTypeIcon name={doc.nom_fichier} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-[#1D9E75] dark:group-hover:text-[#1D9E75] transition-colors">
                      {doc.nom_fichier || doc.document_type || "Sans titre"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-wide">
                      {timeAgo(doc.createdAt)}
                    </span>
                    <StatusBadge status={doc.statut} />
                  </div>
                  <ChevronRightIcon className="size-4 text-slate-300 dark:text-slate-700 group-hover:translate-x-1 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-all shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Shortcuts */}
        <motion.div variants={itemVar} className="space-y-4">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1">
            Raccourcis rapides
          </p>

          <Link
            href="/dashboard/extraction"
            className="group block p-6 rounded-[1.75rem] border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] backdrop-blur-xl hover:border-[#1D9E75]/30 dark:hover:border-[#1D9E75]/20 hover:shadow-lg hover:shadow-[#1D9E75]/8 dark:hover:shadow-[#1D9E75]/5 transition-all shadow-sm"
          >
            <div className="size-12 rounded-2xl bg-[#1D9E75]/10 border border-[#1D9E75]/20 flex items-center justify-center text-[#1D9E75] mb-4 group-hover:scale-110 transition-transform">
              <UploadIcon className="size-5" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-white mb-1">Lancer l'IA</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Uploader et extraire les données immédiatement.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#1D9E75] opacity-0 group-hover:opacity-100 transition-opacity">
              Commencer <ArrowRightIcon className="size-3" />
            </div>
          </Link>

          <Link
            href="/dashboard/models"
            className="group block p-6 rounded-[1.75rem] border border-slate-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.04] backdrop-blur-xl hover:border-teal-400/30 dark:hover:border-teal-500/20 hover:shadow-lg hover:shadow-teal-100/40 dark:hover:shadow-teal-900/10 transition-all shadow-sm"
          >
            <div className="size-12 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200/60 dark:border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 group-hover:scale-110 transition-transform">
              <LayoutGridIcon className="size-5" />
            </div>
            <p className="text-base font-bold text-slate-800 dark:text-white mb-1">Mes Modèles</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Gérer les schémas d'extraction JSON personnalisés.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
              Configurer <ArrowRightIcon className="size-3" />
            </div>
          </Link>
        </motion.div>

      </div>
    </motion.div>
  )
}
