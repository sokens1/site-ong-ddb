import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Saisissez votre texte...',
  rows = 4,
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);
  const [activeCommands, setActiveCommands] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const updateActiveCommands = () => {
    if (editorRef.current) {
      setActiveCommands({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
      });
    }
  };

  const handleInput = () => {
    if (editorRef.current && !isComposingRef.current) {
      onChange(editorRef.current.innerHTML);
      updateActiveCommands();
    }
  };

  const handleSelectionChange = () => {
    updateActiveCommands();
  };

  const handleCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleCompositionEnd = () => {
    isComposingRef.current = false;
    handleInput();
  };

  const execCommand = (command: string, value?: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const success = document.execCommand(command, false, value);
      if (!success && (command === 'insertUnorderedList' || command === 'insertOrderedList')) {
        // Fallback pour les listes si execCommand échoue
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const listType = command === 'insertUnorderedList' ? 'ul' : 'ol';
          const list = document.createElement(listType);
          const listItem = document.createElement('li');
          
          if (range.collapsed) {
            // Si rien n'est sélectionné, créer une liste avec un élément vide
            listItem.textContent = '\u00A0'; // Espace insécable
            list.appendChild(listItem);
            range.insertNode(list);
            range.setStartAfter(listItem);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // Si du texte est sélectionné
            listItem.appendChild(range.extractContents());
            list.appendChild(listItem);
            range.insertNode(list);
          }
          
          editorRef.current.focus();
        }
      }
      setTimeout(() => {
        handleInput();
        updateActiveCommands();
      }, 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Permettre Ctrl+B, Ctrl+I, Ctrl+U pour le formatage
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        execCommand('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        execCommand('italic');
      } else if (e.key === 'u') {
        e.preventDefault();
        execCommand('underline');
      }
    }
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      document.addEventListener('selectionchange', handleSelectionChange);
      editor.addEventListener('mouseup', handleSelectionChange);
      editor.addEventListener('keyup', handleSelectionChange);
      return () => {
        document.removeEventListener('selectionchange', handleSelectionChange);
        editor.removeEventListener('mouseup', handleSelectionChange);
        editor.removeEventListener('keyup', handleSelectionChange);
      };
    }
  }, []);

  return (
    <>
      <div className={`border border-gray-300 rounded-lg overflow-hidden ${className}`}>
        {/* Barre d'outils */}
        <div className="flex items-center gap-1 p-2 bg-gray-50 border-b border-gray-200 flex-wrap">
          <button
            type="button"
            onClick={() => execCommand('bold')}
            className={`p-2 rounded hover:bg-gray-200 transition ${
              activeCommands.bold
                ? 'bg-gray-300 text-green-600'
                : 'text-gray-700'
            }`}
            title="Gras (Ctrl+B)"
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            onClick={() => execCommand('italic')}
            className={`p-2 rounded hover:bg-gray-200 transition ${
              activeCommands.italic
                ? 'bg-gray-300 text-green-600'
                : 'text-gray-700'
            }`}
            title="Italique (Ctrl+I)"
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            onClick={() => execCommand('underline')}
            className={`p-2 rounded hover:bg-gray-200 transition ${
              activeCommands.underline
                ? 'bg-gray-300 text-green-600'
                : 'text-gray-700'
            }`}
            title="Souligné (Ctrl+U)"
          >
            <Underline size={16} />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            type="button"
            onClick={() => execCommand('insertUnorderedList')}
            className="p-2 rounded hover:bg-gray-200 transition text-gray-700"
            title="Liste à puces"
          >
            <List size={16} />
          </button>
          <button
            type="button"
            onClick={() => execCommand('insertOrderedList')}
            className="p-2 rounded hover:bg-gray-200 transition text-gray-700"
            title="Liste numérotée"
          >
            <ListOrdered size={16} />
          </button>
        </div>

        {/* Zone d'édition */}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          className="min-h-[120px] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          style={{
            minHeight: `${rows * 24}px`,
          }}
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] ul, [contenteditable] ol {
          margin-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
          padding-left: 1.5rem;
          display: block;
        }
        [contenteditable] ul {
          list-style-type: disc;
        }
        [contenteditable] ol {
          list-style-type: decimal;
        }
        [contenteditable] li {
          margin-bottom: 0.25rem;
          display: list-item;
        }
      `}</style>
    </>
  );
};

export default RichTextEditor;

