import React, { useRef, useState } from 'react';
import { Plus, X as XIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';

interface MultiLogoUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  label: string;
  description?: string;
  icon?: React.ElementType;
}

const MultiLogoUpload: React.FC<MultiLogoUploadProps> = ({ value, onChange, label, description, icon: Icon }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { alert('Fichier trop volumineux (max 5 Mo)'); continue; }
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `events/logo_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('ong-backend').upload(fileName, file);
      if (error) { alert(`Erreur d'upload : ${error.message}`); continue; }
      const { data } = supabase.storage.from('ong-backend').getPublicUrl(fileName);
      newUrls.push(data.publicUrl);
    }
    if (newUrls.length) onChange([...value, ...newUrls]);
    setUploading(false);
    e.target.value = '';
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {Icon && (
          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
            <Icon size={14} className="text-green-700" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center p-3 bg-gray-50 rounded-xl border border-gray-200">
        {value.map((url, idx) => (
          <div key={idx} className="relative group w-20 h-20 bg-white border-2 border-gray-200 rounded-xl overflow-hidden flex items-center justify-center shadow-sm">
            <img src={url} alt="" className="max-w-full max-h-full object-contain p-1.5" />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center hidden group-hover:flex transition-all shadow"
            >
              <XIcon size={10} className="text-white" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all"
        >
          {uploading ? (
            <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Plus size={18} />
              <span className="text-[10px] mt-1 font-semibold">Ajouter</span>
            </>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>
    </div>
  );
};

export default MultiLogoUpload;
