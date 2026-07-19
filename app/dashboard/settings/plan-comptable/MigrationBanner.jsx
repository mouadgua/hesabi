"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon, AlertTriangleIcon, ArrowRightIcon } from "lucide-react"

const SQL_PREVIEW = `CREATE TABLE "CompteComptable" (...);
CREATE TABLE "DocumentCompteComptable" (...);
CREATE TABLE "CabinetAccountPreference" (...);`

const STEPS = [
  { n: 1, label: "Ouvrez Supabase", detail: "Dashboard → SQL Editor" },
  { n: 2, label: "Copiez le fichier SQL", detail: "prisma/add_plan_comptable.sql" },
  { n: 3, label: "Cliquez sur Run", detail: "Puis rechargez cette page" },
]

export default function MigrationBanner({ sqlPath }) {
  const [copied, setCopied] = useState(false)

  async function copySQL() {
    try {
      const res = await fetch('/api/admin/migration-sql')
      const text = res.ok ? await res.text() : sqlPath
      await navigator.clipboard.writeText(text)
    } catch {
      await navigator.clipboard.writeText(sqlPath)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-5 pb-4">
        <div className="mt-0.5 p-2 rounded-lg bg-amber-100 dark:bg-amber-500/10 shrink-0">
          <AlertTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <p className="font-semibold text-sm text-amber-900 dark:text-amber-300">Migration SQL requise</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
            Les tables du plan comptable n'existent pas encore dans votre base de données Supabase.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 pb-4">
        <div className="flex items-center gap-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-4">
              <div className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.n}
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-300">{s.label}</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-500 font-mono">{s.detail}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && <ArrowRightIcon className="w-3.5 h-3.5 text-amber-300 dark:text-amber-600 shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* SQL file + copy button */}
      <div className="mx-5 mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-white/60 dark:bg-black/10 px-4 py-3">
        <code className="text-xs font-mono text-amber-800 dark:text-amber-300 truncate">
          {sqlPath}
        </code>
        <button
          onClick={copySQL}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors shrink-0"
        >
          {copied
            ? <><CheckIcon className="w-3.5 h-3.5 text-emerald-600" /> Copié !</>
            : <><CopyIcon className="w-3.5 h-3.5" /> Copier le chemin</>
          }
        </button>
      </div>
    </div>
  )
}
