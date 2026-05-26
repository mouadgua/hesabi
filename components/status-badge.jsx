import { cn } from "@/lib/utils"

const CONFIG = {
  VALIDE: {
    label: "Validé",
    cls: "bg-[#E1F5EE] text-[#085041]",
    dot: "bg-[#1D9E75] dot-pulse",
  },
  A_VERIFIER: {
    label: "À vérifier",
    cls: "bg-[#FAEEDA] text-[#633806]",
    dot: "bg-[#D97706]",
  },
  EN_COURS_IA: {
    label: "En cours",
    cls: "bg-[#E6F1FB] text-[#0C447C]",
    spinner: true,
  },
  A_EXTRAIRE: {
    label: "À extraire",
    cls: "bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
  ERREUR: {
    label: "Erreur",
    cls: "bg-[#FCEBEB] text-[#A32D2D]",
    dot: "bg-[#A32D2D]",
  },
}

export function StatusBadge({ status, className }) {
  const cfg = CONFIG[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-none",
        cfg.cls,
        className
      )}
    >
      {cfg.spinner ? (
        <svg
          className="size-2.5 badge-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : cfg.dot ? (
        <span className={cn("inline-block size-1.5 rounded-full shrink-0", cfg.dot)} />
      ) : null}
      {cfg.label}
    </span>
  )
}
