import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { reExtractSingleDocumentAction } from '@/app/dashboard/actions'
import { ArrowLeftIcon, FileTextIcon, RefreshCwIcon, SparklesIcon, PlayIcon } from "lucide-react"
import ExportModal from '@/components/export-modal'
import { SubmitButton } from '@/components/ui/submit-button'
import VerificationForm from '../VerificationForm'
import ProcessingView from '@/components/ProcessingView'

export default async function VerificationPage({ params }) {
  const { id } = await params

  if (!id) redirect('/dashboard/extraction')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      client: { include: { cabinet: { include: { templates: true } } } },
      template: true,
    },
  })

  if (!document) return (
    <div className="flex h-[calc(100vh-60px)] items-center justify-center text-slate-400 dark:text-slate-600">
      Document introuvable
    </div>
  )

  const templates = document.client.cabinet.templates

  let signedUrl = null
  if (document.chemin_storage) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.chemin_storage, 3600)
    signedUrl = data?.signedUrl
  }

  const extractedData =
    document.donnees_extraites && typeof document.donnees_extraites === 'object'
      ? document.donnees_extraites
      : {}
  const hasData = Object.keys(extractedData).length > 0

  const hasPreferences =
    hasData && document.document_type
      ? !!(await prisma.userFieldPreference.findUnique({
          where: {
            user_id_document_type: {
              user_id: user.id,
              document_type: document.document_type,
            },
          },
        }))
      : false

  const backHref = document.client_id
    ? `/dashboard/extraction?clientId=${document.client_id}`
    : '/dashboard/extraction'

  return (
    <div className="flex h-[calc(100vh-60px)] flex-col overflow-hidden">

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200/60 dark:border-white/[0.05] bg-white/80 dark:bg-slate-950/60 backdrop-blur-xl px-4 py-3 z-10">
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="rounded-full border border-slate-200/60 dark:border-white/10 h-8 w-8 hover:bg-slate-100 dark:hover:bg-white/[0.06]">
            <ArrowLeftIcon className="size-4 text-slate-600 dark:text-slate-400" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <FileTextIcon className="size-4 text-[#1D9E75]" />
            {document.nom_fichier || "Document"}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {document.client.nom_entreprise} · {document.statut}
          </p>
        </div>
      </div>

      {document.statut === 'EN_COURS_IA' ? (
        <ProcessingView documentId={document.id} />
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden md:flex-row">

          {/* Left — PDF viewer */}
          <div className="h-[45vh] w-full border-b border-slate-200/60 dark:border-white/[0.05] bg-slate-100/50 dark:bg-white/[0.02] p-3 md:h-full md:w-1/2 md:border-b-0 md:border-r">
            <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/10 bg-white dark:bg-slate-900 shadow-inner">
              {signedUrl ? (
                <iframe src={signedUrl} className="absolute inset-0 h-full w-full border-0" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-600 text-sm">
                  Fichier indisponible
                </div>
              )}
            </div>
          </div>

          {/* Right — Extracted data */}
          <div className="flex h-[55vh] w-full flex-col overflow-y-auto p-4 md:h-full md:w-1/2 md:p-6">
            <Card className="flex h-full flex-col rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm">
              <CardHeader className="flex shrink-0 flex-col gap-3 border-b border-slate-100/80 dark:border-white/[0.05] bg-slate-50/50 dark:bg-white/[0.02] pb-4 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {hasData ? "Données extraites" : "Paramètres d'extraction"}
                </CardTitle>

                {hasData && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ExportModal selectedDocs={[document]} />

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <RefreshCwIcon className="size-3.5 mr-1.5" /> Re-extraire
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <SparklesIcon className="size-4 text-[#1D9E75]" />
                            Nouvelle extraction
                          </DialogTitle>
                          <DialogDescription>
                            Sélectionnez un modèle pour écraser les données actuelles.
                          </DialogDescription>
                        </DialogHeader>
                        <form action={reExtractSingleDocumentAction} className="space-y-4 pt-4">
                          <input type="hidden" name="documentId" value={document.id} />
                          <Select name="template_id" required defaultValue="NO_MODEL">
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder="Choisir un modèle…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Options</SelectLabel>
                                <SelectItem value="NO_MODEL" className="font-medium text-[#1D9E75]">
                                  ✨ IA Libre
                                </SelectItem>
                                <SelectItem value="DEFAULT_FACTURE">Facture Générique</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Vos Modèles</SelectLabel>
                                {templates.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.nom_modele}</SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <SubmitButton
                            type="submit"
                            className="w-full"
                            steppedTexts={["Préparation…", "Analyse par Gemini 2.5…", "Finalisation…"]}
                          >
                            Relancer l'extraction
                          </SubmitButton>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto pt-5">
                {!hasData ? (
                  <div className="flex h-full flex-col items-center justify-center space-y-6">
                    <div className="text-center">
                      <div className="mb-4 inline-block rounded-full bg-[#E1F5EE] p-4">
                        <SparklesIcon className="size-7 text-[#1D9E75]" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">Analyser ce document</h3>
                      <p className="mt-1 max-w-xs text-sm text-gray-500">
                        Choisissez le modèle le plus adapté et laissez l'IA faire le reste.
                      </p>
                    </div>
                    <form
                      action={reExtractSingleDocumentAction}
                      className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.03] p-6"
                    >
                      <input type="hidden" name="documentId" value={document.id} />
                      <div className="space-y-2">
                        <Label>Modèle d'extraction</Label>
                        <Select name="template_id" required defaultValue="NO_MODEL">
                          <SelectTrigger className="h-9 w-full bg-white">
                            <SelectValue placeholder="Choisir un modèle…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Options</SelectLabel>
                              <SelectItem value="NO_MODEL" className="font-medium text-[#1D9E75]">
                                ✨ IA Libre
                              </SelectItem>
                              <SelectItem value="DEFAULT_FACTURE">Facture Générique</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Vos Modèles</SelectLabel>
                              {templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.nom_modele}</SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                      <SubmitButton
                        type="submit"
                        className="h-9 w-full"
                        icon={<PlayIcon className="size-3.5" />}
                        steppedTexts={["Préparation…", "Analyse IA…", "Finalisation…"]}
                      >
                        Lancer l'extraction
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <VerificationForm
                    document={{
                      id: document.id,
                      client_id: document.client_id,
                      document_type: document.document_type ?? null,
                      fournisseur_detecte: document.fournisseur_detecte ?? null,
                    }}
                    extractedData={extractedData}
                    hasPreferences={hasPreferences}
                    modelFields={
                      document.template?.structure_json &&
                      typeof document.template.structure_json === 'object'
                        ? Object.keys(document.template.structure_json)
                        : null
                    }
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
