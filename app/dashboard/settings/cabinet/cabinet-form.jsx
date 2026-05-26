"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CardContent, CardFooter } from "@/components/ui/card"
import { UploadCloudIcon, FileTextIcon, MapPinIcon } from "lucide-react"

export function CabinetForm({ initialCabinet, isAdmin, action }) {
  const [previewUrl, setPreviewUrl] = useState(initialCabinet.logo_url)
  const [isUploading, setIsUploading] = useState(false)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) setPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <form action={async (formData) => {
      setIsUploading(true)
      await action(formData)
      setIsUploading(false)
    }}>
      <CardContent className="space-y-8 pt-6">

        {/* SECTION 1 : LOGO ET NOM */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-slate-700 dark:text-slate-300">Logo de l'entreprise</Label>
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] flex flex-col items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Aperçu Logo" fill sizes="96px" className="object-contain p-2" />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-600">Aucun logo</span>
                )}
              </div>

              <Label
                htmlFor="logo-upload"
                className={`flex-1 w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors group
                  border-[#A8DCC9]/60 dark:border-[#1D9E75]/20
                  bg-[#E1F5EE]/30 dark:bg-[#1D9E75]/5
                  ${isAdmin ? 'cursor-pointer hover:bg-[#E1F5EE]/60 dark:hover:bg-[#1D9E75]/10' : 'opacity-50 cursor-not-allowed'}`}
              >
                <UploadCloudIcon className="w-6 h-6 text-[#1D9E75] mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-[#085041] dark:text-[#1D9E75]">Cliquez pour choisir une image</p>
                <p className="text-xs text-[#1D9E75]/70 dark:text-[#1D9E75]/50 mt-1">PNG, JPG, SVG (Max 2MB)</p>
                <Input
                  id="logo-upload"
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!isAdmin}
                  onChange={handleImageChange}
                />
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom_cabinet" className="text-slate-700 dark:text-slate-300">
              Nom officiel du cabinet <span className="text-red-500">*</span>
            </Label>
            <Input
              id="nom_cabinet"
              name="nom_cabinet"
              defaultValue={initialCabinet.nom}
              required
              disabled={!isAdmin}
              className="max-w-md bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <hr className="border-slate-100 dark:border-white/[0.06]" />

        {/* SECTION 2 : INFORMATIONS LÉGALES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <FileTextIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Informations Légales & Fiscales</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
            Ces informations sont optionnelles mais nécessaires pour générer des exports comptables valides.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'ice', label: 'ICE', placeholder: 'Ex: 0015… (15 chiffres)', maxLength: 15, value: initialCabinet.ice },
              { id: 'identifiant_fiscal', label: 'Identifiant Fiscal (IF)', value: initialCabinet.identifiant_fiscal },
              { id: 'registre_commerce', label: 'Registre de Commerce (RC)', value: initialCabinet.registre_commerce },
              { id: 'patente', label: 'Patente', value: initialCabinet.patente },
            ].map(field => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-slate-600 dark:text-slate-400 text-xs">{field.label}</Label>
                <Input
                  id={field.id}
                  name={field.id}
                  defaultValue={field.value}
                  disabled={!isAdmin}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  className="bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

        <hr className="border-slate-100 dark:border-white/[0.06]" />

        {/* SECTION 3 : COORDONNÉES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPinIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Coordonnées</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse" className="text-slate-600 dark:text-slate-400 text-xs">Adresse du siège</Label>
            <Input
              id="adresse" name="adresse"
              defaultValue={initialCabinet.adresse}
              disabled={!isAdmin}
              placeholder="Ex: 123 Avenue Hassan II…"
              className="bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'ville', label: 'Ville', value: initialCabinet.ville },
              { id: 'code_postal', label: 'Code Postal', value: initialCabinet.code_postal },
              { id: 'telephone', label: 'Téléphone de contact', value: initialCabinet.telephone, type: 'tel', placeholder: '+212 6…' },
              { id: 'site_web', label: 'Site Web', value: initialCabinet.site_web, type: 'url', placeholder: 'https://…' },
            ].map(field => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id} className="text-slate-600 dark:text-slate-400 text-xs">{field.label}</Label>
                <Input
                  id={field.id} name={field.id}
                  defaultValue={field.value}
                  disabled={!isAdmin}
                  type={field.type}
                  placeholder={field.placeholder}
                  className="bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>
        </div>

      </CardContent>

      <CardFooter className="bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/[0.06] px-6 py-4 flex justify-end">
        <Button
          type="submit"
          className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white shadow-sm"
          disabled={!isAdmin || isUploading}
        >
          {isUploading ? "Sauvegarde en cours…" : "Sauvegarder les modifications"}
        </Button>
      </CardFooter>
    </form>
  )
}
