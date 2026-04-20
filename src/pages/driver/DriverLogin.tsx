import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { motion } from 'motion/react';
import { Motorbike, Chrome } from 'lucide-react';

export default function DriverLogin() {
  const { user, isDriver, isAdmin, signInAsAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && (isDriver || isAdmin)) {
      navigate('/entregador', { replace: true });
    }
  }, [user, isDriver, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full"
      >
        <div className="w-20 h-20 bg-brand rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(255,78,0,0.5)]">
          <Motorbike className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>

        <h1 className="text-4xl font-display font-bold text-white mb-3 tracking-tight italic">ENTREGADOR <span className="text-brand">PRIME</span></h1>
        <p className="text-white/60 font-medium mb-12">Portal logístico do Urban Prime Grill. Autentique-se para gerenciar suas entregas.</p>

        <button 
          onClick={signInAsAdmin}
          className="w-full group bg-white hover:bg-white/90 text-ink py-5 rounded-full font-display font-medium flex items-center justify-center gap-3 transition-all active:scale-95 shadow-2xl"
        >
          <div className="w-6 h-6 bg-oat rounded-full flex items-center justify-center">
             <Chrome className="w-4 h-4 text-ink-muted" strokeWidth={3} />
          </div>
          Login com Google
        </button>

        {user && !isDriver && !isAdmin && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 text-red-400 text-xs font-bold uppercase tracking-widest bg-red-400/10 py-4 px-6 rounded-2xl border border-red-400/20"
          >
            Acesso negado. A conta "{user.email}" não está registrada. Solicite ao administrador o cadastro prévio.
          </motion.p>
        )}

        <p className="mt-12 text-white/30 text-[10px] font-display font-bold uppercase tracking-[0.2em]">
          Powered by Urban Logistics
        </p>
      </motion.div>
    </div>
  );
}
