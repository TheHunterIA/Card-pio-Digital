import React from 'react';
import { useAuth } from '../../lib/AuthProvider';
import { Navigate, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn, Chrome } from 'lucide-react';
import { motion } from 'motion/react';

export default function PorterLogin() {
  const { user, isPorteiro, isAdmin, signInAsAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;
  if (user && (isPorteiro || isAdmin)) return <Navigate to="/portaria" replace />;

  const handleLogin = async () => {
    try {
      await signInAsAdmin();
    } catch (e) {
      console.error(e);
      alert('Erro ao fazer login. Verifique se você é um porteiro autorizado.');
    }
  };

  return (
    <div className="min-h-screen bg-oat flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl border border-black/5 text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600" />
        
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner">
          <ShieldCheck className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-display font-black text-ink mb-3 tracking-tight italic">PORTARIA PRIME</h1>
        <p className="text-ink-muted mb-10 font-medium leading-relaxed">
          Acesso exclusivo para controle de liberação de saída de clientes.
        </p>

        <button 
          onClick={handleLogin}
          className="w-full h-16 bg-ink text-white rounded-2xl font-display font-bold uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-4 hover:shadow-xl active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:text-ink transition-colors">
            <Chrome className="w-5 h-5" />
          </div>
          Entrar com Google
        </button>

        <p className="mt-8 text-[10px] text-ink-muted uppercase font-black tracking-widest opacity-40">
          Urban Prime • Security Module
        </p>
      </motion.div>
    </div>
  );
}
