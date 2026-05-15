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
    if (file) {
      const objectUrl = URL.createObjectURL(file)
      setPreviewUrl(objectUrl)
    }
  }

  return (
    <form action={async (formData) => {
      setIsUploading(true)
      await action(formData) // On appelle la Server Action de Supabase[cite: 5]
      setIsUploading(false)
    }}>
      <CardContent className="space-y-8 pt-6">
        
        {/* SECTION 1 : LOGO ET NOM */}
        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Logo de l'entreprise</Label>
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 rounded-xl border border-gray-200 bg-white flex flex-col items-center justify-center shrink-0 overflow-hidden relative shadow-sm">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Aperçu Logo" fill className="object-contain p-2" />
                ) : (
                  <span className="text-xs text-gray-400">Aucun logo</span>
                )}
              </div>
              
              <Label 
                htmlFor="logo-upload" 
                className={`flex-1 w-full border-2 border-dashed border-blue-100 bg-blue-50/50 rounded-xl p-6 text-center transition-colors cursor-pointer group ${isAdmin ? 'hover:bg-blue-50' : 'opacity-50 cursor-not-allowed'}`}
              >
                <UploadCloudIcon className="w-6 h-6 text-blue-500 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-blue-900">Cliquez pour choisir une image</p>
                <p className="text-xs text-blue-600/70 mt-1">PNG, JPG, SVG (Max 2MB)</p>
                
                <Input 
                  id="logo-upload" 
                  name="logo" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  disabled={!isAdmin}
                  onChange={handleImageChange} // On écoute le changement ici[cite: 5]
                />
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nom_cabinet">Nom officiel du cabinet <span className="text-red-500">*</span></Label>
            <Input 
              id="nom_cabinet" 
              name="nom_cabinet" 
              defaultValue={initialCabinet.nom} 
              required
              disabled={!isAdmin}
              className="max-w-md bg-white" 
            />
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* SECTION 2 : INFORMATIONS LÉGALES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileTextIcon className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Informations Légales & Fiscales</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">Ces informations sont optionnelles mais nécessaires pour générer des exports comptables valides.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ice" className="text-gray-600">ICE</Label>
              <Input id="ice" name="ice" defaultValue={initialCabinet.ice} disabled={!isAdmin} placeholder="Ex: 0015... (15 chiffres)" maxLength={15} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="identifiant_fiscal" className="text-gray-600">Identifiant Fiscal (IF)</Label>
              <Input id="identifiant_fiscal" name="identifiant_fiscal" defaultValue={initialCabinet.identifiant_fiscal} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registre_commerce" className="text-gray-600">Registre de Commerce (RC)</Label>
              <Input id="registre_commerce" name="registre_commerce" defaultValue={initialCabinet.registre_commerce} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patente" className="text-gray-600">Patente</Label>
              <Input id="patente" name="patente" defaultValue={initialCabinet.patente} disabled={!isAdmin} />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* SECTION 3 : COORDONNÉES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPinIcon className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Coordonnées</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="adresse" className="text-gray-600">Adresse du siège</Label>
            <Input id="adresse" name="adresse" defaultValue={initialCabinet.adresse} disabled={!isAdmin} placeholder="Ex: 123 Avenue Hassan II..." />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="ville" className="text-gray-600">Ville</Label>
              <Input id="ville" name="ville" defaultValue={initialCabinet.ville} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code_postal" className="text-gray-600">Code Postal</Label>
              <Input id="code_postal" name="code_postal" defaultValue={initialCabinet.code_postal} disabled={!isAdmin} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone" className="text-gray-600">Téléphone de contact</Label>
              <Input id="telephone" name="telephone" type="tel" defaultValue={initialCabinet.telephone} disabled={!isAdmin} placeholder="+212 6..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site_web" className="text-gray-600">Site Web</Label>
              <Input id="site_web" name="site_web" type="url" defaultValue={initialCabinet.site_web} disabled={!isAdmin} placeholder="https://..." />
            </div>
          </div>
        </div>

      </CardContent>
      <CardFooter className="bg-gray-50/50 border-t border-gray-100 px-6 py-4 flex justify-end">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={!isAdmin || isUploading}>
          {isUploading ? "Sauvegarde en cours..." : "Sauvegarder les modifications"}
        </Button>
      </CardFooter>
    </form>
  )
}