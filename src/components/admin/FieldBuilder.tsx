import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, X as XIcon, Plus } from 'lucide-react';

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
}

interface FieldBuilderProps {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  addLabel?: string;
}

const FieldBuilder: React.FC<FieldBuilderProps> = ({ fields, onChange, addLabel = '+ Ajouter un champ' }) => {
  const updateField = (index: number, patch: Partial<FormField>) => {
    onChange(fields.map((f, i) => i === index ? { ...f, ...patch } : f));
  };

  const addOption = (index: number) => {
    updateField(index, { options: [...(fields[index].options || []), ''] });
  };

  const updateOption = (fieldIdx: number, optIdx: number, value: string) => {
    const opts = [...(fields[fieldIdx].options || [])];
    opts[optIdx] = value;
    updateField(fieldIdx, { options: opts });
  };

  const removeOption = (fieldIdx: number, optIdx: number) => {
    updateField(fieldIdx, { options: (fields[fieldIdx].options || []).filter((_, i) => i !== optIdx) });
  };

  const hasOptions = (type: string) => ['select', 'radio', 'checkbox'].includes(type);

  return (
    <div className="space-y-4">
      <AnimatePresence>
        {fields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 p-3 bg-gray-50 border-b border-gray-100">
              <GripVertical size={16} className="text-gray-300 flex-shrink-0" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Champ {index + 1}</span>
              <button type="button" onClick={() => onChange(fields.filter((_, i) => i !== index))}
                className="ml-auto p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <XIcon size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Libellé de la question</label>
                  <input type="text" value={field.label} onChange={e => updateField(index, { label: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                    placeholder="Ex: Quelle est votre profession ?" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Type de champ</label>
                  <select value={field.type}
                    onChange={e => updateField(index, { type: e.target.value as FormField['type'], options: hasOptions(e.target.value) ? (field.options ?? []) : undefined })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none">
                    <option value="text">Texte court</option>
                    <option value="textarea">Texte long</option>
                    <option value="select">Liste déroulante</option>
                    <option value="radio">Choix unique</option>
                    <option value="checkbox">Choix multiple</option>
                  </select>
                </div>
              </div>
              {hasOptions(field.type) && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Options de réponse</label>
                  <div className="space-y-2">
                    {(field.options || []).map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-gray-400">{optIdx + 1}</span>
                        </div>
                        <input type="text" value={opt} onChange={e => updateOption(index, optIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder={`Option ${optIdx + 1}`} />
                        <button type="button" onClick={() => removeOption(index, optIdx)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded">
                          <XIcon size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(index)}
                      className="flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 font-semibold py-1 px-2 rounded-lg hover:bg-green-50 transition-colors">
                      <Plus size={14} /> Ajouter une option
                    </button>
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <div onClick={() => updateField(index, { required: !field.required })}
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${field.required ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.required ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-gray-700">Réponse obligatoire</span>
              </label>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <button type="button" onClick={() => onChange([...fields, { id: Date.now().toString(), label: '', type: 'text', required: false }])}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-semibold hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all flex items-center justify-center gap-2">
        <Plus size={16} /> {addLabel}
      </button>
    </div>
  );
};

export default FieldBuilder;
