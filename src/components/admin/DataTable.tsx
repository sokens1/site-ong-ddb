import React, { useState } from 'react';
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  hiddenOnMobile?: boolean;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onAdd?: () => void;
  title: string;
  isLoading?: boolean;
  itemsPerPage?: number;
  selectable?: boolean;
  selectedRowIds?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
}

const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  onEdit,
  onDelete,
  onAdd,
  title,
  isLoading = false,
  itemsPerPage = 8,
  selectable = false,
  selectedRowIds = [],
  onSelectionChange,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds
  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [data.length, currentPage, totalPages]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded-lg w-1/4 mb-3"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 rounded-lg"></div>
            <div className="h-12 bg-gray-100 rounded-lg"></div>
            <div className="h-12 bg-gray-100 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden w-full max-w-full">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-bold text-gray-800 truncate">{title}</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 active:scale-95 transition-all text-sm font-semibold shadow-sm shadow-green-600/20 shrink-0"
          >
            <Plus size={18} />
            Ajouter
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-w-full">
        <div className="inline-block min-w-full align-middle max-w-full">
          <table className="w-full divide-y divide-gray-100 table-fixed">
            <thead className="bg-gray-50/70">
              <tr>
                {selectable && (
                  <th className="px-3 py-2.5 text-left w-12">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4"
                      checked={data.length > 0 && selectedRowIds.length === data.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          onSelectionChange?.(data.map(d => d.id));
                        } else {
                          onSelectionChange?.([]);
                        }
                      }}
                    />
                  </th>
                )}
                {columns.map((column) => {
                  const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
                  return (
                    <th
                      key={column.key}
                      className={`px-3 py-2.5 ${alignClass} text-xs font-semibold text-gray-500 uppercase tracking-wider ${column.hiddenOnMobile ? 'hidden sm:table-cell' : ''}`}
                    >
                      {column.label}
                    </th>
                  );
                })}
                {(onEdit || onDelete) && (
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                    className="px-4 py-8 text-center text-gray-400 text-sm"
                  >
                    Aucune donnée disponible
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-green-50/40 transition-colors">
                    {selectable && (
                      <td className="px-3 py-3 w-12">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer"
                          checked={selectedRowIds.includes(row.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onSelectionChange?.([...selectedRowIds, row.id]);
                            } else {
                              onSelectionChange?.(selectedRowIds.filter(id => id !== row.id));
                            }
                          }}
                        />
                      </td>
                    )}
                    {columns.map((column) => {
                      const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
                      return (
                        <td key={column.key} className={`px-3 py-3 text-sm text-gray-900 overflow-hidden ${alignClass} ${column.hiddenOnMobile ? 'hidden sm:table-cell' : ''}`}>
                          <div className={column.align === 'center' ? 'flex justify-center' : column.align === 'right' ? 'flex justify-end' : 'truncate max-w-full'}>
                            {column.render
                              ? column.render(row[column.key], row)
                              : row[column.key]?.toString() || '-'}
                          </div>
                        </td>
                      );
                    })}
                    {(onEdit || onDelete) && (
                      <td className="px-3 py-3 text-right text-sm font-medium w-24">
                        <div className="flex justify-end gap-2 shrink-0">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(row)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shrink-0"
                              title="Modifier"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.length > itemsPerPage && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/40 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-full overflow-x-hidden">
          <div className="text-sm text-gray-500 whitespace-nowrap">
            Affichage de <span className="font-semibold text-gray-700">{startIndex + 1}</span> à{' '}
            <span className="font-semibold text-gray-700">{Math.min(endIndex, data.length)}</span> sur{' '}
            <span className="font-semibold text-gray-700">{data.length}</span> résultats
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2rem] px-2 py-1.5 text-sm rounded-lg shrink-0 font-medium transition-all ${currentPage === page
                        ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                        : 'text-gray-600 hover:bg-white border border-transparent hover:border-gray-200'
                        }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-1 sm:px-2 text-gray-400 shrink-0">···</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg hover:bg-white hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;

