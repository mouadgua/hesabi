"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import {
  SparklesIcon, ArrowRightIcon, ZapIcon, DownloadIcon,
  ShieldCheckIcon, MailIcon,
  SunIcon, MoonIcon, FileTextIcon, LayersIcon,
  BrainCircuitIcon,
} from "lucide-react"

import Image from "next/image"
import Aurora from "@/components/reactbits/Aurora"
import BlurText from "@/components/reactbits/BlurText"
import SpotlightCard from "@/components/reactbits/SpotlightCard"
import CountUp from "@/components/reactbits/CountUp"

/* ─── Theme toggle ───────────────────────────────────── */
function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Changer le thème"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-all cursor-pointer backdrop-blur-sm"
    >
      {theme === "dark"
        ? <SunIcon className="size-4 text-amber-300" />
        : <MoonIcon className="size-4 text-slate-600" />
      }
    </button>
  )
}

/* ─── Data ───────────────────────────────────────────── */
const STATS = [
  { to: 15, suffix: "+", label: "Extractions offertes", icon: SparklesIcon },
  { to: 10, prefix: "< ", suffix: "s", label: "Par document", icon: ZapIcon },
  { to: 100, suffix: "%", label: "Données sécurisées", icon: ShieldCheckIcon },
  { to: 3, suffix: "x", label: "Plus rapide qu'à la main", icon: DownloadIcon },
]

const FEATURES = [
  {
    icon: BrainCircuitIcon,
    gradient: "from-[#1D9E75]/20 to-[#1D9E75]/5",
    iconCls: "text-[#1D9E75] bg-[#1D9E75]/15",
    title: "Modèles IA Flexibles",
    desc: "Passez de l'IA Libre à vos propres structures strictes. L'IA s'adapte aux normes de votre cabinet.",
  },
  {
    icon: ZapIcon,
    gradient: "from-amber-500/15 to-amber-500/5",
    iconCls: "text-amber-400 bg-amber-400/15",
    title: "Traitement Asynchrone",
    desc: "Envoyez 100 factures d'un coup. La file d'attente travaille en arrière-plan pendant que vous continuez.",
  },
  {
    icon: DownloadIcon,
    gradient: "from-teal-400/15 to-teal-400/5",
    iconCls: "text-teal-400 bg-teal-400/15",
    title: "Export Intelligent",
    desc: "Excel multi-onglets séparant entêtes et détails, ou ZIP complet. Format prêt pour votre logiciel.",
  },
  {
    icon: LayersIcon,
    gradient: "from-purple-400/15 to-purple-400/5",
    iconCls: "text-purple-400 bg-purple-400/15",
    title: "Gestion Multi-Clients",
    desc: "Organisez vos dossiers par client. Chaque cabinet gère ses données en toute indépendance.",
  },
  {
    icon: ShieldCheckIcon,
    gradient: "from-rose-400/15 to-rose-400/5",
    iconCls: "text-rose-400 bg-rose-400/15",
    title: "Données Sécurisées",
    desc: "Hébergement chiffré, aucune donnée partagée avec des tiers. Votre cabinet reste souverain.",
  },
  {
    icon: FileTextIcon,
    gradient: "from-sky-400/15 to-sky-400/5",
    iconCls: "text-sky-400 bg-sky-400/15",
    title: "Tout Type de Document",
    desc: "Factures, relevés bancaires, bons de commande — Hesabi lit et structure n'importe quel format.",
  },
]

const STEPS = [
  {
    num: "01",
    icon: FileTextIcon,
    title: "Uploadez vos documents",
    desc: "Glissez-déposez vos factures ou images. Upload en masse et dossiers entiers supportés.",
  },
  {
    num: "02",
    icon: BrainCircuitIcon,
    title: "L'IA extrait les données",
    desc: "Gemini 2.5 analyse chaque document et structure les informations selon votre modèle personnalisé.",
  },
  {
    num: "03",
    icon: DownloadIcon,
    title: "Vérifiez et exportez",
    desc: "Corrigez en un clic, puis exportez en Excel ou CSV, prêt pour votre logiciel comptable.",
  },
]

/* ─── Page ───────────────────────────────────────────── */
export default function LandingPage() {
  const pageRef = useRef(null)
  const [heroReady, setHeroReady] = useState(false)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)
    const ctx = gsap.context(() => {

      /* Hero badge */
      gsap.fromTo(".anim-badge",
        { opacity: 0, y: -16, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)", delay: 0.2 }
      )

      /* Floating badges inside hero (triggered after BlurText) */
      /* Product mockup reveal */
      gsap.fromTo(".product-mockup",
        { opacity: 0, y: 80, scale: 0.93, rotateX: 10, transformPerspective: 1200 },
        {
          opacity: 1, y: 0, scale: 1, rotateX: 0, transformPerspective: 1200,
          duration: 1.3, ease: "power3.out",
          scrollTrigger: { trigger: ".product-section", start: "top 80%" },
        }
      )
      gsap.fromTo(".product-hint",
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.7, ease: "power2.out",
          scrollTrigger: { trigger: ".product-section", start: "top 85%" },
        }
      )

      /* Stats */
      gsap.fromTo(".stat-card",
        { opacity: 0, y: 40, scale: 0.95 },
        {
          opacity: 1, y: 0, scale: 1, duration: 0.7, stagger: 0.12, ease: "power3.out",
          scrollTrigger: { trigger: ".stats-row", start: "top 85%" },
        }
      )

      /* Section headers */
      gsap.utils.toArray(".section-hdr").forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" },
          }
        )
      })

      /* Feature cards */
      gsap.fromTo(".feat-card",
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "power2.out",
          scrollTrigger: { trigger: ".feat-grid", start: "top 78%" },
        }
      )

      /* Steps */
      gsap.fromTo(".step-item",
        { opacity: 0, x: -40 },
        {
          opacity: 1, x: 0, duration: 0.7, stagger: 0.2, ease: "power2.out",
          scrollTrigger: { trigger: ".steps-row", start: "top 80%" },
        }
      )

      /* CTA */
      gsap.fromTo(".cta-box",
        { opacity: 0, scale: 0.94, y: 20 },
        {
          opacity: 1, scale: 1, y: 0, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: ".cta-box", start: "top 85%" },
        }
      )

      /* Contact */
      gsap.fromTo(".contact-box",
        { opacity: 0, y: 40 },
        {
          opacity: 1, y: 0, duration: 0.9, ease: "power2.out",
          scrollTrigger: { trigger: ".contact-box", start: "top 85%" },
        }
      )

    }, pageRef)
    return () => ctx.revert()
  }, [])

  /* Animate sub + CTAs after BlurText completes */
  useEffect(() => {
    if (!heroReady) return
    gsap.fromTo(".anim-sub",
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" }
    )
    gsap.fromTo(".anim-cta",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power3.out", delay: 0.15 }
    )
  }, [heroReady])

  return (
    <div ref={pageRef} className="min-h-screen bg-[#f5fbf7] dark:bg-[#060d09] text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden selection:bg-[#1D9E75]/20">

      {/* ── NAVBAR ─────────────────────────────────── */}
      <nav className="fixed top-4 inset-x-0 mx-auto max-w-6xl z-50 px-4">
        <div className="bg-white/20 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/40 dark:border-white/[0.08] shadow-lg dark:shadow-black/40 rounded-full h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1D9E75] shadow-lg shadow-[#1D9E75]/40">
              <SparklesIcon className="size-4 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Hesabi</span>
            <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1D9E75] bg-[#1D9E75]/10 rounded-full border border-[#1D9E75]/20">Bêta</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#contact" className="hidden md:block text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] dark:hover:text-[#1D9E75] transition-colors">Contact</a>
            <ThemeToggle />
            <Link href="/login">
              <button className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-[#1D9E75]/30 transition-all hover:scale-105 cursor-pointer">
                Connexion <ArrowRightIcon className="inline size-3.5 ml-1" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pb-24">

        {/* Aurora WebGL background */}
        <div className="absolute inset-0 z-0">
          <Aurora
            colorStops={["#1D9E75", "#047a55", "#0a3d2d"]}
            amplitude={1.3}
            blend={0.65}
            speed={0.6}
          />
        </div>

        {/* Gradient overlays for depth and readability */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-white/70 via-white/30 to-white/90 dark:from-[#060d09]/75 dark:via-[#060d09]/40 dark:to-[#060d09]" />
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_80%_50%_at_50%_60%,transparent,white_90%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_60%,transparent,#060d09_90%)]" />

        {/* Grid pattern */}
        <div className="absolute inset-0 z-[2] bg-[linear-gradient(to_right,#1D9E7508_1px,transparent_1px),linear-gradient(to_bottom,#1D9E7508_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_40%,transparent_100%)]" />

        {/* Hero content */}
        <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto w-full">

          {/* Beta badge */}
          <div className="anim-badge flex justify-center mb-8" style={{ opacity: 0 }}>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1D9E75]/10 dark:bg-[#1D9E75]/15 border border-[#1D9E75]/30 text-[#1D9E75] dark:text-[#4ecba0] text-sm font-semibold backdrop-blur-sm shadow-sm shadow-[#1D9E75]/20">
              <SparklesIcon className="size-3.5" />
              Bêta Privée — 15 Extractions Offertes
            </span>
          </div>

          {/* BlurText headline */}
          <BlurText
            text="Votre saisie comptable, automatisée par l'IA."
            delay={90}
            animateBy="words"
            direction="top"
            stepDuration={0.4}
            onAnimationComplete={() => setHeroReady(true)}
            className="text-4xl sm:text-5xl lg:text-[4.5rem] xl:text-[5rem] font-black tracking-tight leading-[1.05] text-slate-900 dark:text-white justify-center mb-8"
          />

          {/* Subtitle */}
          <p className="anim-sub text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10" style={{ opacity: 0 }}>
            Hesabi utilise <strong className="text-slate-800 dark:text-slate-200">Gemini 2.5</strong> pour lire, comprendre et structurer vos factures et relevés en quelques secondes. Fini les saisies manuelles interminables.
          </p>

          {/* CTAs */}
          <div className="anim-cta flex flex-col sm:flex-row items-center justify-center gap-4" style={{ opacity: 0 }}>
            <Link href="/register">
              <button className="group bg-[#1D9E75] hover:bg-[#0F6E56] text-white rounded-full h-14 px-8 text-base font-bold shadow-[0_8px_32px_rgba(29,158,117,0.4)] transition-all hover:scale-105 hover:shadow-[0_12px_40px_rgba(29,158,117,0.5)] cursor-pointer">
                Essayer la Bêta gratuite
                <ArrowRightIcon className="inline size-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <a href="#contact">
              <button className="rounded-full h-14 px-8 text-base font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer">
                Nous contacter
              </button>
            </a>
          </div>

        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 z-[3] bg-gradient-to-t from-[#f5fbf7] dark:from-[#060d09] to-transparent" />
      </section>

      {/* ── PRODUCT SCREENSHOT ─────────────────────── */}
      <section className="product-section relative z-10 pt-4 pb-24">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">

          {/* Label */}
          <div className="product-hint text-center mb-10" style={{ opacity: 0 }}>
            <span className="inline-flex items-center gap-3 text-xs font-semibold text-slate-400 dark:text-slate-600 uppercase tracking-widest">
              <span className="w-12 h-px bg-gradient-to-r from-transparent to-slate-300 dark:to-slate-700" />
              Aperçu de la plateforme
              <span className="w-12 h-px bg-gradient-to-l from-transparent to-slate-300 dark:to-slate-700" />
            </span>
          </div>

          {/* Main screenshot — extraction view */}
          <div
            className="product-mockup rounded-2xl overflow-hidden border border-slate-200/60 dark:border-white/[0.08] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.22)] dark:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.7)]"
            style={{ opacity: 0 }}
          >
            {/* Browser chrome */}
            <div className="bg-slate-100/90 dark:bg-[#0d1a11] border-b border-slate-200 dark:border-white/[0.06] px-5 py-3.5 flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white dark:bg-white/[0.06] rounded-lg h-7 w-72 flex items-center px-3 gap-2 border border-slate-200/60 dark:border-white/[0.06]">
                  <div className="w-2 h-2 rounded-full bg-[#1D9E75]/60 shrink-0" />
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">app.hesabi.ma/dashboard/extraction</span>
                </div>
              </div>
            </div>

            {/* Real screenshot */}
            <div className="relative w-full">
              <Image
                src={dark ? "/extraction.png" : "/extraction-white.png"}
                alt="Hesabi — Interface d'extraction IA"
                width={2400}
                height={1400}
                className="w-full h-auto block"
                priority
              />
            </div>
          </div>

          {/* Green glow under */}
          <div className="h-16 -mt-8 blur-[60px] bg-[#1D9E75]/15 rounded-full mx-24 pointer-events-none" />

          {/* Two secondary shots */}
          <div className="grid grid-cols-2 gap-5 mt-5">
            {[
              { src: dark ? "/vue-ensemble.png" : "/vue-ensemble-white.png", alt: "Vue d'ensemble — Portefeuille clients", url: "app.hesabi.ma/dashboard" },
              { src: dark ? "/models.png" : "/models-white.png", alt: "Atelier des Modèles", url: "app.hesabi.ma/dashboard/models" },
            ].map(({ src, alt, url }) => (
              <div key={src} className="rounded-xl overflow-hidden border border-slate-200/60 dark:border-white/[0.07] shadow-lg dark:shadow-black/30">
                <div className="bg-slate-100/90 dark:bg-[#0d1a11] border-b border-slate-200 dark:border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <div className="bg-white dark:bg-white/[0.06] rounded h-5 flex-1 max-w-[200px] mx-auto flex items-center px-2 gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]/50 shrink-0" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{url}</span>
                  </div>
                </div>
                <Image
                  src={src}
                  alt={alt}
                  width={1200}
                  height={800}
                  className="w-full h-auto block"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────── */}
      <section className="py-16 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="stats-row grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(({ to, prefix, suffix, label, icon: Icon }) => (
              <div
                key={label}
                className="stat-card text-center p-6 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-white/[0.1] transition-all"
                style={{ opacity: 0 }}
              >
                <Icon className="size-5 text-[#1D9E75] mx-auto mb-3" />
                <p className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  <CountUp to={to} from={0} prefix={prefix ?? ""} suffix={suffix ?? ""} duration={2} delay={0.3} />
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1.5 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────── */}
      <section className="py-24 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="section-hdr text-center mb-14" style={{ opacity: 0 }}>
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#1D9E75] bg-[#1D9E75]/10 rounded-full border border-[#1D9E75]/20 mb-4">Fonctionnalités</span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
              La comptabilité de demain, aujourd'hui.
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
              Un flux de travail repensé pour absorber vos pics d'activité sans effort.
            </p>
          </div>

          <div className="feat-grid grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, gradient, iconCls, title, desc }) => (
              <SpotlightCard
                key={title}
                spotlightColor="rgba(29,158,117,0.12)"
                className={`feat-card p-6 rounded-2xl bg-white dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.06] shadow-sm hover:shadow-lg dark:hover:border-white/[0.1] hover:border-slate-200 transition-all cursor-default`}
                style={{ opacity: 0 }}
              >
                {/* Subtle gradient bg */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconCls}`}>
                  <Icon className="size-5" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────── */}
      <section className="py-24 relative z-10">
        {/* Section background */}
        <div className="absolute inset-0 bg-slate-50/80 dark:bg-white/[0.015]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="section-hdr text-center mb-14" style={{ opacity: 0 }}>
            <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#1D9E75] bg-[#1D9E75]/10 rounded-full border border-[#1D9E75]/20 mb-4">Processus</span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              3 étapes pour passer de vos documents bruts à des données exploitables.
            </p>
          </div>

          <div className="steps-row grid md:grid-cols-3 gap-10 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-6 left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-px bg-gradient-to-r from-transparent via-[#1D9E75]/30 to-transparent z-0" />

            {STEPS.map(({ num, icon: Icon, title, desc }) => (
              <div key={num} className="step-item relative z-10" style={{ opacity: 0 }}>
                <div className="flex flex-col items-start md:items-center md:text-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1D9E75] to-teal-500 flex items-center justify-center shadow-lg shadow-[#1D9E75]/30">
                      <Icon className="size-5 text-white" />
                    </div>
                    {/* Glow ring */}
                    <div className="absolute inset-0 rounded-2xl bg-[#1D9E75]/20 blur-md -z-10 scale-125" />
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-[#1D9E75] tracking-[0.15em] uppercase mb-1.5">{num}</p>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="cta-box relative rounded-3xl overflow-hidden shadow-2xl" style={{ opacity: 0 }}>
            {/* Dark gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0d5c44] via-[#0a3d2d] to-[#060d09]" />
            {/* Aurora-like glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(29,158,117,0.35)_0%,transparent_70%)]" />
            {/* Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(29,158,117,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(29,158,117,0.06)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem]" />
            {/* Border glow */}
            <div className="absolute inset-0 rounded-3xl border border-[#1D9E75]/25" />

            <div className="relative z-10 p-12 lg:p-16 text-center">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#4ecba0] bg-[#1D9E75]/15 rounded-full border border-[#1D9E75]/30 mb-6">
                Bêta ouverte aux premiers cabinets
              </span>
              <h2 className="text-3xl lg:text-5xl font-bold text-white mb-5 tracking-tight leading-tight">
                Aidez-nous à forger<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#1D9E75] to-teal-300">
                  l'outil parfait.
                </span>
              </h2>
              <p className="text-[#a8dcc9] max-w-xl mx-auto mb-10 leading-relaxed">
                En rejoignant la bêta, bénéficiez de{" "}
                <strong className="text-white">15 extractions IA offertes</strong>.
                {" "}Testez avec vos documents les plus complexes.
              </p>
              <Link href="/register">
                <button className="group bg-white hover:bg-[#E1F5EE] text-[#0F6E56] rounded-full h-14 px-10 text-base font-bold shadow-xl transition-all hover:scale-105 hover:shadow-2xl cursor-pointer">
                  Démarrer mes extractions
                  <ArrowRightIcon className="inline size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT ────────────────────────────────── */}
      <section id="contact" className="py-24 relative z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="contact-box rounded-3xl bg-white dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.07] shadow-xl dark:shadow-black/40 overflow-hidden text-center" style={{ opacity: 0 }}>
            <div className="h-1 w-full bg-gradient-to-r from-[#1D9E75] via-teal-400 to-[#1D9E75]" />
            <div className="p-10 lg:p-14">
              <span className="inline-block px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#1D9E75] bg-[#1D9E75]/10 rounded-full border border-[#1D9E75]/20 mb-6">Contact</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white mb-4 leading-tight">
                Parlons de votre <span className="text-[#1D9E75]">cabinet</span>.
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed max-w-sm mx-auto">
                Questions sur la Bêta ou démonstration personnalisée ? Notre équipe vous répond sous 24h.
              </p>
              <div className="flex justify-center">
                <a href="mailto:mouadguarraz@gmail.com" className="group flex items-center gap-3 px-7 py-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] hover:border-[#1D9E75]/50 hover:bg-[#1D9E75]/5 transition-all">
                  <div className="w-10 h-10 rounded-xl bg-[#1D9E75]/10 flex items-center justify-center text-[#1D9E75] group-hover:bg-[#1D9E75] group-hover:text-white transition-all shrink-0">
                    <MailIcon className="size-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Email</p>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#1D9E75] transition-colors">
                      mouadguarraz@gmail.com
                    </span>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────── */}
      <footer className="border-t border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] backdrop-blur-md relative z-10 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1D9E75] shadow-md shadow-[#1D9E75]/30">
              <SparklesIcon className="size-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white tracking-tight">Hesabi</span>
          </div>
          <p className="text-slate-400 dark:text-slate-500 text-sm">
            © {new Date().getFullYear()} Hesabi. Tous droits réservés. Bêta Privée.
          </p>
          <div className="flex gap-6 text-sm font-semibold text-slate-400 dark:text-slate-500">
            <a href="#contact" className="hover:text-[#1D9E75] transition-colors">Contact</a>
            <a href="#" className="hover:text-[#1D9E75] transition-colors">Mentions légales</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
