import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    full: 'max-w-[95vw]',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden">
      <div className="flex items-center justify-center min-h-screen px-4 py-4">
        <div className="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>

        <div className={`relative bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all align-middle animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col`}>
          <div className="bg-white px-5 pt-5 pb-4 sm:px-6 sm:pt-6 max-w-full overflow-x-hidden flex-shrink-0 border-b border-gray-100">
            <div className="flex justify-between items-center mb-4 gap-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate flex-1">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="max-w-full overflow-x-hidden flex-1 px-5 pb-5 pt-4 sm:px-6 sm:pb-6 flex flex-col min-h-0 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

