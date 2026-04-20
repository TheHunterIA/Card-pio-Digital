import React from 'react';
import { Outlet, Navigate, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { LogOut, Home, User, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function DriverLayout() {
  const { isDriver, isAdmin, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) return null;
  if (!isDriver && !isAdmin) return <Navigate to="/entregador/login" state={{ from: location }} replace />;

  return (
    <div className="flex flex-col h-screen bg-oat overflow-hidden">
      <header className="bg-white h-16 border-b border-black/5 flex items-center px-4 shrink-0">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 bg-oat rounded-xl text-ink-muted hover:bg-black/5 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="ml-4 font-display font-bold text-ink">Urban Prime Driver</h2>
      </header>
      <main className="flex-1 overflow-y-auto hide-scrollbar">
        <Outlet />
      </main>

      {/* Driver Bottom Nav */}
      <nav className="bg-white border-t border-black/5 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex justify-around items-center shrink-0 shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.1)] z-50">
        <NavLink 
          to="/entregador"
          end
          className={({isActive}) => `flex flex-col items-center gap-1 transition-all relative px-6 ${
            isActive ? 'text-brand' : 'text-ink-muted'
          }`}
        >
          {({isActive}) => (
            <>
              {isActive && <motion.div layoutId="driver-nav" className="absolute inset-x-2 -top-1 -bottom-1 bg-brand/10 rounded-xl -z-10" />}
              <Home className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Início</span>
            </>
          )}
        </NavLink>

        {isAdmin && (
          <NavLink 
            to="/admin"
            className={({isActive}) => `flex flex-col items-center gap-1 transition-all relative px-6 ${
              isActive ? 'text-brand' : 'text-ink-muted'
            }`}
          >
            {({isActive}) => (
              <>
                {isActive && <motion.div layoutId="driver-nav" className="absolute inset-x-2 -top-1 -bottom-1 bg-brand/10 rounded-xl -z-10" />}
                <ShieldCheck className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Admin</span>
              </>
            )}
          </NavLink>
        )}

        <button 
          onClick={logout}
          className="flex flex-col items-center gap-1 text-red-500 px-6 active:scale-95 transition-transform"
        >
          <LogOut className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Sair</span>
        </button>
      </nav>
    </div>
  );
}
