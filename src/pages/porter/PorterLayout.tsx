import React from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { LogOut, ShieldCheck, User, ArrowLeft } from 'lucide-react';

export default function PorterLayout() {
  const { user, isPorteiro, isAdmin, logout, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return null;

  if (!user || (!isPorteiro && !isAdmin)) {
    return <Navigate to="/portaria/login" replace />;
  }

  return (
    <div className="min-h-screen bg-oat">
      <header className="bg-white border-b border-black/5 h-20 flex items-center justify-between px-8 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-oat rounded-xl text-ink-muted hover:bg-black/5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display font-bold text-ink leading-tight">Portaria Prime</h1>
            <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Controle de Saída</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-oat rounded-2xl border border-black/5">
             <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                <User className="w-4 h-4 text-ink-muted" />
             </div>
             <span className="text-xs font-bold text-ink">{user.displayName || 'Porteiro'}</span>
          </div>
          <button 
            onClick={() => {
              logout();
              navigate('/portaria/login');
            }}
            className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
