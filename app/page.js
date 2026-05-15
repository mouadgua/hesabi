"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input" // NOUVEL IMPORT
import { Textarea } from "@/components/ui/textarea" // NOUVEL IMPORT
import {
  FileTextIcon, PlayIcon, DownloadIcon, FolderIcon,
  SparklesIcon, ArrowRightIcon, BrainCircuitIcon,
  MessageSquareIcon, ShieldCheckIcon, ZapIcon, CheckCircle2Icon, Badge,
  MailIcon, MapPinIcon, SendIcon // NOUVELLES ICONES
} from "lucide-react"
import CardSwap, { Card } from '@/components/CardSwap' // <-- N'oublie pas l'import de Card ici

// --- Variantes Framer Motion ---
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
}

const floatingAnim = {
  animate: {
    y: [0, -15, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" }
  }
}

export default function LandingPage() {
  // FONCTION DE SCROLL FLUIDE VERS LE CONTACT
  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#fafcff] text-slate-800 font-sans selection:bg-indigo-200 overflow-x-hidden">

      {/* EFFETS DE FOND FUTURISTES (Light Theme) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-300/30 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-200/30 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] rounded-full bg-emerald-200/20 blur-[150px]" />
        {/* Grille subtile superposée */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* NAVBAR GLASSMORPHISM */}
      <motion.nav
        initial={{ y: -100 }} animate={{ y: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-6 inset-x-0 mx-auto max-w-6xl z-50 px-4 sm:px-6"
      >
        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 p-2 rounded-xl shadow-lg shadow-indigo-200/50">
              <BrainCircuitIcon className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
              Fiduciaire Atlas
            </span>
            <span className="ml-2 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/80 rounded-full border border-indigo-200/50">
              Bêta
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={scrollToContact} className="hidden md:block text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors">
              Contact
            </button>
            <Link href="/dashboard">
              <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-6 shadow-md transition-all hover:scale-105 hover:shadow-xl hover:shadow-slate-900/20">
                Connexion <ArrowRightIcon className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* HERO SECTION (SPLIT LAYOUT) */}
      <section className="relative pt-40 pb-20 lg:pt-52 lg:pb-32 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

            {/* PARTIE GAUCHE : TEXTE & CTA */}
            <motion.div
              initial="hidden" animate="visible" variants={staggerContainer}
              className="space-y-8 text-center lg:text-left"
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-indigo-100 shadow-sm text-indigo-700 text-sm font-semibold">
                <SparklesIcon className="w-4 h-4 text-amber-400" /> Bêta Privée - 15 Extractions Offertes
              </motion.div>

              <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1]">
                Votre saisie comptable, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500">
                  automatisée par l'IA.
                </span>
              </motion.h1>

              <motion.p variants={fadeUp} className="text-lg text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Fiduciaire Atlas utilise Gemini 2.5 pour lire, comprendre et structurer vos factures et relevés en quelques secondes. Fini les saisies manuelles interminables.
              </motion.p>

              <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Link href="/dashboard">
                  <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-full h-14 px-8 text-lg shadow-[0_8px_30px_rgb(79,70,229,0.3)] transition-all hover:scale-105">
                    Essayer la Bêta gratuite
                  </Button>
                </Link>
                {/* BOUTON CONTACT AU LIEU DE DÉMO */}
                <Button 
                  size="lg" 
                  variant="ghost" 
                  onClick={scrollToContact}
                  className="rounded-full h-14 px-8 text-lg font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Nous contacter <MailIcon className="w-5 h-5 ml-2 text-indigo-500" />
                </Button>
              </motion.div>
            </motion.div>

            {/* PARTIE DROITE : COMPOSANT REACTBITS SANS LE FOND */}
            <motion.div
              variants={floatingAnim} animate="animate"
              // ON GARDE TES MODIFICATIONS DE MARGE : -mt-40 lg:-mt-70
              className="relative w-full h-[400px] sm:h-[500px] lg:h-[600px] flex items-center justify-center perspective-[1000px] -mt-40 lg:-mt-70"
            >

              <CardSwap
                width={650}
                height={450}
                cardDistance={45}
                verticalDistance={55}
                delay={4000}
                pauseOnHover={true}
              >
                {/* CAPTURE D'ÉCRAN 1 */}
                <Card className="p-0 overflow-hidden border-[6px] border-white/90 shadow-[0_20px_60px_rgb(0,0,0,0.15)] rounded-2xl bg-slate-100 flex items-center justify-center">
                  <img src="/dashboard-shot-1.png" alt="Dashboard" className="w-full h-full object-cover object-left-top" />
                </Card>

                {/* CAPTURE D'ÉCRAN 2 */}
                <Card className="p-0 overflow-hidden border-[6px] border-white/90 shadow-[0_20px_60px_rgb(0,0,0,0.15)] rounded-2xl bg-slate-100 flex items-center justify-center">
                  <img src="/dashboard-shot-2.png" alt="Extraction IA" className="w-full h-full object-cover object-left-top" />
                </Card>

                {/* CAPTURE D'ÉCRAN 3 */}
                <Card className="p-0 overflow-hidden border-[6px] border-white/90 shadow-[0_20px_60px_rgb(0,0,0,0.15)] rounded-2xl bg-slate-100 flex items-center justify-center">
                  <img src="/dashboard-shot-3.png" alt="Exportation" className="w-full h-full object-cover object-left-top" />
                </Card>
              </CardSwap>

              {/* LE BADGE VERT */}
              <motion.div animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="absolute top-28 left-0 lg:-left-4 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl border border-white flex items-center gap-3 z-10">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2Icon className="w-5 h-5 text-emerald-600" /></div>
                <div className="space-y-1"><div className="h-2 w-12 bg-slate-200 rounded-full"></div><div className="h-2 w-8 bg-slate-200 rounded-full"></div></div>
              </motion.div>

              {/* LE BADGE VIOLET */}
              <motion.div animate={{ y: [10, -10, 10], rotate: [0, -5, 0] }} transition={{ duration: 5, repeat: Infinity }} className="absolute bottom-16 right-0 lg:-right-4 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl shadow-xl border border-white flex items-center gap-3 z-10">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><SparklesIcon className="w-5 h-5 text-indigo-600" /></div>
                <div className="space-y-1"><div className="h-2 w-16 bg-slate-200 rounded-full"></div><div className="h-2 w-10 bg-slate-200 rounded-full"></div></div>
              </motion.div>

            </motion.div>

          </div>
        </div>
      </section>

      {/* FEATURES SECTION (GLASSMORPHISM CARDS) */}
      <section className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl lg:text-4xl font-extrabold text-slate-900 mb-4">La comptabilité de demain, aujourd'hui.</h2>
            <p className="text-slate-500 font-medium max-w-2xl mx-auto text-lg">Un flux de travail repensé pour absorber vos pics d'activité sans effort.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(99,102,241,0.1)] transition-all group"
            >
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 group-hover:scale-110 transition-transform">
                <BrainCircuitIcon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Modèles d'IA Flexibles</h3>
              <p className="text-slate-500 leading-relaxed">Passez de l'IA Libre à vos propres structures JSON strictes. L'intelligence artificielle s'adapte à vos normes du cabinet.</p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(56,189,248,0.1)] transition-all group"
            >
              <div className="w-14 h-14 bg-cyan-50 rounded-2xl flex items-center justify-center mb-6 text-cyan-600 group-hover:scale-110 transition-transform">
                <ZapIcon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Traitement Asynchrone</h3>
              <p className="text-slate-500 leading-relaxed">Envoyez 100 factures d'un coup. Notre file d'attente travaille en arrière-plan pendant que vous continuez à naviguer.</p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(16,185,129,0.1)] transition-all group"
            >
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                <DownloadIcon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Export Intelligent</h3>
              <p className="text-slate-500 leading-relaxed">Téléchargez un ZIP complet ou un fichier Excel multi-onglets séparant parfaitement entêtes et lignes de détails.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SECTION CONTACT AJOUTÉE */}
      <section id="contact" className="py-24 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="grid lg:grid-cols-2 gap-16 items-start bg-white/40 backdrop-blur-2xl rounded-[3rem] p-8 lg:p-16 border border-white shadow-[0_8px_40px_rgb(0,0,0,0.06)]"
          >
            {/* Infos de gauche */}
            <div className="space-y-8">
              <div>
                <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-6">
                  Parlons de votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">cabinet</span>.
                </h2>
                <p className="text-lg text-slate-500 font-medium leading-relaxed">
                  Vous avez des questions sur la Bêta ou vous souhaitez une démonstration personnalisée pour votre équipe ? Notre équipe technique vous répond sous 24h.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <MailIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Email</p>
                    <p className="font-bold text-slate-700">contact@atlas-ia.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-all shadow-sm">
                    <MapPinIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Localisation</p>
                    <p className="font-bold text-slate-700">Casablanca, Maroc</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulaire de droite */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 border border-white shadow-xl">
              <form className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 ml-1">Nom complet</label>
                    <Input placeholder="Jean Dupont" className="rounded-xl border-slate-200 bg-slate-50/50 h-12 focus:ring-indigo-500 transition-shadow" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 ml-1">Email pro</label>
                    <Input type="email" placeholder="jean@cabinet.com" className="rounded-xl border-slate-200 bg-slate-50/50 h-12 transition-shadow" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 ml-1">Sujet</label>
                  <Input placeholder="Demande d'accès Bêta" className="rounded-xl border-slate-200 bg-slate-50/50 h-12 transition-shadow" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 ml-1">Message</label>
                  <Textarea placeholder="Comment pouvons-nous vous aider ?" className="rounded-xl border-slate-200 bg-slate-50/50 min-h-[120px] transition-shadow resize-none" />
                </div>
                <Button className="w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white rounded-xl h-12 font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] mt-2">
                  Envoyer le message <SendIcon className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA BETA SECTION */}
      <section className="py-24 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
            className="relative rounded-[3rem] bg-gradient-to-br from-indigo-900 to-slate-900 overflow-hidden shadow-2xl p-12 lg:p-20 text-center"
          >
            {/* Effets lumineux dans le fond sombre */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/30 via-transparent to-transparent pointer-events-none" />

            <Badge className="bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-400/30 px-4 py-1.5 text-sm mb-8">
              Bêta ouverte aux premiers cabinets
            </Badge>

            <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
              Aidez-nous à forger l'outil parfait.
            </h2>

            <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              En rejoignant la bêta aujourd'hui, bénéficiez de <strong className="text-white">15 extractions IA offertes</strong>. Testez le système avec vos factures les plus complexes et partagez vos retours.
            </p>

            <Link href="/dashboard" className="inline-block">
              <Button size="lg" className="bg-white hover:bg-slate-100 text-indigo-900 rounded-full h-14 px-10 text-lg font-bold shadow-xl hover:scale-105 transition-all">
                Démarrer mes extractions <ArrowRightIcon className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200/50 bg-white/50 backdrop-blur-md relative z-10 py-10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <BrainCircuitIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">Fiduciaire Atlas</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">
            © {new Date().getFullYear()} Tous droits réservés. Bêta Privée.
          </p>
          <div className="flex gap-6 text-sm font-semibold text-slate-500">
            <a href="#" className="hover:text-indigo-600 transition-colors">Mentions Légales</a>
            <button onClick={scrollToContact} className="hover:text-indigo-600 transition-colors">Faire un retour</button>
          </div>
        </div>
      </footer>

    </div>
  )
}