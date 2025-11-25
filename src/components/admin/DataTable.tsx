import React, { useState } from 'react';
import { Edit, Trash2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
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
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden w-full max-w-full">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-xl font-bold text-gray-800 truncate">{title}</h2>
        {onAdd && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition text-sm shrink-0"
          >
            <Plus size={20} />
            Ajouter
          </button>
        )}
      </div>

      <div className="overflow-x-auto max-w-full">
        <div className="inline-block min-w-full align-middle max-w-full">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => {
                  const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
                  return (
                    <th
                      key={column.key}
                      className={`px-3 py-2 ${alignClass} text-xs font-medium text-gray-500 uppercase tracking-wider`}
                    >
                      {column.label}
                    </th>
                  );
                })}
                {(onEdit || onDelete) && (
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (onEdit || onDelete ? 1 : 0)}
                    className="px-4 py-3 text-center text-gray-500"
                  >
                    Aucune donnée disponible
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-gray-50">
                    {columns.map((column) => {
                      const alignClass = column.align === 'center' ? 'text-center' : column.align === 'right' ? 'text-right' : 'text-left';
                      return (
                        <td key={column.key} className={`px-3 py-3 text-sm text-gray-900 overflow-hidden ${alignClass}`}>
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
                              className="text-blue-600 hover:text-blue-900 shrink-0"
                              title="Modifier"
                            >
                              <Edit size={18} />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="text-red-600 hover:text-red-900 shrink-0"
                              title="Supprimer"
                            >
                              <Trash2 size={18} />
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
        <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-full overflow-x-hidden">
          <div className="text-sm text-gray-700 whitespace-nowrap">
            Affichage de <span className="font-medium">{startIndex + 1}</span> à{' '}
            <span className="font-medium">{Math.min(endIndex, data.length)}</span> sur{' '}
            <span className="font-medium">{data.length}</span> résultats
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Précédent
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
                      className={`px-2 sm:px-3 py-1.5 text-sm border rounded-lg shrink-0 ${
                        currentPage === page
                          ? 'bg-green-600 text-white border-green-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-1 sm:px-2 text-gray-500 shrink-0">...</span>;
                }
                return null;
              })}
            </div>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataTable;

