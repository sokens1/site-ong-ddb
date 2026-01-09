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
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className={`relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all ${sizeClasses[size]} w-[calc(100vw-2rem)] sm:w-auto max-h-[90vh] flex flex-col`}>
          <div className="bg-white px-4 pt-4 pb-4 sm:p-5 max-w-full overflow-x-hidden flex-shrink-0">
            <div className="flex justify-between items-center mb-3 gap-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 truncate flex-1">{title}</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 shrink-0"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          <div className="max-w-full overflow-x-hidden flex-1 px-4 pb-4 sm:px-5 sm:pb-5 flex flex-col min-h-0 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Modal;

