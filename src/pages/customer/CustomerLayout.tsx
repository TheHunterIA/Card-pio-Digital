import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, ChevronLeft, Home, UtensilsCrossed, ClipboardList } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, Order } from '../../store';
import { motion, AnimatePresence } from 'motion/react';

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, currentOrderId } = useStore();
  const [hasActiveOrder, setHasActiveOrder] = useState(false);
  
  const isHome = location.pathname === '/';
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    if (!currentOrderId) {
      setHasActiveOrder(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'orders', currentOrderId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Order;
        setHasActiveOrder(data.status !== 'finalizado' && data.status !== 'cancelado');
      } else {
        setHasActiveOrder(false);
      }
    }, (error) => {
      console.error("Layout order snapshot error:", error);
      useStore.getState().setCurrentOrderId(null);
      setHasActiveOrder(false);
    });

    return () => unsub();
  }, [currentOrderId]);

  const navItems = [
    { label: 'Início', icon: Home, path: '/' },
    { label: 'Cardápio', icon: UtensilsCrossed, path: '/cardapio', badge: cartItemCount > 0 ? cartItemCount : null },
    { label: hasActiveOrder ? 'Comanda Ativa' : 'Meus Pedidos', icon: ClipboardList, path: hasActiveOrder ? '/status' : '/pedidos', badge: hasActiveOrder ? '!' : null },
  ];

  return (
    <div className="min-h-screen font-sans selection:bg-brand-light bg-oat">
      {/* Dynamic Header */}
      {!isHome && (
        <header className="sticky top-0 z-40 bg-oat/90 backdrop-blur-xl safe-top">
          <div className="max-w-5xl mx-auto px-5 h-20 flex items-center justify-between">
            <button 
              onClick={() => {
                if (location.pathname === '/status') {
                  navigate('/pedidos');
                } else if (location.pathname === '/checkout') {
                  navigate('/cardapio');
                } else if (window.history.length <= 1) {
                  navigate('/');
                } else {
                  navigate(-1);
                }
              }}
              className="p-3 -ml-3 flex items-center justify-center rounded-2xl bg-white/50 border border-black/5 hover:bg-white transition-colors active:scale-95 shadow-sm"
            >
              <ChevronLeft className="w-5 h-5 text-ink" strokeWidth={2.5} />
            </button>
            <h1 className="font-display font-bold text-xl tracking-wide text-ink flex flex-col items-center leading-none">
              URBAN PRIME<span className="text-brand text-[10px] uppercase font-bold tracking-widest mt-0.5">Grill</span>
            </h1>
            
            {/* Cart Icon - Optional here since we have bottom nav badge, but good for quick access */}
            <div className="w-11" /> {/* Placeholder to balance header */}
          </div>
        </header>
      )}

      {/* Main Content Area - Mobile Optimized */}
      <main className="max-w-5xl mx-auto relative pb-32 min-h-[calc(100vh-5rem)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-full h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Hidden on linear flow pages */}
      <AnimatePresence>
        {!['/carrinho', '/checkout', '/produto'].some(path => location.pathname.includes(path)) && (
          <motion.nav 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 w-full z-50 bg-white/80 backdrop-blur-2xl border-t border-black/5 safe-bottom px-6 py-3 flex items-center justify-between shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]"
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path === '/status' && location.pathname === '/status');
              const Icon = item.icon;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 transition-all relative py-1 flex-1 ${isActive ? 'text-brand' : 'text-ink-muted'}`}
                >
                  <div className={`p-1.5 rounded-xl transition-all relative ${isActive ? 'bg-brand/10' : ''}`}>
                    <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 bg-brand text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm ring-2 ring-white">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-display font-bold uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div 
                      layoutId="navTab"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Floating Cart Button for Menu - Adjusted position for Bottom Nav */}
      <AnimatePresence>
        {cartItemCount > 0 && 
         ['/cardapio', '/produto'].some(path => location.pathname.includes(path)) && 
         !location.search.includes('edit=') && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[85px] left-0 w-full z-40 px-5"
          >
            <button 
              onClick={() => navigate('/carrinho')}
              className="max-w-xl mx-auto w-full bg-ink text-white rounded-2xl p-4 flex items-center justify-between shadow-2xl active:scale-[0.98] transition-all"
            >
              <div className="flex gap-4 items-center">
                <div className="bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shadow-sm">
                  {cartItemCount}
                </div>
                <span className="font-display font-semibold tracking-wide uppercase text-sm">Ver Carrinho</span>
              </div>
              <span className="font-bold text-lg">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  cart.reduce((sum, item) => {
                    const extrasPrice = (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
                    return sum + ((item.item.price + extrasPrice) * item.quantity);
                  }, 0)
                )}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
