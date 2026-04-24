import React, { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-black border border-yellow-600 rounded-xl p-4 shadow-2xl flex flex-col gap-3">
      <h3 className="text-yellow-500 font-bold text-lg">Instalar Urban Prime Grill</h3>
      <p className="text-gray-300 text-sm">Tenha nosso sistema sempre à mão. Acesso rápido e experiência aprimorada.</p>
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
