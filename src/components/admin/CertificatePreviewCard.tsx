import React from 'react';
import { Check } from 'lucide-react';
import { CertificateTemplate } from '../../utils/certificatePdf';

interface CertificatePreviewCardProps {
  template: CertificateTemplate;
  selected: boolean;
  onSelect: () => void;
  eventTitle: string;
  logoUrl?: string;
  organizerLogos?: string[];
  certificateTitle?: string;
  certificateSubtitle?: string;
  certificateText?: string;
  certificateSignatoryName?: string;
  certificateSignatoryTitle?: string;
  certificateSignatorySignature?: string;
  certificateSignatory2Name?: string;
  certificateSignatory2Title?: string;
  certificateSignatory2Signature?: string;
  participantQuality?: string;
}

/** Aperçu HTML/CSS fidèle au rendu PDF réel (voir utils/certificatePdf.ts) */
const CertificatePreviewCard: React.FC<CertificatePreviewCardProps> = ({
  template,
  selected,
  onSelect,
  eventTitle,
  logoUrl,
  organizerLogos = [],
  certificateTitle,
  certificateSubtitle,
  certificateText,
  certificateSignatoryName,
  certificateSignatoryTitle,
  certificateSignatorySignature,
  certificateSignatory2Name,
  certificateSignatory2Title,
  certificateSignatory2Signature,
  participantQuality,
}) => {
  const title = eventTitle || "l'événement";

  // Formattage du texte
  const formatText = (raw?: string, fallback = '') => {
    const base = raw?.trim() || fallback;
    return base
      .replace(/\{name\}/gi, 'Andrea Sanchez')
      .replace(/\[nom\]/gi, 'Andrea Sanchez')
      .replace(/\{event\}/gi, title)
      .replace(/\[evenement\]/gi, title)
      .replace(/\{date\}/gi, '15 Octobre 2026')
      .replace(/\[date\]/gi, '15 Octobre 2026');
  };

  const cleanOrgLogos = (organizerLogos || []).filter(u => typeof u === 'string' && u.trim().length > 0).slice(0, 4);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full text-left rounded-2xl border-2 transition-all overflow-hidden ${
        selected ? 'border-green-500 shadow-lg shadow-green-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {selected && (
        <div className="absolute top-2.5 right-2.5 z-20 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center shadow">
          <Check size={14} className="text-white" strokeWidth={3} />
        </div>
      )}

      <div className="p-4 bg-gray-50">
        {template === 'dje' ? (
          // ── DJE Preview : guilloché crème, double cadre, Cinzel, sceau, 2 signatures ──
          <div className="aspect-[1.4/1] rounded-lg shadow-sm overflow-hidden relative border border-gray-200 select-none" style={{ background: '#FFFEFB', fontFamily: "'Cinzel', Georgia, serif" }}>
            {/* Cadre bleu épais externe */}
            <div className="absolute inset-[3%]" style={{ border: '4px solid #041c72' }} />
            {/* Cadre vert fin interne */}
            <div className="absolute inset-[6%]" style={{ border: '1px solid #087B42' }} />
            {/* Cadre bleu très fin */}
            <div className="absolute inset-[7%]" style={{ border: '0.5px solid #041c72', opacity: 0.6 }} />

            {/* Ornements de coins */}
            {([
              { top: '4.5%', left: '4.5%', transform: 'none' },
              { top: '4.5%', right: '4.5%', transform: 'scaleX(-1)' },
              { bottom: '4.5%', left: '4.5%', transform: 'scaleY(-1)' },
              { bottom: '4.5%', right: '4.5%', transform: 'scale(-1, -1)' },
            ] as React.CSSProperties[]).map((pos, i) => (
              <svg key={i} width="18" height="18" viewBox="0 0 54 54" aria-hidden="true" className="absolute" style={pos}>
                <path d="M6 30V6h24" fill="none" stroke="#087B42" strokeWidth="2" />
                <path d="M12 36V12h24" fill="none" stroke="#041c72" strokeWidth="1" />
                <rect x="1" y="1" width="10" height="10" fill="#087B42" transform="rotate(45 6 6)" />
              </svg>
            ))}

            {/* Logos organisateurs */}
            <div className="absolute left-0 right-0 top-[9%] flex justify-center items-center gap-3">
              {(cleanOrgLogos.length === 0
                ? ['/certificates/logo-ddb.png', logoUrl || '/certificates/logo-dje.png', '/certificates/logo-wila.png']
                : cleanOrgLogos.length === 2
                ? [cleanOrgLogos[0], logoUrl || '/certificates/logo-dje.png', cleanOrgLogos[1]]
                : cleanOrgLogos.slice(0, 4)
              ).map((url, i) => (
                <div key={i} className="flex items-center justify-center" style={{ height: '20px' }}>
                  <img src={url} alt="" className="max-h-full object-contain" style={{ maxWidth: '38px' }} />
                </div>
              ))}
            </div>

            {/* Filigrane guilloché (simulé par cercles SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 280" style={{ opacity: 0.07 }}>
              <circle cx="200" cy="140" r="100" fill="none" stroke="#041c72" strokeWidth="18" />
              <circle cx="200" cy="140" r="80" fill="none" stroke="#087B42" strokeWidth="8" />
              <circle cx="200" cy="140" r="60" fill="none" stroke="#041c72" strokeWidth="4" />
              <circle cx="200" cy="140" r="40" fill="none" stroke="#087B42" strokeWidth="2" />
            </svg>

            {/* CERTIFICAT */}
            <div className="absolute left-0 right-0 top-[27%] flex flex-col items-center text-center">
              <p className="font-bold tracking-[0.16em] leading-none" style={{ fontSize: '15px', color: '#041c72', fontFamily: "'Cinzel', Georgia, serif" }}>
                {(certificateTitle?.trim() || 'CERTIFICAT').toUpperCase()}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="block" style={{ width: '22px', height: '1px', background: '#087B42' }} />
                <span className="tracking-[0.18em] font-semibold" style={{ fontSize: '5px', color: '#087B42', fontFamily: "'Cinzel', Georgia, serif" }}>
                  {(certificateSubtitle?.trim() || 'DE PARTICIPATION').toUpperCase()}
                </span>
                <span className="block" style={{ width: '22px', height: '1px', background: '#087B42' }} />
              </div>

              <p className="mt-1 italic" style={{ fontSize: '4.5px', color: '#3A4566' }}>Ce certificat est décerné à</p>

              {/* Nom */}
              <p className="font-bold leading-snug border-b mt-0.5 px-3" style={{ fontSize: '10px', color: '#041c72', fontFamily: "'Cinzel', Georgia, serif", borderColor: '#087B42', minWidth: '100px', paddingBottom: '2px' }}>
                Andrea Sanchez
              </p>

              {/* Corps */}
              <p className="mt-1 leading-relaxed mx-4 line-clamp-2" style={{ fontSize: '4px', color: '#1C2541', maxWidth: '82%' }}>
                {certificateText?.trim()
                  ? formatText(certificateText).replace(/\{qualite\}/gi, participantQuality || '').replace(/\[qualite\]/gi, participantQuality || '')
                  : <>pour sa participation{participantQuality ? <> en qualité de <strong style={{ color: '#041c72' }}>{participantQuality}</strong></> : ''} à la 2ème édition du <strong style={{ color: '#041c72' }}>Déjeuner Environnemental (DJE)</strong></>
                }
              </p>
            </div>

            {/* Signatures bas */}
            <div className="absolute bottom-[8%] left-0 right-0 px-[10%] flex justify-between items-end">
              <div className="text-center flex flex-col items-center">
                {certificateSignatorySignature && (
                  <img src={certificateSignatorySignature} alt="" className="h-4 max-w-[44px] object-contain mb-0.5" />
                )}
                <span className="block mb-0.5" style={{ width: '55px', height: '0.5px', background: '#041c72' }} />
                <span className="font-bold tracking-wide" style={{ fontSize: '3.5px', color: '#041c72', fontFamily: "'Cinzel', Georgia, serif" }}>
                  {certificateSignatoryName?.trim() || 'M. ONDENO Franck'}
                </span>
                <span className="italic" style={{ fontSize: '3px', color: '#3A4566', maxWidth: '65px', display: 'block', textAlign: 'center' }}>
                  {certificateSignatoryTitle?.trim() || "Président de l'ONG DDB"}
                </span>
              </div>

              {/* Sceau central DJE */}
              <svg width="36" height="44" viewBox="0 0 130 150">
                <path d="M42 110 L30 148 L46 138 L54 150 L62 112 Z" fill="#041c72" />
                <path d="M88 110 L100 148 L84 138 L76 150 L68 112 Z" fill="#041c72" />
                <polygon points="128.0,65.0 121.8,69.5 127.2,74.9 120.4,78.3 124.9,84.5 117.7,86.8 121.1,93.6 113.6,94.8 116.0,102.0 108.3,102.0 109.5,109.5 102.0,108.3 102.0,116.0 94.8,113.6 93.6,121.1 86.8,117.7 84.5,124.9 78.3,120.4 74.9,127.2 69.5,121.8 65.0,128.0 60.5,121.8 55.1,127.2 51.7,120.4 45.5,124.9 43.2,117.7 36.4,121.1 35.2,113.6 28.0,116.0 28.0,108.3 20.5,109.5 21.7,102.0 14.0,102.0 16.4,94.8 8.9,93.6 12.3,86.8 5.1,84.5 9.6,78.3 2.8,74.9 8.2,69.5 2.0,65.0 8.2,60.5 2.8,55.1 9.6,51.7 5.1,45.5 12.3,43.2 8.9,36.4 16.4,35.2 14.0,28.0 21.7,28.0 20.5,20.5 28.0,21.7 28.0,14.0 35.2,16.4 36.4,8.9 43.2,12.3 45.5,5.1 51.7,9.6 55.1,2.8 60.5,8.2 65.0,2.0 69.5,8.2 74.9,2.8 78.3,9.6 84.5,5.1 86.8,12.3 93.6,8.9 94.8,16.4 102.0,14.0 102.0,21.7 109.5,20.5 108.3,28.0 116.0,28.0 113.6,35.2 121.1,36.4 117.7,43.2 124.9,45.5 120.4,51.7 127.2,55.1 121.8,60.5" fill="#087B42" />
                <circle cx="65" cy="65" r="52" fill="none" stroke="#FFFFFF" strokeWidth="1.4" />
                <circle cx="65" cy="65" r="31" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
                <text x="65" y="66" textAnchor="middle" fontFamily="Georgia, serif" fontSize="19" fontWeight="700" fill="#FFFFFF">DJE</text>
                <text x="65" y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" fontWeight="600" letterSpacing="1" fill="#FFFFFF">2026</text>
              </svg>

              <div className="text-center flex flex-col items-center">
                {certificateSignatory2Signature && (
                  <img src={certificateSignatory2Signature} alt="" className="h-4 max-w-[44px] object-contain mb-0.5" />
                )}
                <span className="block mb-0.5" style={{ width: '55px', height: '0.5px', background: '#041c72' }} />
                <span className="font-bold tracking-wide" style={{ fontSize: '3.5px', color: '#041c72', fontFamily: "'Cinzel', Georgia, serif" }}>
                  {certificateSignatory2Name?.trim() || 'Mme Pauline WHITE'}
                </span>
                <span className="italic" style={{ fontSize: '3px', color: '#3A4566', maxWidth: '65px', display: 'block', textAlign: 'center' }}>
                  {certificateSignatory2Title?.trim() || 'Présidente WILA — Gabon'}
                </span>
              </div>
            </div>
          </div>
        ) : template === 'classic' ? (
          <div className="aspect-[1.4/1] rounded-lg shadow-sm bg-white overflow-hidden relative border border-gray-200 select-none flex">
            {/* ── 1. Panneau vertical gauche Bauhaus ── */}
            <div className="w-[28%] h-full bg-[#f8faf8] relative border-r border-gray-100 flex-shrink-0 overflow-hidden">
              <svg viewBox="0 0 100 240" className="w-full h-full" preserveAspectRatio="none">
                {/* R1 */}
                <path d="M 0,0 L 50,0 A 50,50 0 0,1 0,50 Z" fill="#10b981" />
                <path d="M 100,0 L 50,0 A 50,50 0 0,1 100,50 Z" fill="#0d9488" />

                {/* R2 */}
                <path d="M 0,50 A 25,25 0 0,0 50,50 Z" fill="#0f4c5c" />
                <path d="M 100,50 L 50,50 A 50,50 0 0,1 100,100 Z" fill="#0f4c5c" />

                {/* R3 */}
                <path d="M 0,145 L 0,95 A 50,50 0 0,1 50,145 Z" fill="#f59e0b" />
                <path d="M 50,95 A 25,25 0 0,1 50,145 Z" fill="#0f4c5c" />

                {/* R4 */}
                <path d="M 0,145 A 25,25 0 0,0 50,145 Z" fill="#10b981" />
                <path d="M 50,190 L 50,145 A 45,45 0 0,1 95,190 Z" fill="#fb7185" />

                {/* R5 */}
                <path d="M 50,240 L 0,240 A 50,50 0 0,1 50,190 Z" fill="#0d9488" />
                <path d="M 50,240 L 50,190 A 50,50 0 0,1 100,240 Z" fill="#f59e0b" />
              </svg>
            </div>

            {/* ── 2. Accent ou Logo de l'événement en haut à droite ── */}
            <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5">
              {logoUrl ? (
                <div className="w-7 h-7 rounded-md overflow-hidden bg-white/90 border border-gray-100 shadow-sm flex items-center justify-center p-0.5">
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-8 h-4 pointer-events-none">
                  <svg viewBox="0 0 50 25" className="w-full h-full">
                    <path d="M 0,25 A 25,25 0 0,1 25,0 L 25,25 Z" fill="#10b981" />
                    <path d="M 25,25 L 25,0 A 25,25 0 0,1 50,25 Z" fill="#0f4c5c" />
                  </svg>
                </div>
              )}
            </div>

            {/* ── 3. Contenu textuel droit ── */}
            <div className="flex-1 flex flex-col justify-between p-3.5 pl-4 text-left">
              <div>
                <p className="text-[10px] font-black text-[#0d9488] leading-tight tracking-tight line-clamp-2">
                  {certificateTitle?.trim() || 'Certificat de participation'}
                </p>

                <p className="text-[6.5px] font-medium text-slate-700 mt-1.5">
                  {certificateSubtitle?.trim() || 'Délivré à'}
                </p>

                <div className="inline-block mt-0.5">
                  <p className="text-[11px] font-serif italic font-bold text-[#0d9488] leading-none">
                    Andrea Sanchez
                  </p>
                  <div className="w-full h-[1px] bg-[#0d9488] mt-0.5" />
                </div>

                <p className="text-[5.5px] text-slate-600 mt-1.5 line-clamp-2 max-w-[92%] leading-relaxed">
                  {formatText(certificateText, `Pour avoir participé à l'événement sur « ${title} »`)}
                </p>
              </div>

              {/* Bas de page : Badge date + Logos Organisateurs + Signature */}
              <div className="flex items-end justify-between pt-1 gap-2">
                {/* Badge Date */}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-4 h-2 overflow-hidden">
                    <svg viewBox="0 0 40 20" className="w-full h-full">
                      <path d="M 0,20 A 20,20 0 0,1 20,0 L 20,20 Z" fill="#fb7185" />
                      <path d="M 20,20 L 20,0 A 20,20 0 0,1 40,20 Z" fill="#f59e0b" />
                    </svg>
                  </div>
                  <span className="bg-[#0d9488] text-white text-[4px] font-black px-1.5 py-0.5 rounded tracking-wide">
                    JUIN 2030
                  </span>
                </div>

                {/* Logos organisateurs au bas */}
                {cleanOrgLogos.length > 0 && (
                  <div className="flex items-center gap-1 overflow-hidden px-1">
                    {cleanOrgLogos.map((url, i) => (
                      <div key={i} className="w-4 h-3 rounded bg-gray-50 border border-gray-200 p-0.5 flex items-center justify-center">
                        <img src={url} alt="Org" className="max-w-full max-h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Signature */}
                <div className="text-right flex-shrink-0">
                  <svg width="30" height="9" viewBox="0 0 50 16" fill="none" className="ml-auto mb-0.5">
                    <path d="M2 12 Q12 -2 20 10 T38 4 T48 10" stroke="#0f4c5c" strokeWidth="1.6" fill="none" />
                  </svg>
                  <div className="w-14 h-px bg-slate-300 ml-auto mb-0.5" />
                  <p className="text-[3.8px] text-slate-600 truncate max-w-[90px]">
                    {certificateSignatoryName?.trim() || 'Alfred Boyer'}, {certificateSignatoryTitle?.trim() || 'Directeur général'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="aspect-[1.4/1] rounded-lg shadow-sm bg-white overflow-hidden relative border border-gray-200 select-none">
            {/* 1. Bandeau supérieur bleu acier */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#6494c0]" />

            {/* 2. Cadre rectangulaire intérieur fin */}
            <div className="absolute inset-[6px] border border-[#6494c0]/50 pointer-events-none" />

            {/* 3. Motifs coin haut-gauche */}
            <div className="absolute top-0 left-0 w-2.5 h-5 bg-[#10549c]" />
            <div className="absolute top-2.5 left-3 w-2 h-2 bg-[#8eb9da]" />
            <div className="absolute top-0 left-5.5 w-1.5 h-1.5 bg-[#10549c]" />

            {/* 4. Bande verticale gauche */}
            <div className="absolute bottom-0 left-0 w-1.5 h-[40%] bg-[#10549c]" />

            {/* 5. Motifs coin bas-droit */}
            <div className="absolute bottom-0 right-0 w-8 h-3.5 bg-[#10549c]" />
            <div className="absolute bottom-4 right-7 w-2 h-2 bg-[#8eb9da]" />
            <div className="absolute bottom-0 right-0 w-1.5 h-7 bg-[#10549c]" />

            {/* 6. Rosette d'honneur avec rubans & Logo haut-droit */}
            <div className="absolute top-2 right-3 z-10 flex items-center gap-1.5">
              {logoUrl && (
                <div className="w-6 h-6 rounded bg-white shadow-sm border border-gray-100 p-0.5 flex items-center justify-center">
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                </div>
              )}
              <svg width="20" height="28" viewBox="0 0 36 50" fill="none" className="drop-shadow-sm">
                <path d="M12 20 L6 46 L14 40 L18 46 L17 22 Z" fill="#10549c" />
                <path d="M19 22 L18 46 L22 40 L30 46 L24 20 Z" fill="#0d4682" />
                <circle cx="18" cy="18" r="14" fill="#10549c" />
                <circle cx="18" cy="18" r="11" fill="#0c407d" />
                <circle cx="18" cy="18" r="8" fill="#1864b4" />
                <circle cx="18" cy="18" r="4.5" fill="#0c407d" />
              </svg>
            </div>

            {/* Contenu textuel */}
            <div className="relative h-full flex flex-col items-center justify-between text-center px-4 pt-3.5 pb-2.5 z-1">
              <div>
                <p className="text-[13px] font-black text-[#10549c] tracking-wider leading-tight">
                  {certificateTitle?.trim() || 'CERTIFICAT'}
                </p>
                <p className="text-[6.5px] font-bold text-slate-800 tracking-wider mt-0.5">
                  {certificateSubtitle?.trim() || 'DE RECONNAISSANCE'}
                </p>
                <p className="text-[4.5px] font-bold text-slate-400 tracking-widest mt-1 uppercase">EST DÉCERNÉ À :</p>
              </div>

              <div className="my-auto w-full">
                <p className="text-[12px] font-serif italic font-bold text-slate-900 tracking-wide leading-tight">
                  Olivia Thompson
                </p>
                <p className="text-[4.8px] text-slate-600 line-clamp-1 max-w-[85%] mx-auto mt-1">
                  {formatText(certificateText, `Pour ses réalisations et sa participation aux activités de « ${title} »`)}
                </p>
              </div>

              {/* Logos organisateurs au bas */}
              {cleanOrgLogos.length > 0 && (
                <div className="flex items-center justify-center gap-1 mb-1">
                  {cleanOrgLogos.map((url, i) => (
                    <div key={i} className="w-3.5 h-2.5 rounded bg-gray-50 border border-gray-200 p-0.5 flex items-center justify-center">
                      <img src={url} alt="Org" className="max-w-full max-h-full object-contain" />
                    </div>
                  ))}
                </div>
              )}

              {/* Signatures en bas */}
              <div className="w-full flex justify-between px-3 mt-0.5">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-px bg-slate-700 mb-0.5" />
                  <p className="text-[4.5px] font-bold text-slate-800 truncate max-w-[70px]">
                    {certificateSignatoryName?.trim() || 'Isabel Mercado'}
                  </p>
                  <p className="text-[3.5px] text-slate-400 uppercase tracking-tight">
                    {certificateSignatoryTitle?.trim() || 'SUPERVISEUR'}
                  </p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-px bg-slate-700 mb-0.5" />
                  <p className="text-[4.5px] font-bold text-slate-800">Adora Montminy</p>
                  <p className="text-[3.5px] text-slate-400 uppercase tracking-tight">VICE-PRÉSIDENT</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 bg-white flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {template === 'classic' ? 'Géométrique Bauhaus — vert & bleu, signature' : template === 'modern' ? 'Moderne — cadre bleu, rosette' : 'Élégant DJE — guilloché, Cinzel, sceau officiel'}
        </span>
        <span className={`text-[10px] font-bold uppercase tracking-wide ${selected ? 'text-green-600' : 'text-gray-300 group-hover:text-gray-400'}`}>
          {selected ? 'Sélectionné' : 'Choisir'}
        </span>
      </div>
    </button>
  );
};

export default CertificatePreviewCard;
