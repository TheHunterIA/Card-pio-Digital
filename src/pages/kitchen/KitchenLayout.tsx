import React from 'react';
import { Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { LogOut, ChefHat, ArrowLeft } from 'lucide-react';

export default function KitchenLayout() {
  const { user, isKitchen, isAdmin, logout, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) return null;

  if (!user || (!isKitchen && !isAdmin)) {
    return <Navigate to="/cozinha/login" replace />;
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'Cozinha';

  return (
    <div className="min-h-screen bg-oat flex flex-col">
      <header className="bg-white h-20 border-b border-black/5 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-oat rounded-xl text-ink-muted hover:bg-black/5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center font-display font-black text-lg">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display font-bold text-ink text-sm leading-tight uppercase tracking-tight">{displayName}</h1>
            <p className="text-[10px] font-bold text-brand uppercase tracking-widest">Cozinha Urban Prime</p>
          </div>
        </div>
        
        <button 
          onClick={async () => {
            await logout();
            navigate('/cozinha/login');
          }}
          className="p-3 bg-oat rounded-xl text-ink-muted hover:text-red-500 transition-colors border border-black/5"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
