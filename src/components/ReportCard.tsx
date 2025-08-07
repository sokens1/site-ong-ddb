import React, { useState } from 'react';

interface Report {
  id: number;
  title: string;
  description: string;
  fileUrl: string;
  date: string;
  image: string;
}

interface ReportCardProps {
  report: Report;
}

const ReportCard: React.FC<ReportCardProps> = ({ report }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleVisualize = () => {
    setIsModalOpen(true);
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes('drive.google.com')) {
      const fileId = url.split('/d/')[1]?.split('/')[0];
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
    return url;
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="action-card bg-white rounded-lg overflow-hidden shadow-md relative hover:shadow-lg transition-shadow duration-300">
        <div className="h-48 overflow-hidden">
          <img
            src={report.image}
            alt={report.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4 sm:p-6">
          <div className="text-green-600 font-bold mb-2 text-sm">
            {report.date}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-green-800 mb-3 line-clamp-2">{report.title}</h3>
          <p className="text-gray-700 mb-4 text-sm sm:text-base line-clamp-3">{report.description}</p>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-3 mt-4">
            <button
              onClick={handleVisualize}
              className="text-green-600 font-medium hover:text-green-800 transition-colors duration-200 text-left"
            >
              Visualiser →
            </button>
            <a
              href={report.fileUrl}
              download
              className="text-blue-600 font-medium hover:text-blue-800 transition-colors duration-200 text-left sm:text-right"
            >
              Télécharger →
            </a>
          </div>
        </div>
      </div>

      {/* Modal pour visualiser le document */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl h-[95vh] w-full relative flex flex-col">
            {/* En-tête du modal */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-bold text-green-800">{report.title}</h2>
                <p className="text-green-600 text-sm">{report.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={report.fileUrl}
                  download
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200"
                  title="Télécharger le document"
                >
                  <i className="fas fa-download sm:mr-1"></i>
                  <span className="hidden sm:inline">Télécharger</span>
                </a>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 text-2xl bg-gray-100 rounded-full w-8 h-8 flex items-center justify-center transition-colors duration-200"
                  title="Fermer"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Contenu du document */}
            <div className="flex-1 overflow-hidden">
              {report.fileUrl.toLowerCase().endsWith('.pdf') || report.fileUrl.includes('drive.google.com') ? (
                <iframe
                  src={getEmbedUrl(report.fileUrl)}
                  className="w-full h-full border-0"
                  title={`Document: ${report.title}`}
                  allow="fullscreen"
                  onError={() => {
                    console.error('Erreur lors du chargement du document');
                  }}
                >
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">Impossible de charger le document dans le navigateur.</p>
                      <a
                        href={report.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Ouvrir dans un nouvel onglet →
                      </a>
                    </div>
                  </div>
                </iframe>
              ) : (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="text-center">
                    <i className="fas fa-file-alt text-6xl text-gray-400 mb-4"></i>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Aperçu non disponible</h3>
                    <p className="text-gray-600 mb-4">Ce type de fichier ne peut pas être prévisualisé dans le navigateur.</p>
                    <div className="flex gap-3 justify-center">
                      <a
                        href={report.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Ouvrir dans un nouvel onglet →
                      </a>
                      <a
                        href={report.fileUrl}
                        download
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Télécharger →
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportCard;
