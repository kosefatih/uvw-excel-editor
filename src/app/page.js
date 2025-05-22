'use client';

import { useState } from 'react';
import ExcelProcessor from "@/components/excel-processor"
import ExcelUploadModal from "@/components/import-modal"

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleUpload = () => {
    // Burada gerekirse ExcelProcessor'ı yenilemek için state güncellemesi yapılabilir
    setIsModalOpen(false);
  };

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6">
      </div>
      
      <ExcelProcessor />
      
      <ExcelUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpload={handleUpload}
      />
    </main>
  )
}
