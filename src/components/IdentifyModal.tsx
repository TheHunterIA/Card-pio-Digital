import React, { useState } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { User, Phone, Check } from 'lucide-react';

interface IdentifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function IdentifyModal({ isOpen, onClose, onConfirm }: IdentifyModalProps) {
  const { customerName, setCustomerName, whatsapp, setWhatsapp, lgpdStatus } = useStore();
  const [localName, setLocalName] = useState(customerName);
  const [localWhatsapp, setLocalWhatsapp] = useState(whatsapp);

  const isWhatsappRequired = lgpdStatus !== 'declined';

  const handleConfirm = () => {
    if (!localName.trim()) return;
    if (isWhatsappRequired && !localWhatsapp.trim()) return;
    
    setCustomerName(localName);
    setWhatsapp(localWhatsapp);
    onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 w-full bg-oat rounded-t-[40px] shadow-2xl z-[101] p-6 pb-[calc(2rem+env(safe-area-inset-bottom,20px))] max-w-2xl mx-auto right-0"
          >
            <div className="w-12 h-1.5 bg-black/10 rounded-full mx-auto mb-8" />

            <div className="text-center mb-8">
              <h2 className="text-3xl font-display font-bold text-ink mb-2 tracking-tight">Quase lá!</h2>
              <p className="text-ink-muted font-medium">Para prepararmos seu grelhado, como devemos te chamar?</p>
            </div>

            <div className="space-y-4 mb-8">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink-muted group-focus-within:text-brand">
                  <User className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent rounded-2xl leading-5 shadow-sm text-ink font-medium placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
                  placeholder="Nome Completo"
                />
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink-muted group-focus-within:text-brand">
                  <Phone className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  value={localWhatsapp}
                  onChange={(e) => setLocalWhatsapp(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-white border-2 border-transparent rounded-2xl leading-5 shadow-sm text-ink font-medium placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all"
                  placeholder={isWhatsappRequired ? "WhatsApp (com DDD)" : "WhatsApp (Opcional)"}
                />
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!localName.trim() || (isWhatsappRequired && !localWhatsapp.trim())}
              className="w-full bg-ink hover:bg-black disabled:bg-gray-200 text-white disabled:text-gray-400 font-display font-bold py-5 rounded-full active:scale-95 transition-all text-lg shadow-[0_8px_20px_-6px_rgba(28,25,23,0.3)] disabled:shadow-none tracking-wide flex items-center justify-center gap-2"
            >
              <Check className="w-6 h-6" strokeWidth={3} />
              Confirmar e Pagar
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
