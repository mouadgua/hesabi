import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectGroup, SelectLabel, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { reExtractSingleDocumentAction } from '@/app/dashboard/actions'
import { ArrowLeftIcon, FileTextIcon, RefreshCwIcon, SparklesIcon, PlayIcon } from "lucide-react"

import ExportModal from '@/app/dashboard/clients/[id]/ExportModal'
import { SubmitButton } from '@/components/ui/submit-button'
import VerificationForm from './VerificationForm'
import ProcessingView from '@/components/ProcessingView'

export default async function VerificationPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const targetId = resolvedSearchParams.id;

  if (!targetId) return <div className="p-8 text-center">Aucun document sélectionné</div>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>Non autorisé</div>

  const document = await prisma.document.findUnique({
    where: { id: targetId },
    include: { 
      client: { include: { cabinet: { include: { templates: true } } } }, 
      template: true 
    }
  })

  if (!document) return <div>Document introuvable</div>

  const templates = document.client.cabinet.templates

  let signedUrl = null
  if (document.chemin_storage) {
    const { data } = await supabase.storage.from('documents').createSignedUrl(document.chemin_storage, 3600);
    signedUrl = data?.signedUrl;
  }

  const extractedData = document.donnees_extraites && typeof document.donnees_extraites === 'object'
    ? document.donnees_extraites
    : {};

  const hasData = Object.keys(extractedData).length > 0;

  const hasPreferences = hasData && document.document_type
    ? !!(await prisma.userFieldPreference.findUnique({
        where: { user_id_document_type: { user_id: user.id, document_type: document.document_type } }
      }))
    : false;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50 overflow-hidden">
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-white border-b shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/clients/${document.client_id}`}>
            <Button variant="ghost" size="icon" className="rounded-full border shadow-sm">
              <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileTextIcon className="w-5 h-5 text-indigo-600" /> 
              Espace de travail : {document.nom_fichier || "Document"}
            </h1>
            <p className="text-xs text-gray-500">Client : {document.client.nom_entreprise} • Statut actuel : {document.statut}</p>
          </div>
        </div>
      </div>

      {document.statut === 'EN_COURS_IA' ? (
        <ProcessingView documentId={document.id} />
      ) : (
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* GAUCHE : PDF */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-full border-b md:border-b-0 md:border-r bg-gray-100 p-4">
          <div className="w-full h-full bg-white rounded-xl shadow-inner border overflow-hidden relative">
            {signedUrl ? (
              <iframe src={signedUrl} className="w-full h-full border-0 absolute top-0 left-0" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">Fichier indisponible</div>
            )}
          </div>
        </div>

        {/* DROITE : DONNÉES */}
        <div className="w-full md:w-1/2 h-[50vh] md:h-full overflow-y-auto p-4 md:p-6 bg-gray-50/50">
          
          <Card className="border-indigo-100 shadow-sm bg-white h-full flex flex-col">
            <CardHeader className="bg-indigo-50/50 border-b pb-4 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 gap-3">
              <CardTitle className="text-lg text-indigo-900">
                {hasData ? "Données Extraites" : "Paramètres d'extraction"}
              </CardTitle>
              
              {hasData && (
                <div className="flex flex-wrap items-center gap-2">
                  <ExportModal selectedDocs={[document]} />

                  {/* MODALE RE-EXTRAIRE AVEC LOADER */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 h-10">
                        <RefreshCwIcon className="w-4 h-4 mr-2" /> Re-extraire
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-blue-600"/> Lancer une nouvelle extraction</DialogTitle>
                        <DialogDescription>Sélectionnez un nouveau modèle pour écraser les données actuelles.</DialogDescription>
                      </DialogHeader>
                      <form action={reExtractSingleDocumentAction} className="space-y-4 pt-4">
                        <input type="hidden" name="documentId" value={document.id} />
                        <Select name="template_id" required defaultValue="NO_MODEL">
                          <SelectTrigger className="w-full h-10"><SelectValue placeholder="Choisir un modèle..." /></SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Options</SelectLabel>
                              <SelectItem value="NO_MODEL" className="font-semibold text-indigo-600">✨ IA Libre</SelectItem>
                              <SelectItem value="DEFAULT_FACTURE">Facture Générique</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Vos Modèles</SelectLabel>
                              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nom_modele}</SelectItem>)}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        
                        {/* BOUTON INTELLIGENT QUI SE GÈRE TOUT SEUL */}
                        <SubmitButton 
                          type="submit" 
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          steppedTexts={["Préparation...", "Analyse par Gemini 2.5...", "Finalisation..."]}
                        >
                          Relancer Gemini
                        </SubmitButton>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </CardHeader>
            
            <CardContent className="pt-6 flex-1 overflow-y-auto">
              
              {!hasData ? (
                <div className="flex flex-col items-center justify-center h-full space-y-6">
                  <div className="text-center">
                    <div className="bg-indigo-100 p-4 rounded-full inline-block mb-4">
                      <SparklesIcon className="w-8 h-8 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Analyse du document</h3>
                    <p className="text-sm text-gray-500 mt-2 max-w-sm">
                      Lisez le document à gauche, choisissez le modèle le plus adapté ci-dessous, et laissez l'IA faire le reste.
                    </p>
                  </div>

                  <form action={reExtractSingleDocumentAction} className="w-full max-w-sm space-y-4 bg-gray-50 p-6 rounded-xl border">
                    <input type="hidden" name="documentId" value={document.id} />
                    <div className="space-y-2">
                      <Label>Modèle d'extraction</Label>
                      <Select name="template_id" required defaultValue="NO_MODEL">
                        <SelectTrigger className="w-full h-10 bg-white">
                          <SelectValue placeholder="Choisir un modèle..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>Options</SelectLabel>
                            <SelectItem value="NO_MODEL" className="font-semibold text-indigo-600">✨ IA Libre</SelectItem>
                            <SelectItem value="DEFAULT_FACTURE">Facture Générique</SelectItem>
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Vos Modèles</SelectLabel>
                            {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nom_modele}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                    <SubmitButton 
                      type="submit" 
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md h-10"
                      icon={<PlayIcon className="w-4 h-4" />}
                      steppedTexts={["Préparation...", "Analyse IA...", "Finalisation..."]}
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