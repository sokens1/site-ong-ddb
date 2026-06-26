import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Download, RefreshCw } from 'lucide-react';

interface Event {
  title: string;
  image_url: string | null;
}

interface PosterGeneratorModalProps {
  event: Event;
  defaultName: string;
  onClose: () => void;
}

const PosterGeneratorModal: React.FC<PosterGeneratorModalProps> = ({ event, defaultName, onClose }) => {
  const [name, setName] = useState(defaultName);
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhoto(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const drawPoster = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsGenerating(true);

    // Canvas size (e.g. Instagram portrait size)
    canvas.width = 1080;
    canvas.height = 1350;

    // Background Color
    ctx.fillStyle = '#064e3b'; // dark green
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Event Image as Background if available
    if (event.image_url) {
      try {
        const bgImg = await loadImage(event.image_url);
        
        // Draw image covering the top half and fading out
        const hRatio = canvas.width / bgImg.width;
        const vRatio = (canvas.height * 0.7) / bgImg.height;
        const ratio = Math.max(hRatio, vRatio);
        const centerShift_x = (canvas.width - bgImg.width * ratio) / 2;
        const centerShift_y = 0;
        
        ctx.globalAlpha = 0.4; // Darken background image
        ctx.drawImage(bgImg, 0, 0, bgImg.width, bgImg.height, centerShift_x, centerShift_y, bgImg.width * ratio, bgImg.height * ratio);
        ctx.globalAlpha = 1.0;
        
        // Gradient overlay to blend with bottom
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.7);
        gradient.addColorStop(0, 'rgba(6, 78, 59, 0)');
        gradient.addColorStop(1, 'rgba(6, 78, 59, 1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height * 0.7);
      } catch (e) {
        console.error("Error loading background image", e);
      }
    }

    // Draw User Photo
    if (photo) {
      try {
        const userImg = await loadImage(photo);
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2 - 100;
        const radius = 250;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        // Cover drawing for user image
        const imgRatio = Math.max((radius * 2) / userImg.width, (radius * 2) / userImg.height);
        const drawWidth = userImg.width * imgRatio;
        const drawHeight = userImg.height * imgRatio;
        
        ctx.drawImage(
          userImg, 
          centerX - drawWidth / 2, 
          centerY - drawHeight / 2, 
          drawWidth, 
          drawHeight
        );
        ctx.restore();

        // Add a nice border around the circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#4ade80'; // light green
        ctx.stroke();
      } catch (e) {
        console.error("Error loading user photo", e);
      }
    }

    // Text: J'y serai
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 80px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("J'Y SERAI !", canvas.width / 2, 150);

    // Text: Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 70px "Segoe UI", sans-serif';
    ctx.fillText(name.toUpperCase() || 'MON NOM', canvas.width / 2, canvas.height / 2 + 250);

    // Text: Event Title
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '50px "Segoe UI", sans-serif';
    // Wrap text for title
    wrapText(ctx, event.title, canvas.width / 2, canvas.height / 2 + 350, 900, 60);

    // Branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Segoe UI", sans-serif';
    ctx.fillText('ONG DDB', canvas.width / 2, canvas.height - 100);

    setIsGenerating(false);
  };

  // Helper to load image
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // Helper to wrap text
  const wrapText = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, currentY);
  };

  useEffect(() => {
    drawPoster();
  }, [name, photo]);

  const downloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `jy-serai-${name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row"
        onClick={e => e.stopPropagation()}
      >
        {/* Controls Section */}
        <div className="w-full md:w-1/3 bg-gray-50 p-8 flex flex-col border-r border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-800">Générer mon affiche</h3>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
              <X size={24} />
            </button>
          </div>
          
          <p className="text-gray-600 text-sm mb-8">Personnalisez votre affiche pour montrer à vos amis que vous participez à cet événement !</p>

          <div className="space-y-6 flex-1">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Votre nom affiché</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Votre photo</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-white hover:bg-gray-50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500 font-medium">Cliquez pour téléverser</p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            </div>
          </div>

          <button 
            onClick={downloadPoster}
            disabled={isGenerating || !photo}
            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-colors flex justify-center items-center gap-2 mt-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isGenerating ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
            Télécharger l'affiche
          </button>
        </div>

        {/* Canvas Preview Section */}
        <div className="w-full md:w-2/3 bg-gray-900 flex items-center justify-center p-8 relative">
          <div className="relative w-full max-w-sm mx-auto aspect-[4/5] rounded-xl overflow-hidden shadow-2xl">
             <canvas 
               ref={canvasRef} 
               className="w-full h-full object-contain bg-black"
             />
             {!photo && (
               <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white p-6 text-center backdrop-blur-sm">
                 <p className="font-semibold">Téléversez votre photo pour voir le résultat final.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PosterGeneratorModal;
