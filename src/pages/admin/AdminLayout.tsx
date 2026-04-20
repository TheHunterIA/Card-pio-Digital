import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Navigate } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, UtensilsCrossed, Truck, Map, Users, QrCode, BookOpen, Menu, X, Contact, BarChart3, User, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthProvider';
import { subscribeToMenu } from '../../lib/database';

export default function AdminLayout() {
  const { user, isAdmin, loading, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Only subscribe if admin is loaded and logged in
    if (!loading && isAdmin) {
      const unsub = subscribeToMenu();
      return () => unsub();
    }
  }, [loading, isAdmin]);

  if (loading) {
    return <div className="min-h-screen bg-oat flex items-center justify-center font-display font-bold text-ink-muted">Carregando painel...</div>;
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-oat flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-display font-black text-ink mb-2">Acesso Restrito</h2>
        <p className="text-ink-muted mb-6">Você não possui permissões de administrador.</p>
        <button onClick={logout} className="bg-brand text-white px-6 py-3 rounded-xl font-bold">Sair</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-oat font-sans flex flex-col md:flex-row pb-16 md:pb-0 selection:bg-brand-light">
      
      {/* Top Header Mobile */}
      <header className="md:hidden bg-white border-b border-black/5 p-4 flex items-center justify-between z-[1001] sticky top-0 safe-top print:hidden shadow-sm">
        <h1 className="font-display font-bold text-lg tracking-wide text-ink flex items-center">
          URBAN PRIME<span className="text-brand text-[10px] uppercase font-bold tracking-widest ml-1 bg-brand/10 px-2 py-0.5 rounded-full">Painel</span>
        </h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className={`p-2 rounded-xl transition-all ${isMobileMenuOpen ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink border border-black/5'}`}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" strokeWidth={2.5} /> : <Menu className="w-6 h-6" strokeWidth={2.5} />}
          </button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-72 bg-white border-r border-black/5 flex-col h-screen sticky top-0 shadow-sm z-30 print:hidden">
        <div className="p-8 flex items-center justify-between border-b border-black/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-sm">
                <UtensilsCrossed className="w-5 h-5" strokeWidth={2} />
             </div>
            <h1 className="font-display font-bold text-xl tracking-wide text-ink flex flex-col leading-none">
              URBAN PRIME<span className="text-brand text-[10px] uppercase font-bold tracking-widest mt-0.5">Admin</span>
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-5 space-y-3 mt-8">
          <NavLink 
            to="/admin/kds" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <LayoutDashboard className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">KDS (Cozinha)</span>
          </NavLink>

          <NavLink 
            to="/admin/financeiro" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <BarChart3 className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Financeiro</span>
          </NavLink>
          
          <NavLink 
            to="/admin/cardapio" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <BookOpen className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Estoque & Menu</span>
          </NavLink>

          <NavLink 
            to="/admin/frota" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <Map className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Monitorar Frota</span>
          </NavLink>

          <NavLink 
            to="/admin/equipe" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <Users className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Equipe (Staff)</span>
          </NavLink>

          <NavLink 
            to="/admin/clientes" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <Contact className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Clientes</span>
          </NavLink>

          <NavLink 
            to="/admin/qrcode" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <QrCode className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Mesas / QR Code</span>
          </NavLink>

          <NavLink 
            to="/admin/config" 
            className={({isActive}) => `flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group ${
              isActive ? 'bg-brand text-white shadow-md' : 'text-ink-muted hover:text-ink hover:bg-oat border border-transparent'
            }`}
          >
            <Settings className={`w-6 h-6 transition-transform ${({isActive}) => isActive ? '' : 'group-hover:scale-110'}`} strokeWidth={2.5} />
            <span className="font-display font-bold tracking-wide">Configurações</span>
          </NavLink>

          <NavLink 
            to="/entregador" 
            className="flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group text-ink-muted hover:text-ink hover:bg-oat border border-transparent shadow-sm bg-white"
          >
            <Truck className="w-6 h-6 transition-transform group-hover:scale-110" strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-wide">Área do Entregador</span>
              <span className="text-[10px] text-ink-muted uppercase tracking-tighter">Logística</span>
            </div>
          </NavLink>

          <NavLink 
            to="/garcom" 
            className="flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group text-ink-muted hover:text-ink hover:bg-oat border border-transparent shadow-sm bg-white"
          >
            <User className="w-6 h-6 transition-transform group-hover:scale-110" strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-wide">Área do Garçom</span>
              <span className="text-[10px] text-ink-muted uppercase tracking-tighter">Atendimento</span>
            </div>
          </NavLink>

          <NavLink 
            to="/portaria" 
            className="flex items-center gap-4 px-5 py-4 rounded-2xl font-medium transition-all group text-ink-muted hover:text-ink hover:bg-oat border border-transparent shadow-sm bg-white"
          >
            <Shield className="w-6 h-6 transition-transform group-hover:scale-110" strokeWidth={2.5} />
            <div className="flex flex-col">
              <span className="font-display font-bold tracking-wide">Área da Portaria</span>
              <span className="text-[10px] text-ink-muted uppercase tracking-tighter">Controle</span>
            </div>
          </NavLink>
        </nav>

        <div className="p-5 border-t border-black/5 bg-oat/50">
          <button onClick={logout} className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl font-display font-bold text-ink-muted hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all">
            <LogOut className="w-5 h-5" strokeWidth={2.5} />
            <span className="tracking-wide">Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer (from TOP) */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] md:hidden"
            />
            <motion.div 
              initial={{ y: '-100%' }}
              animate={{ y: 0 }}
              exit={{ y: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 w-full bg-white rounded-b-[40px] z-[1001] pt-24 p-8 md:hidden shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-bold text-ink-muted uppercase tracking-widest text-[10px]">Menu do Sistema</h3>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NavLink 
                  to="/admin/kds" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-md' : 'bg-oat border-black/5 text-ink font-bold'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">KDS</span>
                </NavLink>

                <NavLink 
                  to="/admin/financeiro" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-md' : 'bg-oat border-black/5 text-ink font-bold'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Finanças</span>
                </NavLink>

                <NavLink 
                  to="/admin/cardapio" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-md' : 'bg-oat border-black/5 text-ink font-bold'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Cardápio</span>
                </NavLink>

                <NavLink 
                  to="/admin/frota" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-md' : 'bg-oat border-black/5 text-ink font-bold'
                  }`}
                >
                  <Map className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Frota</span>
                </NavLink>

                <NavLink 
                  to="/admin/entregadores" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-lg' : 'bg-oat border-transparent text-ink font-bold'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Equipe</span>
                </NavLink>

                <NavLink 
                  to="/admin/clientes" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-lg' : 'bg-oat border-transparent text-ink font-bold'
                  }`}
                >
                  <Contact className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Clientes</span>
                </NavLink>

                <NavLink 
                  to="/admin/qrcode" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-lg' : 'bg-oat border-transparent text-ink font-bold'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Mesas</span>
                </NavLink>

                <NavLink 
                  to="/admin/config" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({isActive}) => `flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                    isActive ? 'bg-brand text-white border-brand shadow-lg' : 'bg-oat border-transparent text-ink font-bold'
                  }`}
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wide">Geral</span>
                </NavLink>

                <NavLink 
                  to="/entregador" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-black text-white transition-all shadow-lg col-span-2"
                >
                  <Truck className="w-5 h-5 text-brand" strokeWidth={2} />
                  <span className="text-[10px] uppercase tracking-wide">Área do Entregador</span>
                </NavLink>

                <NavLink 
                  to="/garcom" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-black text-white transition-all shadow-lg col-span-2"
                >
                  <User className="w-5 h-5 text-brand" strokeWidth={2} />
                  <span className="text-[10px] uppercase tracking-wide">Área do Garçom</span>
                </NavLink>

                <NavLink 
                  to="/portaria" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 p-4 rounded-2xl bg-black text-white transition-all shadow-lg col-span-2"
                >
                  <Shield className="w-5 h-5 text-brand" strokeWidth={2} />
                  <span className="text-[10px] uppercase tracking-wide">Área da Portaria</span>
                </NavLink>
              </div>

              <button 
                onClick={logout}
                className="w-full mt-6 py-4 bg-red-50 text-red-600 font-display font-bold rounded-2xl flex items-center justify-center gap-2 border border-red-100 active:scale-95 transition-all text-xs uppercase"
              >
                <LogOut className="w-5 h-5" />
                Sair do Sistema
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 bg-oat h-screen w-full overflow-y-auto md:overflow-hidden flex flex-col relative print:h-auto print:overflow-visible print:bg-white print:block">
        <Outlet />
      </main>
    </div>
  );
}
