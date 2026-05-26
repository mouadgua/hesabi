"use client"

import { useRef, useEffect } from "react"

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(29,158,117,0.15)",
}) {
  const divRef = useRef(null)

  useEffect(() => {
    const id = "spotlight-card-styles"
    if (document.getElementById(id)) return
    const style = document.createElement("style")
    style.id = id
    style.textContent = `
      .spotlight-card {
        position: relative;
        overflow: hidden;
      }
      .spotlight-card::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(
          circle at var(--sx, 50%) var(--sy, 50%),
          var(--sc, rgba(29,158,117,0.15)),
          transparent 60%
        );
        opacity: 0;
        transition: opacity 0.4s ease;
        pointer-events: none;
        z-index: 1;
        border-radius: inherit;
      }
      .spotlight-card:hover::before { opacity: 1; }
      .spotlight-card > * { position: relative; z-index: 2; }
    `
    document.head.appendChild(style)
  }, [])

  const handleMouseMove = (e) => {
    const rect = divRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    divRef.current.style.setProperty("--sx", `${x}px`)
    divRef.current.style.setProperty("--sy", `${y}px`)
    divRef.current.style.setProperty("--sc", spotlightColor)
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
    >
      {children}
    </div>
  )
}
