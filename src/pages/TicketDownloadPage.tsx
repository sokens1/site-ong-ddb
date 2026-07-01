import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { CheckCircle, Download, Calendar, MapPin, User } from 'lucide-react';

const TicketDownloadPage: React.FC = () => {
  const [params] = useSearchParams();
  const [downloaded, setDownloaded] = useState(false);
  const [error, setError] = useState(false);

  const fullname = params.get('name') || '';
  const eventTitle = params.get('event') || '';
  const eventDate = params.get('date') || '';
  const eventLocation = params.get('location') || '';

  const formattedDate = eventDate
    ? new Date(eventDate).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  const generatePDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [200, 100],
      });

      // Background
      doc.setFillColor(240, 253, 244);
      doc.rect(0, 0, 200, 100, 'F');

      // Header bar
      doc.setFillColor(20, 83, 45);
      doc.rect(0, 0, 200, 22, 'F');

      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text("BILLET D'ENTRÉE — ONG DDB", 100, 15, { align: 'center' });

      // Divider
      doc.setDrawColor(74, 222, 128);
      doc.setLineWidth(0.8);
      doc.line(10, 28, 145, 28);

      // Event title
      doc.setTextColor(17, 24, 39);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      const titleLines = doc.splitTextToSize(eventTitle, 130);
      doc.text(titleLines, 10, 36);

      // Details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(55, 65, 81);
      doc.text(`Participant : ${fullname}`, 10, 52);
      if (formattedDate) doc.text(`Date : ${formattedDate}`, 10, 62);
      if (eventLocation) doc.text(`Lieu : ${eventLocation}`, 10, 72);

      // Fine print
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text('Ce billet est personnel et non cessible — ONG Développement Durable et Bien-Être', 10, 90);

      // QR box
      doc.setDrawColor(20, 83, 45);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(152, 28, 40, 55, 3, 3, 'FD');

      // QR placeholder text
      doc.setTextColor(20, 83, 45);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('QR CODE', 172, 50, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('Présenter à', 172, 57, { align: 'center' });
      doc.text("l'entrée", 172, 62, { align: 'center' });

      const filename = `Billet_${eventTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      doc.save(filename);
      setDownloaded(true);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError(true);
    }
  };

  // Auto-download on page load
  useEffect(() => {
    if (fullname && eventTitle) {
      setTimeout(generatePDF, 500);
    }
  }, []);

  if (!fullname || !eventTitle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <p className="text-gray-500">Lien de billet invalide ou expiré.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">

        {/* Header */}
        <div className="bg-green-800 px-6 py-5 text-white text-center">
          <p className="text-xs text-green-300 uppercase tracking-widest font-semibold mb-1">ONG DDB</p>
          <h1 className="text-xl font-bold">Votre Billet d'Entrée</h1>
        </div>

        {/* Ticket card */}
        <div className="p-6">
          <div className="border-2 border-dashed border-green-200 rounded-xl bg-green-50 p-5 mb-5">
            <h2 className="text-lg font-bold text-green-800 mb-3 leading-tight">{eventTitle}</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <User size={15} className="text-green-600 flex-shrink-0" />
                <span><strong>Participant :</strong> {fullname}</span>
              </div>
              {formattedDate && (
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-green-600 flex-shrink-0" />
                  <span><strong>Date :</strong> {formattedDate}</span>
                </div>
              )}
              {eventLocation && (
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-green-600 flex-shrink-0" />
                  <span><strong>Lieu :</strong> {eventLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          {downloaded && !error && (
            <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm p-3 rounded-xl mb-4 border border-green-100">
              <CheckCircle size={16} className="flex-shrink-0" />
              <span>Votre billet PDF a été téléchargé automatiquement !</span>
            </div>
          )}
          {error && (
            <div className="text-red-500 text-sm mb-4 p-3 bg-red-50 rounded-xl border border-red-100">
              Une erreur est survenue lors de la génération. Cliquez sur le bouton ci-dessous.
            </div>
          )}

          {/* Download button */}
          <button
            onClick={generatePDF}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-green-200"
          >
            <Download size={18} />
            {downloaded ? 'Télécharger à nouveau' : 'Télécharger mon billet PDF'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Ce billet est personnel et non cessible.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TicketDownloadPage;
