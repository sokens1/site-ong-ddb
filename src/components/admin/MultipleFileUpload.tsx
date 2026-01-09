import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Upload, X, File, Plus } from 'lucide-react';

interface MultipleFileUploadProps {
  value: string[]; // Tableau d'URLs
  onChange: (urls: string[]) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  required?: boolean;
  accept?: string;
  maxSizeMB?: number;
}

const MultipleFileUpload: React.FC<MultipleFileUploadProps> = ({
  value = [],
  onChange,
  bucket = 'ong-backend',
  folder = 'files',
  label = 'Fichiers',
  required = false,
  accept = '*/*',
  maxSizeMB = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setError(null);
    const newUrls: string[] = [];
    const filesArray = Array.from(files);

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];

      // Validation de la taille
      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`Le fichier "${file.name}" dépasse ${maxSizeMB}MB`);
        continue;
      }

      setUploading(true);
      setUploadingIndex(i);

      try {
        // Créer un nom de fichier unique
        const fileExt = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}-${i}.${fileExt}`;

        // Upload vers Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
            throw new Error(`Le bucket "${bucket}" n'existe pas dans Supabase Storage.`);
          }
          if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS')) {
            throw new Error(`Politique RLS manquante pour le bucket "${bucket}".`);
          }
          throw uploadError;
        }

        // Obtenir l'URL publique
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
        newUrls.push(data.publicUrl);
      } catch (err: any) {
        console.error('Error uploading file:', err);
        let errorMessage = `Erreur lors de l'upload de "${file.name}"`;
        
        if (err.message?.includes('Bucket not found')) {
          errorMessage = `Le bucket "${bucket}" n'existe pas.`;
        } else if (err.message?.includes('row-level security') || err.message?.includes('RLS')) {
          errorMessage = `Politique RLS manquante pour le bucket "${bucket}".`;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      } finally {
        setUploadingIndex(null);
      }
    }

    if (newUrls.length > 0) {
      onChange([...value, ...newUrls]);
    }
    setUploading(false);

    // Réinitialiser l'input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    handleFileSelect(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemove = (index: number) => {
    const newUrls = value.filter((_, i) => i !== index);
    onChange(newUrls);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getFileName = (url: string) => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1] || 'Fichier';
    } catch {
      return 'Fichier';
    }
  };

  return (
    <div className="w-full max-w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && value.length === 0 && <span className="text-red-500">*</span>}
      </label>

      {/* Liste des fichiers existants */}
      {value.length > 0 && (
        <div className="space-y-2 mb-3">
          {value.map((url, index) => (
            <div
              key={index}
              className="border-2 border-dashed border-gray-300 rounded-lg p-3 bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="text-green-600 flex-shrink-0" size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">
                      {getFileName(url)}
                    </p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Voir le fichier
                    </a>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 ml-2"
                  title="Supprimer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zone de téléchargement */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
        className={`border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition w-full ${
          uploading ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          multiple
          className="hidden"
          required={required && value.length === 0}
        />
        {uploading ? (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-3"></div>
            <p className="text-gray-600 text-sm">
              Upload en cours... {uploadingIndex !== null && `(${uploadingIndex + 1})`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="text-gray-400" size={32} />
              <Plus className="text-gray-400" size={20} />
            </div>
            <p className="text-gray-600 mb-1 text-sm font-medium">
              Cliquez ou glissez-déposez des fichiers ici
            </p>
            <p className="text-xs text-gray-400">
              Vous pouvez sélectionner plusieurs fichiers • Jusqu'à {maxSizeMB}MB par fichier
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default MultipleFileUpload;



