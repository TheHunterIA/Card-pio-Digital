import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { LogIn, UtensilsCrossed } from 'lucide-react';

export default function AdminLogin() {
  const { user, isAdmin, signInAsAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isAdmin) {
      navigate('/admin/kds');
    }
  }, [user, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-oat flex flex-col items-center justify-center p-5 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="bg-white p-8 md:p-10 rounded-[32px] border border-black/5 shadow-sm w-full max-w-sm text-center relative z-10">
        <div className="mx-auto w-16 h-16 bg-brand text-white rounded-2xl flex items-center justify-center shadow-sm mb-6">
            <UtensilsCrossed className="w-8 h-8" strokeWidth={2} />
        </div>
        <h1 className="text-3xl font-display font-bold text-ink mb-2 tracking-tight">Urban Prime Admin</h1>
        <p className="text-ink-muted font-medium mb-8">Faça login com sua conta autorizada para gerenciar o restaurante.</p>

        <button 
          onClick={signInAsAdmin}
          className="w-full flex items-center justify-center gap-2 bg-ink text-white font-display font-bold py-4 px-6 rounded-full transition-all hover:bg-black active:scale-95 shadow-md tracking-wide"
        >
          <LogIn className="w-5 h-5" strokeWidth={2.5} />
          Acesso Restrito
        </button>

        {user && !isAdmin && (
          <p className="mt-6 text-xs font-display font-bold text-red-600 bg-red-50 border border-red-200 p-4 rounded-xl uppercase tracking-widest text-center leading-relaxed">
            Acesso Negado.<br/>Solicite liberação.
          </p>
        )}

         <div className="mt-8 text-center">
          <button 
            onClick={() => navigate('/')}
            className="text-[10px] uppercase tracking-widest font-display font-bold text-ink-muted hover:text-ink transition-colors"
          >
            Voltar ao Cardápio
          </button>
        </div>
      </div>
    </div>
  );
}
