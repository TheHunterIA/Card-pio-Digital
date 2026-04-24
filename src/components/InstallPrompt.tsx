import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 1. Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('App já instalado em modo standalone');
      return;
    }

    const handler = (e: Event) => {
      console.log('Evento beforeinstallprompt disparado!');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    
    // Verificação de suporte
    console.log('Aguardando evento beforeinstallprompt...');

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.warn('O prompt de instalação ainda não está disponível.');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`Resultado do prompt: ${outcome}`);
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-black border border-yellow-600 rounded-xl p-4 shadow-2xl flex flex-col gap-3">
      <h3 className="text-yellow-500 font-bold text-lg">Instalar Urban Prime Grill</h3>
      <p className="text-gray-300 text-sm">Toque abaixo para instalar o app e ter acesso rápido.</p>
      <div className="flex gap-2">
        <button 
          onClick={() => setShowPrompt(false)} 
          className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition"
        >
          Agora não
        </button>
        <button 
          onClick={handleInstall} 
          className="flex-1 px-4 py-2 bg-yellow-600 text-black rounded-lg text-sm font-bold hover:bg-yellow-500 transition"
        >
          Instalar App
        </button>
      </div>
    </div>
  );
}
