import React from 'react';

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
  return (
    <div className="action-card bg-white rounded-lg overflow-hidden shadow-md relative">
      <div className="h-48 overflow-hidden">
        <img
          src={report.image}
          alt={report.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-6">
        <div className="text-green-600 font-bold mb-2">
          {report.date}
        </div>
        <h3 className="text-xl font-bold text-green-800 mb-3">{report.title}</h3>
        <p className="text-gray-700 mb-4">{report.description}</p>
        <div className="flex justify-between mt-4">
          <a
            href={report.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-600 font-medium hover:text-green-800"
          >
            Visualiser →
          </a>
          <a
            href={report.fileUrl}
            download
            className="text-blue-600 font-medium hover:text-blue-800"
          >
            Télécharger →
          </a>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
