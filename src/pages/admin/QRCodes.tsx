import React, { useRef, useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';
import { Printer, Store, UtensilsCrossed, Download, FileArchive, Plus, Minus } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import JSZip from 'jszip';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function QRCodes() {
  const [tableCount, setTableCount] = useState<number>(20);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // Initial load from localStorage
    const cachedCount = localStorage.getItem('urbanPrime_tableCount');
    if (cachedCount) {
        setTableCount(parseInt(cachedCount, 10));
    }

    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists() && snap.data().tablesCount) {
        setTableCount(snap.data().tablesCount);
        localStorage.setItem('urbanPrime_tableCount', snap.data().tablesCount.toString());
      }
    });
  }, []);

  const updateTableCount = async (newCount: number) => {
    const val = Math.max(1, Math.min(50, newCount));
    setTableCount(val);
    
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'config'), {
        tablesCount: val,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.error(e);
    } finally {
       // Small delay to show "Saving" state visually if needed
       setTimeout(() => setIsSaving(false), 300);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getUrlForTable = (tableNum: number) => {
    const formattedNum = tableNum.toString().padStart(2, '0');
    return `${window.location.origin}/?mesa=${formattedNum}`;
  };

  const downloadSingleJPEG = async (index: number, tableNum: number) => {
    const node = cardRefs.current[index];
    if (!node) return;

    try {
      const dataUrl = await toJpeg(node, {
        quality: 1.0,
        pixelRatio: 4, // 4x scaling for ultra HD print
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      link.download = `Mesa_${tableNum.toString().padStart(2, '0')}_UrbanPrime.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro ao gerar JPEG', err);
      alert('Não foi possível gerar a imagem.');
    }
  };

  const downloadAllAsZip = async () => {
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("Tendas_QR_Code_UrbanPrime");

      for (let i = 0; i < tables.length; i++) {
        const node = cardRefs.current[i];
        if (!node) continue;

        const dataUrl = await toJpeg(node, {
          quality: 1.0,
          pixelRatio: 4,
          backgroundColor: '#ffffff' 
        });

        const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
        folder?.file(`Mesa_${tables[i].toString().padStart(2, '0')}.jpg`, base64Data, { base64: true });
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const link = document.createElement('a');
      link.download = `QR_Codes_AltaDefinicao_UrbanPrime.zip`;
      link.href = url;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao gerar ZIP", err);
      alert("Ocorreu um erro ao compactar as imagens.");
    } finally {
      setIsGenerating(false);
    }
  };

  const tables = Array.from({ length: tableCount }, (_, i) => i + 1);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto w-full print:p-0 print:m-0 print:bg-white print-section" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 pb-6 border-b border-black/5 print:hidden">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink tracking-tight">QR Codes das Mesas</h2>
          <p className="text-ink-muted font-medium mt-1">Gere cartões de mesa estilosos e baixe em alta resolução para a gráfica.</p>
        </div>
        <div className="mt-6 lg:mt-0 flex gap-3 w-full lg:w-auto flex-wrap sm:flex-nowrap">
          <div className="flex items-center bg-white border border-black/10 rounded-2xl p-1 shadow-sm w-full sm:w-auto shrink-0 justify-between">
            <div className="pl-4 pr-3 flex flex-col">
              <span className="text-ink-muted font-display font-bold uppercase tracking-widest text-[9px]">Atd. Mesas:</span>
              {isSaving && <span className="text-[8px] text-emerald-500 font-bold uppercase animate-pulse">Salvando...</span>}
            </div>
            <div className="flex items-center bg-oat rounded-xl p-1">
              <button 
                onClick={() => updateTableCount(tableCount - 1)}
                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-ink font-bold shadow-sm hover:text-brand transition-colors active:scale-95"
              >
                <Minus className="w-3 h-3 stroke-[3]" />
              </button>
              <input 
                type="number" 
                min="1"
                max="50"
                value={tableCount}
                onChange={(e) => updateTableCount(Number(e.target.value))}
                className="w-10 h-7 text-center font-display font-bold text-ink bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button 
                onClick={() => updateTableCount(tableCount + 1)}
                className="w-7 h-7 flex items-center justify-center bg-white rounded-lg text-ink font-bold shadow-sm hover:text-brand transition-colors active:scale-95"
              >
                <Plus className="w-3 h-3 stroke-[3]" />
              </button>
            </div>
          </div>

          <button 
            onClick={downloadAllAsZip}
            disabled={isGenerating}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-2xl font-display font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileArchive className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            <span className="truncate">{isGenerating ? 'Processando...' : 'Baixar ZIP (HD)'}</span>
          </button>

          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-2xl font-display font-bold uppercase tracking-widest text-[10px] hover:bg-brand-dark transition-all shadow-sm"
          >
            <Printer className="w-4 h-4 shrink-0" strokeWidth={2.5} />
            <span className="truncate">Imprimir A4</span>
          </button>
        </div>
      </div>

      {/* Grid of Stylized QR Code Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-4 print:block" style={{ pageBreakInside: 'avoid' }}>
        {tables.map((num, index) => {
          const formattedNum = num.toString().padStart(2, '0');
          const url = getUrlForTable(num);
          return (
            <div key={num} className="flex flex-col gap-4 print:break-inside-avoid print:mb-4">
              <motion.div 
                ref={(el) => { cardRefs.current[index] = el; }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-900 border-4 border-zinc-800 rounded-3xl overflow-hidden shadow-xl flex flex-col print:shadow-none print:border-black/50"
              >
                {/* Card Top / Header */}
                <div className="bg-brand text-white p-6 pb-2 relative flex flex-col items-center">
                  <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mb-3">
                    <UtensilsCrossed className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <h3 className="font-display font-black text-xl tracking-widest uppercase text-white/90">Mesa</h3>
                  <div className="font-display font-black text-[5rem] leading-[0.8] mb-4">{formattedNum}</div>
                </div>

                {/* Card Main Body */}
                <div className="bg-white flex-1 flex flex-col items-center justify-center p-6 relative">
                  <div className="text-center mb-6">
                    <p className="font-display font-black text-ink text-2xl uppercase tracking-widest leading-none mb-1">
                      Sem Filas
                    </p>
                    <p className="text-ink-muted text-sm font-medium">
                      Escaneie para pedir pelo celular
                    </p>
                  </div>
                  
                  <div className="bg-white p-3 rounded-2xl shadow-xl shadow-black/5 border border-black/5 mb-6">
                    <QRCodeSVG 
                      value={url} 
                      size={180}
                      level="H"
                      includeMargin={false}
                      className="rounded-lg"
                      fgColor="#18181b"
                      bgColor="#FFFFFF"
                    />
                  </div>

                  <div className="flex items-center gap-2 text-brand font-display font-black uppercase tracking-widest text-xs">
                    <Store className="w-4 h-4" /> URBAN PRIME
                  </div>
                </div>
              </motion.div>

              <button
                onClick={() => downloadSingleJPEG(index, num)}
                className="flex items-center justify-center gap-2 text-ink-muted hover:text-ink transition-colors font-display font-bold uppercase tracking-widest text-xs py-2 print:hidden group"
              >
                <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                Salvar JPEG
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
