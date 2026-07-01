import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { ScanLine, CheckCircle, XCircle, Search, User, Calendar, MapPin, RefreshCw, Camera, StopCircle, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';

interface ScanResult {
  status: 'valid' | 'already_scanned' | 'invalid' | 'idle';
  registration?: {
    id: number;
    fullname: string;
    email: string;
    scanned_at?: string;
    event: { title: string; event_date: string; location?: string };
    created_at: string;
  };
  message?: string;
}

const ScanPage: React.FC = () => {
  const [scanInput, setScanInput] = useState('');
  const [result, setResult] = useState<ScanResult>({ status: 'idle' });
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanResult['registration'][]>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  const performScan = async (input: string) => {
    if (!input.trim()) return;
    setLoading(true);
    setResult({ status: 'idle' });

    try {
      // Parse QR code format
      const lines = input.trim().split('\n');
      let fullname = '';
      let eventTitle = '';

      lines.forEach(line => {
        if (line.startsWith('Participant:')) fullname = line.replace('Participant:', '').trim();
        if (line.startsWith('Evenement:')) eventTitle = line.replace('Evenement:', '').trim();
      });

      let query = supabase
        .from('event_registrations')
        .select(`
          id,
          fullname,
          email,
          created_at,
          scanned_at,
          events!inner (
            title,
            event_date,
            location
          )
        `)
        .limit(1);

      if (fullname && eventTitle) {
        query = query.ilike('fullname', `%${fullname}%`);
      } else {
        const numId = parseInt(input.trim());
        if (!isNaN(numId)) {
          query = query.eq('id', numId);
        } else {
          query = query.ilike('email', `%${input.trim()}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        setResult({ status: 'invalid', message: 'Aucune inscription trouvée pour ce billet. Vérifiez le code ou réessayez.' });
      } else {
        const reg = data[0] as any;
        const registration = {
          id: reg.id,
          fullname: reg.fullname,
          email: reg.email,
          scanned_at: reg.scanned_at,
          created_at: reg.created_at,
          event: {
            title: reg.events?.title || '—',
            event_date: reg.events?.event_date || '',
            location: reg.events?.location,
          }
        };

        if (reg.scanned_at) {
          // Already scanned ticket
          setResult({
            status: 'already_scanned',
            registration,
            message: `Ce billet a déjà été scanné le ${new Date(reg.scanned_at).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
            })}`
          });
        } else {
          // Mark ticket as scanned in the database immediately
          const scanTime = new Date().toISOString();
          const { error: updateError } = await supabase
            .from('event_registrations')
            .update({ scanned_at: scanTime })
            .eq('id', reg.id);

          if (updateError) throw updateError;

          registration.scanned_at = scanTime;
          setResult({ status: 'valid', registration });

          // Add to history
          setRecentScans(prev => {
            const exists = prev.some(item => item?.id === registration.id);
            if (exists) return prev;
            return [registration, ...prev.slice(0, 9)];
          });
        }
      }
    } catch (err: any) {
      setResult({ status: 'invalid', message: err.message || 'Erreur lors de la vérification.' });
    } finally {
      setLoading(false);
    }
  };

  // Setup / teardown scanner
  useEffect(() => {
    if (cameraActive) {
      setCameraError(null);
      const timeout = setTimeout(() => {
        try {
          const scanner = new Html5Qrcode("reader");
          qrScannerRef.current = scanner;

          scanner.start(
            { facingMode: "environment" },
            {
              fps: 15,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.75;
                return { width: size, height: size };
              }
            },
            (qrCodeMessage) => {
              performScan(qrCodeMessage);
              setCameraActive(false);
            },
            () => {
              // silent scan failures
            }
          ).catch(err => {
            console.error("Camera start error:", err);
            setCameraError("Impossible d'accéder à la caméra. Veuillez autoriser l'accès.");
            setCameraActive(false);
          });
        } catch (e: any) {
          console.error("Scanner init error:", e);
          setCameraError("Erreur d'initialisation de la caméra.");
          setCameraActive(false);
        }
      }, 300);

      return () => {
        clearTimeout(timeout);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [cameraActive]);

  const stopScanner = () => {
    if (qrScannerRef.current) {
      if (qrScannerRef.current.isScanning) {
        qrScannerRef.current.stop().catch(err => console.error("Stop scanner error", err));
      }
      qrScannerRef.current = null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(scanInput);
  };

  const handleReset = () => {
    setScanInput('');
    setResult({ status: 'idle' });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4 md:py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <ScanLine size={22} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Scan des billets</h1>
          <p className="text-xs md:text-sm text-gray-500">Vérifiez et validez les billets des participants.</p>
        </div>
      </div>

      {/* Main scanner container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        {/* Toggle Scan Mode */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setCameraActive(true)}
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              cameraActive
                ? 'border-green-600 text-green-700 bg-green-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Camera size={18} />
            Scanner par Caméra
          </button>
          <button
            onClick={() => setCameraActive(false)}
            className={`flex-1 py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
              !cameraActive
                ? 'border-green-600 text-green-700 bg-green-50/30'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Search size={18} />
            Saisie manuelle
          </button>
        </div>

        <div className="p-5">
          {/* CAMERA SCANNER */}
          {cameraActive && (
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-full max-w-sm aspect-square bg-black rounded-xl overflow-hidden shadow-inner border border-gray-200">
                <div id="reader" className="w-full h-full object-cover"></div>
                {/* Glowing scan target overlay */}
                <div className="absolute inset-0 border-4 border-dashed border-green-500/40 pointer-events-none rounded-xl m-6 animate-pulse" />
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-green-500 shadow-[0_0_8px_#22c55e] animate-bounce pointer-events-none" />
              </div>
              <button
                onClick={() => setCameraActive(false)}
                className="mt-4 flex items-center gap-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg transition-all"
              >
                <StopCircle size={14} /> Arrêter la caméra
              </button>
            </div>
          )}

          {/* MANUAL INPUT */}
          {!cameraActive && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs md:text-sm text-gray-600">
                Entrez le <strong>contenu du QR Code</strong>, un <strong>ID d'inscription</strong> ou l'<strong>email</strong> du participant.
              </p>
              <div className="relative">
                <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
                <input
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="ID inscription (ex: 42) ou email..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none shadow-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading || !scanInput.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-xl transition-all disabled:opacity-50 text-sm shadow-sm"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ScanLine size={18} />
                  )}
                  {loading ? 'Vérification...' : 'Vérifier'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition-colors"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </form>
          )}

          {cameraError && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              {cameraError}
            </div>
          )}
        </div>
      </div>

      {/* Result feedback */}
      <AnimatePresence mode="wait">
        {result.status === 'valid' && result.registration && (
          <motion.div
            key="valid"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-sm border-2 border-emerald-400 p-5 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={24} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none">Billet Valide ✓</p>
                <p className="text-base font-bold text-gray-900">Accès autorisé</p>
              </div>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-4 space-y-3 text-xs md:text-sm">
              <div className="flex items-start gap-2.5">
                <User size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Participant</p>
                  <p className="font-bold text-gray-900">{result.registration.fullname}</p>
                  <p className="text-xs text-gray-500">{result.registration.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Événement</p>
                  <p className="font-bold text-gray-900 leading-snug">{result.registration.event.title}</p>
                  {result.registration.event.event_date && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(result.registration.event.event_date).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              </div>
              {result.registration.event.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Lieu</p>
                    <p className="font-semibold text-gray-800 leading-snug">{result.registration.event.location}</p>
                  </div>
                </div>
              )}
              <div className="pt-2.5 border-t border-emerald-100 flex items-center justify-between text-[10px] text-gray-400">
                <span>ID inscription: #{result.registration.id}</span>
                <span>Inscrit le {new Date(result.registration.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
          </motion.div>
        )}

        {result.status === 'already_scanned' && result.registration && (
          <motion.div
            key="already_scanned"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-sm border-2 border-amber-400 p-5 mb-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={24} className="text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest leading-none">Déjà Scanné ⚠️</p>
                <p className="text-base font-bold text-gray-900">Attention : Passage répété</p>
              </div>
            </div>
            <div className="bg-amber-50/50 rounded-xl p-4 space-y-3 text-xs md:text-sm">
              <p className="text-amber-800 font-medium text-xs bg-amber-100/50 px-3 py-2 rounded-lg">
                {result.message}
              </p>
              <div className="flex items-start gap-2.5 mt-2">
                <User size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Participant</p>
                  <p className="font-bold text-gray-900">{result.registration.fullname}</p>
                  <p className="text-xs text-gray-500">{result.registration.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Événement</p>
                  <p className="font-bold text-gray-900">{result.registration.event.title}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {result.status === 'invalid' && (
          <motion.div
            key="invalid"
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl shadow-sm border-2 border-red-300 p-5 mb-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle size={24} className="text-red-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-none">Billet Invalide ✗</p>
                <p className="text-sm md:text-base font-bold text-gray-900 mt-0.5">Accès refusé</p>
                <p className="text-xs text-gray-500 mt-1">{result.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent scans list */}
      {recentScans.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-5">
          <h3 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wider">Dernières vérifications</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentScans.map((reg, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={12} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{reg?.fullname}</p>
                    <p className="text-[10px] text-gray-400 truncate">{reg?.event.title}</p>
                  </div>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">Valide</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
