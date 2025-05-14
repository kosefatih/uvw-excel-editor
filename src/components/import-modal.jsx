'use client'; // Next.js app router kullanıyorsan bu gerekli olabilir

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'; // Kendi import yoluna göre değiştir
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

const ImportModal = ({ open, onOpenChange, type }) => {
  const [importFile, setImportFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleImportExcel = async () => {
    if (!importFile || !type) return;
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('type', type);

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${data.count} öğe başarıyla içe aktarıldı!`);
        onOpenChange(false);
        setImportFile(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'İçe aktarım başarısız oldu');
      }
    } catch (error) {
      console.error('İçe aktarım hatası:', error);
      toast.error(error.message || 'Excel dosyası içe aktarılırken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excel'den İçe Aktar</AlertDialogTitle>
          <AlertDialogDescription>
            Excel dosyasından veri içe aktarın. Dosya formatı seçtiğiniz türe uygun olmalıdır.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Excel Dosyası</Label>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files[0])}
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-1">
              {type === 'abbreviations' &&
                'Sütunlar: B (Ürün Numarası), D (Tip Numarası), E (Sipariş Numarası), F (Üretici), G (Üretici Adı)'}
              {type === 'replacements' && 'Sütunlar: B (Orijinal), D (Yeni)'}
              {type === 'exclusions' && 'Sütun: B (Sipariş Numarası)'}
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleImportExcel}
            disabled={!importFile || loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="mr-2 animate-spin" size={16} />}
            İçe Aktar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ImportModal;
