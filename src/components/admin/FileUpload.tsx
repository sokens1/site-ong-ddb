import React, { useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Upload, X, File } from 'lucide-react';

interface FileUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  required?: boolean;
  accept?: string;
  maxSizeMB?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({
  value,
  onChange,
  bucket = 'ong-backend',
  folder = 'files',
  label = 'Fichier',
  required = false,
  accept = '*/*',
  maxSizeMB = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File | null) => {
    if (!file) return;

    // Validation de la taille
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Le fichier ne doit pas dépasser ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    setFileName(file.name);

    try {
      // Créer un nom de fichier unique
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // Vérifier le type d'erreur
        if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
          throw new Error(`Le bucket "${bucket}" n'existe pas dans Supabase Storage. Veuillez le créer dans votre projet Supabase.`);
        }
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('RLS')) {
          throw new Error(`Politique RLS manquante pour le bucket "${bucket}". Veuillez configurer les politiques Storage dans Supabase Dashboard > Storage > ${bucket} > Policies. Voir le fichier STORAGE-POLICIES-SETUP.md pour les instructions.`);
        }
        throw uploadError;
      }

      // Obtenir l'URL publique
      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      onChange(publicUrl);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      let errorMessage = 'Erreur lors de l\'upload du fichier';
      
      if (err.message?.includes('Bucket not found')) {
        errorMessage = `Le bucket "${bucket}" n'existe pas. Veuillez le créer dans Supabase Storage (Storage > New bucket).`;
      } else if (err.message?.includes('row-level security') || err.message?.includes('RLS')) {
        errorMessage = `Politique RLS manquante pour le bucket "${bucket}". Allez dans Supabase Dashboard > Storage > ${bucket} > Policies et créez une politique INSERT pour les utilisateurs authentifiés. Voir STORAGE-POLICIES-SETUP.md pour les détails.`;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemove = () => {
    setFileName(null);
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-full">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {value ? (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <File className="text-green-600" size={24} />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {fileName || 'Fichier téléchargé'}
                </p>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Voir le fichier
                </a>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="mt-3 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Changer le fichier
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={handleClick}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-green-500 transition w-full"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
            required={required && !value}
          />
          {uploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
              <p className="text-gray-600">Upload en cours...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 mb-2">
                Cliquez ou glissez-déposez un fichier ici
              </p>
              <p className="text-sm text-gray-400">
                Jusqu'à {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default FileUpload;

