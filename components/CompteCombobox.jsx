"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { CheckIcon, ChevronsUpDownIcon, SparklesIcon, SearchIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * Searchable combobox for plan comptable account selection.
 * Uses Radix Popover (Portal-based) to escape overflow/backdrop-filter ancestors.
 *
 * Props:
 *   comptes          – array of CompteComptable objects
 *   value            – currently selected compte id (string | null)
 *   onChange         – (id: string | null) => void
 *   suggestionId     – id of the CabinetAccountPreference-suggested compte (optional)
 *   placeholder      – string
 *   disabled         – bool
 */
export default function CompteCombobox({
  comptes = [],
  value,
  onChange,
  suggestionId,
  placeholder = "Sélectionner un compte...",
  disabled = false,
}) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)

  // Focus search input whenever the popover opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setSearch('')
    }
  }, [open])

  const selected = useMemo(
    () => comptes.find(c => c.id === value) ?? null,
    [comptes, value]
  )

  const { cabinet, standard } = useMemo(() => {
    const q = search.toLowerCase()
    const all = comptes.filter(c =>
      !q || c.code.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q)
    )
    return {
      cabinet:  all.filter(c => !c.is_standard),
      standard: all.filter(c => c.is_standard),
    }
  }, [comptes, search])

  function select(id) {
    onChange(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      {/* Trigger */}
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className={cn(
            "inline-flex w-full items-center justify-between rounded-lg border border-black/[0.12] dark:border-white/[0.12]",
            "bg-transparent px-3 h-8 text-[13px] font-medium transition-all outline-none",
            "hover:bg-gray-50 dark:hover:bg-white/[0.06]",
            "focus-visible:ring-2 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:opacity-50",
            selected ? "text-slate-800 dark:text-slate-200" : "text-slate-400"
          )}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-mono">{selected.code}</span>
                {' — '}{selected.libelle}
              </>
            ) : placeholder}
          </span>
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      {/* Dropdown — rendered in a portal, escapes all overflow/backdrop-filter parents */}
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/[0.10] bg-white dark:bg-slate-900 shadow-xl w-[var(--radix-popover-trigger-width)] max-w-none"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Search */}
        <div className="p-2 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              ref={inputRef}
              className="pl-8 h-8 text-sm"
              placeholder="Rechercher (code ou libellé)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto" role="listbox">
          {/* Suggestion */}
          {suggestionId && !search && (() => {
            const sug = comptes.find(c => c.id === suggestionId)
            if (!sug) return null
            return (
              <div>
                <div className="px-3 pt-2 pb-1">
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#1D9E75] uppercase tracking-wide">
                    <SparklesIcon className="w-3 h-3" /> Suggéré
                  </span>
                </div>
                <Option compte={sug} selected={value === sug.id} onSelect={select} />
                <div className="mx-3 border-t border-slate-100 dark:border-white/[0.05] my-1" />
              </div>
            )
          })()}

          {/* Cabinet custom accounts */}
          {cabinet.length > 0 && (
            <Group label="Comptes cabinet">
              {cabinet.map(c => (
                <Option key={c.id} compte={c} selected={value === c.id} onSelect={select} />
              ))}
            </Group>
          )}

          {/* CGNC standard accounts */}
          {standard.length > 0 && (
            <Group label="Plan CGNC">
              {standard.map(c => (
                <Option key={c.id} compte={c} selected={value === c.id} onSelect={select} />
              ))}
            </Group>
          )}

          {cabinet.length === 0 && standard.length === 0 && (
            <p className="text-center py-6 text-sm text-slate-400">Aucun résultat</p>
          )}
        </div>

        {/* Clear selection */}
        {value && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] p-1.5">
            <button
              type="button"
              onClick={() => select(null)}
              className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg transition-colors"
            >
              Effacer la sélection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Group({ label, children }) {
  return (
    <div>
      <div className="px-3 pt-2 pb-1">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  )
}

function Option({ compte, selected, onSelect }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(compte.id)}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors",
        "hover:bg-slate-50 dark:hover:bg-white/[0.04]",
        selected && "bg-[#E1F5EE] dark:bg-[#1D9E75]/10"
      )}
    >
      <span className="font-mono text-xs text-slate-500 w-16 shrink-0">{compte.code}</span>
      <span className="flex-1 truncate text-slate-700 dark:text-slate-200">{compte.libelle}</span>
      {selected && <CheckIcon className="w-3.5 h-3.5 text-[#1D9E75] shrink-0" />}
    </button>
  )
}
