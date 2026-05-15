"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { DownloadIcon, FileSpreadsheetIcon, TableIcon, AlertCircleIcon } from "lucide-react"

export default function ExportModal({ selectedDocs, trigger }) {
  const [open, setOpen] = useState(false)
  
  // 1. Extraire les clés et vérifier la présence de données complexes (tableaux/lignes)
  const availableKeys = new Set()
  let hasComplexLines = false // Notre détecteur

  selectedDocs.forEach(doc => {
    if (doc.donnees_extraites) {
      Object.entries(doc.donnees_extraites).forEach(([key, value]) => {
        availableKeys.add(key)
        // Si c'est un tableau contenant des objets (ex: Lignes de relevé ou facture)
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
          hasComplexLines = true
        }
      })
    }
  })
  
  const columns = Array.from(availableKeys).sort()
  const [selectedColumns, setSelectedColumns] = useState(columns)

  const toggleColumn = (col) => {
    setSelectedColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    )
  }

  const handleExportClick = () => {
    setTimeout(() => setOpen(false), 800)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-10 shadow-sm"
            disabled={selectedDocs.length === 0}
          >
            <DownloadIcon className="w-4 h-4 mr-2" /> Exporter
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheetIcon className="w-5 h-5 text-emerald-600" /> 
            Configuration de l'export
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les champs à inclure dans votre fichier d'export.
          </DialogDescription>
        </DialogHeader>

        <form action="/api/export" method="POST" className="space-y-4 pt-2">
          {selectedDocs.map(doc => (
            <input key={doc.id} type="hidden" name="documentIds" value={doc.id} />
          ))}
          <input type="hidden" name="columns" value={JSON.stringify(selectedColumns)} />

          {/* NOTIFICATION INTELLIGENTE SI LIGNES DÉTECTÉES */}
          {hasComplexLines && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
              <AlertCircleIcon className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-blue-800">Lignes détaillées détectées</h4>
                <p className="text-xs text-blue-600 mt-1">
                  Les données de type "Lignes" (ex: Relevés bancaires) seront automatiquement formatées dans un <b>onglet séparé</b> dans le fichier Excel pour garantir une lecture parfaite.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-3">
              {columns.map((col) => (
                <div key={col} className="flex items-center space-x-2 border p-2 rounded-md hover:bg-gray-50 transition-colors">
                  <Checkbox 
                    id={col} 
                    checked={selectedColumns.includes(col)}
                    onCheckedChange={() => toggleColumn(col)}
                  />
                  <Label htmlFor={col} className="text-xs font-medium cursor-pointer truncate uppercase">
                    {col.replace(/_/g, ' ')}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t">
            <div className="flex justify-between items-center mb-1">
               <span className="text-xs text-gray-500 font-medium">Format de sortie :</span>
               <Button 
                  type="button" 
                  variant="link" 
                  className="h-auto p-0 text-xs text-emerald-600" 
                  onClick={() => setSelectedColumns(selectedColumns.length === columns.length ? [] : columns)}
                >
                  {selectedColumns.length === columns.length ? "Tout désélectionner" : "Tout sélectionner"}
                </Button>
            </div>
            
            <div className="flex gap-3">
              <Button type="submit" name="format" value="excel" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" disabled={selectedColumns.length === 0} onClick={handleExportClick}>
                <FileSpreadsheetIcon className="w-4 h-4 mr-2" /> Format Excel
              </Button>
              <Button type="submit" name="format" value="csv" variant="outline" className="flex-1 text-gray-700 hover:bg-gray-100 shadow-sm" disabled={selectedColumns.length === 0} onClick={handleExportClick}>
                <TableIcon className="w-4 h-4 mr-2" /> Format CSV
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}