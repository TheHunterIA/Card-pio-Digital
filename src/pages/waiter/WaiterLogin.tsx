import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { motion } from 'motion/react';
import { Coffee, Chrome } from 'lucide-react';

export default function WaiterLogin() {
  const { user, isWaiter, isAdmin, signInAsAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && (isWaiter || isAdmin)) {
      navigate('/garcom', { replace: true });
    }
  }, [user, isWaiter, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-oat flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full bg-white p-10 rounded-[48px] shadow-xl border border-black/5"
      >
        <div className="w-20 h-20 bg-brand rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-brand/20">
          <Coffee className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>

        <h1 className="text-3xl font-display font-bold text-ink mb-3 tracking-tight">ÁREA DO <span className="text-brand">GARÇOM</span></h1>
        <p className="text-ink-muted font-medium mb-12">Portal de atendimento Urban Prime Grill. Autentique-se para começar os lançamentos.</p>

        <button 
          onClick={signInAsAdmin}
          className="w-full group bg-ink hover:bg-black text-white py-5 rounded-2xl font-display font-medium flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl"
        >
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
             <Chrome className="w-4 h-4 text-ink" strokeWidth={3} />
          </div>
          Login com Google
        </button>

        {user && !isWaiter && !isAdmin && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-red-500 text-[10px] font-display font-black uppercase tracking-widest bg-red-50 py-4 px-6 rounded-2xl border border-red-100"
          >
            Acesso negado. A conta "{user.email}" não possui permissão de garçom. Solicite ao administrador o cadastro prévio.
          </motion.p>
        )}

        <p className="mt-12 text-ink-muted/30 text-[10px] font-display font-bold uppercase tracking-[0.2em]">
          Urban Prime Grill • Staff
        </p>
      </motion.div>
    </div>
  );
}
