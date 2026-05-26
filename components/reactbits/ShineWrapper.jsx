"use client"

export default function ShineWrapper({ children, className = "", borderRadius = "rounded-md" }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${borderRadius} ${className}`}>
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%)",
          backgroundSize: "200% 100%",
          animation: "shine-sweep 2.2s linear infinite",
        }}
      />
    </span>
  )
}
