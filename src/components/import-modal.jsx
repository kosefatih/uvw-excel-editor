import { useState } from 'react';
import styles from './ExcelUploadModal.module.css';
import { toast } from 'sonner';

const ExcelUploadModal = ({ isOpen, onClose, onUpload }) => {
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Dosya uzantısını kontrol et
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileExtension)) {
      toast.error('Lütfen geçerli bir Excel dosyası seçin (.xlsx veya .xls)');
      return;
    }

    setFile(selectedFile);
    setMessage({ text: '', type: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setMessage({ text: 'Lütfen bir dosya seçin', type: 'error' });
      return;
    }

    setIsLoading(true);
    setMessage({ text: 'Dosya işleniyor...', type: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        throw new Error('Sunucu yanıtı işlenirken hata oluştu');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Sunucu hatası');
      }

      if (data.success) {
        setMessage({ text: data.message, type: 'success' });
        toast.success(data.message);
        onUpload(); // Ana bileşene başarılı yükleme bilgisini iletmek için
      } else {
        throw new Error(data.error || 'İşlem başarısız oldu');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = error.message || 'Dosya işlenirken hata oluştu';
      setMessage({ text: `Hata: ${errorMessage}`, type: 'error' });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.closeButton} onClick={onClose}>
          &times;
        </button>
        <h2>Excel Dosyası Yükle</h2>
        <p>Excel dosyanızı seçerek Google Sheets'e aktarabilirsiniz.</p>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.fileInputContainer}>
            <input
              type="file"
              id="excelFile"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            <label htmlFor="excelFile" className={styles.fileInputLabel}>
              {file ? file.name : 'Dosya Seç...'}
            </label>
          </div>
          
          {message.text && (
            <div className={`${styles.message} ${styles[message.type]}`}>
              {message.text}
            </div>
          )}
          
          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={onClose}
              className={styles.secondaryButton}
              disabled={isLoading}
            >
              İptal
            </button>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={!file || isLoading}
            >
              {isLoading ? 'Yükleniyor...' : 'Yükle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExcelUploadModal;