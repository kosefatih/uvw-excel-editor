"use client"

import { useState, useEffect } from "react"
import {
  Loader2,
  FileText,
  Check,
  CheckCheck,
  Filter,
  List,
  Replace,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  FileCheck,
} from "lucide-react"
import { Toaster, toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ExcelProcessor() {
  const [filePath, setFilePath] = useState("")
  const [loading, setLoading] = useState(false)
  const [ortValues, setOrtValues] = useState([])
  const [selectedOrts, setSelectedOrts] = useState([])
  const [step, setStep] = useState(1)
  const [activeTab, setActiveTab] = useState("process") // 'process', 'rules', 'abbreviations', or 'replacements'
  const [newExclusion, setNewExclusion] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState({ type: "", id: "" })
  const [codeCheckResult, setCodeCheckResult] = useState(null)

  const [newRule, setNewRule] = useState({
    regexPattern: "",
    outputFormat: "",
    modelFormat: "",
  })
  const [newAbbreviation, setNewAbbreviation] = useState({
    orderNumber: "",
    abbreviation: "",
  })
  const [newReplacement, setNewReplacement] = useState({
    originalOrderNumber: "",
    replacementOrderNumber: "",
  })
  const [manualAbbreviations, setManualAbbreviations] = useState([])
  const [orderReplacements, setOrderReplacements] = useState([])
  const [exclusions, setExclusions] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [file, setFile] = useState(null)

  // Load data based on active tab
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        if (activeTab === "abbreviations") {
          const response = await fetch("/api/abbreviations")
          if (response.ok) {
            const data = await response.json()
            setManualAbbreviations(data.items || [])
          }
        }
        if (activeTab === "replacements") {
          const response = await fetch("/api/replacements")
          if (response.ok) {
            const data = await response.json()
            setOrderReplacements(data.items || [])
          }
        }
        if (activeTab === "rules") {
          const response = await fetch("/api/exclusions")
          if (response.ok) {
            const data = await response.json()
            setExclusions(data.items || [])
          }
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast.error("Veri yüklenirken hata oluştu. Lütfen tekrar deneyin.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [activeTab])

  // Refresh data
  const refreshData = async () => {
    setLoading(true)
    try {
      if (activeTab === "abbreviations") {
        const response = await fetch("/api/abbreviations")
        if (response.ok) {
          const data = await response.json()
          setManualAbbreviations(data.items || [])
        }
      }
      if (activeTab === "replacements") {
        const response = await fetch("/api/replacements")
        if (response.ok) {
          const data = await response.json()
          setOrderReplacements(data.items || [])
        }
      }
      if (activeTab === "rules") {
        const response = await fetch("/api/exclusions")
        if (response.ok) {
          const data = await response.json()
          setExclusions(data.items || [])
        }
      }
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast.error("Veri yenilenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Handle file selection
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setFilePath(selectedFile.name)
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/excel/ort-values", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setOrtValues(data.ortValues)
          setSelectedOrts([])
          setStep(2)
        } else {
          throw new Error(data.error || "Dosya işlenirken hata oluştu")
        }
      } else {
        throw new Error("Sunucu hatası")
      }
    } catch (error) {
      console.error("Error processing file:", error)
      toast.error(error.message || "Dosya işlenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Toggle Ort selection
  const toggleOrtSelection = (ort) => {
    setSelectedOrts((prev) => (prev.includes(ort) ? prev.filter((item) => item !== ort) : [...prev, ort]))
  }

  // Process Excel file
  const handleProcessFile = async () => {
    if (!file || selectedOrts.length === 0) return

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("selectedOrts", JSON.stringify(selectedOrts))


      const response = await fetch("/api/excel/process", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Kod kontrol sonuçlarını kaydet
          if (data.codeCheck) {
            setCodeCheckResult(data.codeCheck)
          }
          // Download the processed file
          const downloadUrl = `/api/download/${data.fileId}`
          window.open(downloadUrl, "_blank")
          setStep(3)
        } else {
          throw new Error(data.error || "Dosya işlenirken hata oluştu")
        }
      } else {
        throw new Error("Sunucu hatası")
      }
    } catch (error) {
      console.error("Error processing file:", error)
      toast.error(error.message || "Dosya işlenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Add rule
  const handleAddRule = async () => {
    if (!newRule.regexPattern || !newRule.outputFormat) return

    setLoading(true)
    try {
      const response = await fetch("/api/rules", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRule),
      })

      if (response.ok) {
        setNewRule({ regexPattern: "", outputFormat: "", modelFormat: "" })
        toast.success("Kural başarıyla eklendi!")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Kural eklenirken hata oluştu")
      }
    } catch (error) {
      console.error("Error adding rule:", error)
      toast.error(error.message || "Kural eklenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Add exclusion
  const handleAddExclusion = async () => {
    if (!newExclusion || loading) return

    setLoading(true)
    try {
      const response = await fetch("/api/exclusions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderNumber: newExclusion }),
      })

      if (response.ok) {
        setNewExclusion("")
        refreshData()
        toast.success("Filtre başarıyla eklendi!")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Filtre eklenirken hata oluştu")
      }
    } catch (error) {
      console.error("Error adding filter:", error)
      toast.error(error.message || "Filtre eklenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Add abbreviation
  const handleAddAbbreviation = async () => {
    if (!newAbbreviation.orderNumber || !newAbbreviation.abbreviation || loading) return

    setLoading(true)
    try {
      const response = await fetch("/api/abbreviations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newAbbreviation),
      })

      if (response.ok) {
        setNewAbbreviation({ orderNumber: "", abbreviation: "" })
        refreshData()
        toast.success("Kısaltma başarıyla eklendi!")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Kısaltma eklenirken hata oluştu")
      }
    } catch (error) {
      console.error("Error adding abbreviation:", error)
      toast.error(error.message || "Kısaltma eklenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Add replacement
  const handleAddReplacement = async () => {
    if (!newReplacement.originalOrderNumber || !newReplacement.replacementOrderNumber || loading) return

    setLoading(true)
    try {
      const response = await fetch("/api/replacements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newReplacement),
      })

      if (response.ok) {
        setNewReplacement({ originalOrderNumber: "", replacementOrderNumber: "" })
        refreshData()
        toast.success("Değiştirme kuralı başarıyla eklendi!")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Değiştirme kuralı eklenirken hata oluştu")
      }
    } catch (error) {
      console.error("Error adding replacement:", error)
      toast.error(error.message || "Değiştirme kuralı eklenirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  // Show delete confirmation dialog
  const confirmDelete = (type, id) => {
    setItemToDelete({ type, id })
    setShowDeleteDialog(true)
  }

  // Handle delete
  const handleDelete = async () => {
    if (!itemToDelete.type || !itemToDelete.id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/${itemToDelete.type}/${itemToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        refreshData()
        toast.success("Öğe başarıyla silindi!")
      } else {
        const data = await response.json()
        throw new Error(data.error || "Öğe silinirken hata oluştu")
      }
    } catch (error) {
      console.error("Error deleting item:", error)
      toast.error(error.message || "Öğe silinirken hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  // Filter items based on search term
  const filterItems = (items, term) => {
    if (!term) return items
    return items.filter((item) => {
      return Object.values(item).some((value) => value && value.toString().toLowerCase().includes(term.toLowerCase()))
    })
  }

  // Delete button component
  const DeleteButton = ({ onClick, tooltip }) => (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="text-red-500 hover:text-red-700 hover:bg-red-100"
      title={tooltip}
      disabled={loading}
    >
      <Trash2 size={18} />
    </Button>
  )

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      {/* Sonner toast component */}
      <Toaster position="top-right" />
      
      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg flex items-center">
            <Loader2 className="animate-spin mr-2" />
            <span>Yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Silme Onayı</AlertDialogTitle>
            <AlertDialogDescription>Bu öğeyi silmek istediğinize emin misiniz?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Excel Makro Kontrol</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-6">
          <TabsTrigger value="process" className="flex items-center">
            <FileText className="mr-2" size={16} />
            İşlem
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center">
            <List className="mr-2" size={16} />
            Kurallar
          </TabsTrigger>
          <TabsTrigger value="abbreviations" className="flex items-center">
            <Filter className="mr-2" size={16} />
            Kısaltmalar
          </TabsTrigger>
          <TabsTrigger value="replacements" className="flex items-center">
            <Replace className="mr-2" size={16} />
            Değiştirmeler
          </TabsTrigger>
        </TabsList>

        {/* Process Tab */}
        <TabsContent value="process">
          {/* Process Steps */}
          <div className="flex mb-6">
            <div className={`flex-1 text-center border-b-2 ${step >= 1 ? "border-blue-500" : "border-gray-300"}`}>
              <p className={`font-medium ${step >= 1 ? "text-blue-600" : "text-gray-500"}`}>1. Dosya Seç</p>
            </div>
            <div className={`flex-1 text-center border-b-2 ${step >= 2 ? "border-blue-500" : "border-gray-300"}`}>
              <p className={`font-medium ${step >= 2 ? "text-blue-600" : "text-gray-500"}`}>2. Pano Seç</p>
            </div>
            <div className={`flex-1 text-center border-b-2 ${step >= 3 ? "border-blue-500" : "border-gray-300"}`}>
              <p className={`font-medium ${step >= 3 ? "text-blue-600" : "text-gray-500"}`}>3. Tamamlandı</p>
            </div>
          </div>

          {/* Step 1: File Selection */}
          {step === 1 && (
            <div className="text-center">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center mx-auto w-fit">
                  <FileText className="inline mr-2" />
                  Excel Dosyası Seç
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </Label>
            </div>
          )}

          {/* Step 2: Ort Selection */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Ort Değerlerini Seçin</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6 max-h-96 overflow-y-auto p-2">
                {ortValues.map((ort) => (
                  <div
                    key={ort}
                    onClick={() => toggleOrtSelection(ort)}
                    className={`p-3 border rounded-lg cursor-pointer flex items-center ${
                      selectedOrts.includes(ort)
                        ? "bg-blue-100 border-blue-500"
                        : "bg-white border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {selectedOrts.includes(ort) ? (
                      <CheckCheck className="text-blue-600 mr-2" />
                    ) : (
                      <Check className="text-gray-400 mr-2" />
                    )}
                    <span>{ort}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                  Geri
                </Button>
                <Button
                  onClick={handleProcessFile}
                  disabled={selectedOrts.length === 0 || loading}
                  className="flex items-center"
                >
                  {loading ? <Loader2 className="mr-2 animate-spin" /> : null}
                  İşlemi Başlat
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Completed */}
          {step === 3 && (
            <div className="text-center py-8">
              <div className="text-green-500 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">İşlem Başarıyla Tamamlandı!</h2>
              <p className="text-gray-600 mb-6">Excel dosyanız başarıyla işlendi ve indirildi.</p>
              {codeCheckResult && (
                <div className="mb-6 text-left bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2 flex items-center">
                    <FileCheck className="mr-2" />
                    Kod Kontrol Sonuçları
                  </h3>
                  <div className="space-y-2">
                    <p>
                      <span className="font-medium">Toplam Kontrol Edilen Kod:</span> {codeCheckResult.totalChecked}
                    </p>
                    <p>
                      <span className="font-medium">Onaylı Kod Sayısı:</span> {codeCheckResult.existingCount}
                    </p>
                    {codeCheckResult.missingCodes?.length > 0 && (
                      <div>
                        <p className="font-medium text-amber-600">
                          Eksik Kodlar: {codeCheckResult.missingCodes.length}
                        </p>
                        <div className="max-h-32 overflow-y-auto text-sm bg-white p-2 rounded border">
                          {codeCheckResult.missingCodes.map((code, index) => (
                            <div key={index} className="mb-1 pb-1 border-b border-gray-100">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {codeCheckResult.unapprovedCodes?.length > 0 && (
                      <div>
                        <p className="font-medium text-orange-600">
                          Onaysız Kodlar: {codeCheckResult.unapprovedCodes.length}
                        </p>
                        <div className="max-h-32 overflow-y-auto text-sm bg-white p-2 rounded border">
                          {codeCheckResult.unapprovedCodes.map((code, index) => (
                            <div key={index} className="mb-1 pb-1 border-b border-gray-100">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <Button
                onClick={() => {
                  setFilePath("")
                  setFile(null)
                  setStep(1)
                  setCodeCheckResult(null)
                }}
                disabled={loading}
              >
                Yeni Dosya İşle
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Kural Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="model-format" className="mb-1">
                    Model Formatı
                  </Label>
                  <Input
                    id="model-format"
                    value={newRule.modelFormat}
                    onChange={(e) => setNewRule({ ...newRule, modelFormat: e.target.value })}
                    placeholder="Örn: VX####.###"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="regex-pattern" className="mb-1">
                    Regex Deseni
                  </Label>
                  <Input
                    id="regex-pattern"
                    value={newRule.regexPattern}
                    onChange={(e) => setNewRule({ ...newRule, regexPattern: e.target.value })}
                    placeholder="Örn: VX(\\d+\\.\\d+)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="output-format" className="mb-1">
                    Çıktı Formatı
                  </Label>
                  <Input
                    id="output-format"
                    value={newRule.outputFormat}
                    onChange={(e) => setNewRule({ ...newRule, outputFormat: e.target.value })}
                    placeholder="Örn: {model}"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleAddRule}
                  disabled={loading || !newRule.regexPattern || !newRule.outputFormat}
                  className="flex items-center"
                >
                  <Plus className="mr-2" size={16} />
                  Kural Ekle
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Filtre Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Input
                  value={newExclusion}
                  onChange={(e) => setNewExclusion(e.target.value)}
                  placeholder="Filtrelenecek Bestell_Nr_ girin"
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={handleAddExclusion} disabled={!newExclusion || loading} className="flex items-center">
                  <Plus className="mr-2" size={16} />
                  Filtre Ekle
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mevcut Filtreler</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ara..."
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshData}
                  title="Yenile"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(exclusions || []).length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
                  <Filter className="mx-auto mb-2 text-gray-400" size={24} />
                  <p>Henüz filtre eklenmedi</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bestell_Nr_</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterItems(exclusions, searchTerm).map((item, index) => (
                      <TableRow key={item._id || index}>
                        <TableCell>{item.orderNumber}</TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            onClick={() => confirmDelete("exclusions", item.orderNumber)}
                            tooltip="Filtreyi Sil"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Abbreviations Tab */}
        <TabsContent value="abbreviations">
          <Card>
            <CardHeader>
              <CardTitle>Manuel Kısaltma Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="order-number" className="mb-1">
                    Bestell_Nr_
                  </Label>
                  <Input
                    id="order-number"
                    value={newAbbreviation.orderNumber}
                    onChange={(e) => setNewAbbreviation({ ...newAbbreviation, orderNumber: e.target.value })}
                    placeholder="Örn: VX8806.030"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="abbreviation" className="mb-1">
                    Kısaltma
                  </Label>
                  <Input
                    id="abbreviation"
                    value={newAbbreviation.abbreviation}
                    onChange={(e) => setNewAbbreviation({ ...newAbbreviation, abbreviation: e.target.value })}
                    placeholder="Örn: RIT"
                    disabled={loading}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddAbbreviation}
                    disabled={loading || !newAbbreviation.orderNumber || !newAbbreviation.abbreviation}
                    className="flex items-center"
                  >
                    <Plus className="mr-2" size={16} />
                    Kısaltma Ekle
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mevcut Kısaltmalar</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ara..."
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshData}
                  title="Yenile"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(manualAbbreviations || []).length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
                  <Filter className="mx-auto mb-2 text-gray-400" size={24} />
                  <p>Henüz kısaltma eklenmedi</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bestell_Nr_</TableHead>
                      <TableHead>Kısaltma</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterItems(manualAbbreviations, searchTerm).map((item, index) => (
                      <TableRow key={item._id || index}>
                        <TableCell>{item.orderNumber}</TableCell>
                        <TableCell>{item.abbreviation}</TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            onClick={() => confirmDelete("abbreviations", item.orderNumber)}
                            tooltip="Kısaltmayı Sil"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        {/* Replacements Tab */}
        <TabsContent value="replacements">
         <Card>
            <CardHeader>
              <CardTitle>Sipariş Numarası Değiştirme Ekle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label htmlFor="original-order" className="mb-1">
                    Orijinal Bestell_Nr_
                  </Label>
                  <Input
                    id="original-order"
                    value={newReplacement.originalOrderNumber}
                    onChange={(e) => setNewReplacement({ ...newReplacement, originalOrderNumber: e.target.value })}
                    placeholder="Örn: VX8106.245  600X2000MM"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="replacement-order" className="mb-1">
                    Yeni Bestell_Nr_
                  </Label>
                  <Input
                    id="replacement-order"
                    value={newReplacement.replacementOrderNumber}
                    onChange={(e) => setNewReplacement({ ...newReplacement, replacementOrderNumber: e.target.value })}
                    placeholder="Örn: SP7832.142"
                    disabled={loading}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleAddReplacement}
                    disabled={loading || !newReplacement.originalOrderNumber || !newReplacement.replacementOrderNumber}
                    className="flex items-center"
                  >
                    <Plus className="mr-2" size={16} />
                    Değiştirme Ekle
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mevcut Değiştirme Kuralları</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 text-gray-400" size={16} />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Ara..."
                    className="pl-8"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={refreshData}
                  title="Yenile"
                  className="text-gray-600 hover:text-gray-800"
                >
                  <RefreshCw size={16} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(orderReplacements || []).length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
                  <Replace className="mx-auto mb-2 text-gray-400" size={24} />
                  <p>Henüz değiştirme kuralı eklenmedi</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Orijinal</TableHead>
                      <TableHead>Yeni Değer</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterItems(orderReplacements, searchTerm).map((item, index) => (
                      <TableRow key={item._id || index}>
                        <TableCell>{item.originalOrderNumber}</TableCell>
                        <TableCell>{item.replacementOrderNumber}</TableCell>
                        <TableCell className="text-right">
                          <DeleteButton
                            onClick={() => confirmDelete("replacements", item.originalOrderNumber)}
                            tooltip="Değiştirme Kuralını Sil"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
