"use client"

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FilterIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function FileFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentStatut = searchParams.get('statut') || 'TOUS'
  const currentDate = searchParams.get('date') || ''

  const handleFilter = (key, value) => {
    const params = new URLSearchParams(searchParams)
    if (value && value !== 'TOUS') {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const clearFilters = () => {
    router.push(pathname)
  }

  const hasActiveFilters = currentStatut !== 'TOUS' || currentDate !== ''

  return (
    <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-lg border shadow-sm w-full mb-4">
      <div className="text-sm font-medium text-gray-500 flex items-center gap-2 mr-2">
        <FilterIcon className="w-4 h-4" /> Filtres
      </div>

      <Select value={currentStatut} onValueChange={(val) => handleFilter('statut', val)}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="TOUS">Tous les statuts</SelectItem>
          <SelectItem value="A_EXTRAIRE">À Extraire</SelectItem>
          <SelectItem value="A_VERIFIER">À Vérifier</SelectItem>
          <SelectItem value="VALIDE">Validés</SelectItem>
          <SelectItem value="REJETE">Erreurs (Rejetés)</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input 
          type="date" 
          value={currentDate} 
          onChange={(e) => handleFilter('date', e.target.value)} 
          className="h-9 w-[150px] text-sm"
        />
      </div>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-red-500 hover:text-red-700 h-9 px-2">
          <XIcon className="w-4 h-4 mr-1" /> Effacer
        </Button>
      )}
    </div>
  )
}