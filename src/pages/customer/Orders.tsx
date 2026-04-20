import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, Order } from '../../store';
import { addMenuItem, toggleMenuItem, updateMenuPrice, deleteMenuItem, placeOrder } from '../../lib/database';
import { Clock, ChevronRight, ChefHat, Motorbike, CheckCircle2, Package, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../../lib/AuthProvider';

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrderId } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : new Date().toISOString()
      } as Order));
      setOrders(ordersData);
      setLoading(false);
    });
  }, [user?.uid]);

  const activeOrder = orders.find(o => o.status !== 'finalizado' && o.status !== 'cancelado');
  const historyOrders = orders.filter(o => o.status === 'finalizado' || o.status === 'cancelado');

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'preparando': return ChefHat;
      case 'em-rota': return Motorbike;
      case 'pronto-entrega': return Package;
      case 'finalizado': return CheckCircle2;
      default: return Clock;
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'na-fila': return 'Na Fila';
      case 'preparando': return 'Em Preparo';
      case 'pronto-entrega': return 'Pronto / Aguardando';
      case 'em-rota': return 'A Caminho';
      case 'finalizado': return 'Finalizado';
      case 'cancelado': return 'Cancelado';
      case 'saiu-entrega': return 'A Caminho';
      default: return 'Processando';
    }
  };

  const statusColors: Record<string, string> = {
    'na-fila': 'text-ink-muted bg-oat',
    'preparando': 'text-ink bg-brand/10',
    'pronto-entrega': 'text-ink bg-brand/10',
    'em-rota': 'text-brand bg-brand/5',
    'finalizado': 'text-emerald-700 bg-emerald-50',
    'cancelado': 'text-red-700 bg-red-50',
    'saiu-entrega': 'text-brand bg-brand/5',
  };

  const handleReorder = (order: Order) => {
    // Add all items from the old order back to the cart
    useStore.setState({ cart: order.items });
    navigate('/carrinho');
  };

  return (
    <div className="p-6 max-w-lg mx-auto pb-32">
      <header className="mb-8">
        <h2 className="text-3xl font-display font-black text-ink tracking-tight uppercase">Meus Pedidos</h2>
        <p className="text-ink-muted text-xs font-display font-bold uppercase tracking-widest mt-1">Histórico & Acompanhamento</p>
      </header>
      
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-white/50 animate-pulse rounded-3xl border border-black/5" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Order Highlight */}
          {activeOrder && (
            <section>
              <h3 className="text-[10px] font-display font-bold text-brand uppercase tracking-[0.2em] mb-4">Ativo Agora</h3>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  useStore.setState({ currentOrderId: activeOrder.id });
                  navigate('/status');
                }}
                className="bg-ink text-white rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden group active:scale-[0.98] transition-all cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand/20 rounded-full blur-3xl -mr-16 -mt-16" />
                
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <span className="text-[10px] font-display font-bold text-white/40 uppercase tracking-widest">Acompanhar Pedido</span>
                    <h4 className="text-2xl font-display font-bold text-white mt-1">Status: {getStatusText(activeOrder.status)}</h4>
                  </div>
                  <div className="bg-brand p-3 rounded-2xl shadow-lg shadow-brand/20 animate-pulse">
                    {React.createElement(getStatusIcon(activeOrder.status), { className: "w-6 h-6 text-white", strokeWidth: 2.5 })}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white/10 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                      <Clock className="w-5 h-5 text-white/60" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white/60">Última atualização</p>
                      <p className="text-sm font-display font-bold">{new Date(activeOrder.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-brand" />
                </div>
              </motion.div>
            </section>
          )}

          {/* History List */}
          <section>
            <h3 className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-[0.2em] mb-4">
              {historyOrders.length > 0 ? 'Histórico Anterior' : activeOrder ? '' : 'Nenhum pedido encontrado'}
            </h3>
            
            <div className="space-y-3">
              <AnimatePresence>
                {historyOrders.map((order, index) => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => {
                      useStore.setState({ currentOrderId: order.id });
                      navigate('/status');
                    }}
                    className="bg-white p-4 rounded-3xl shadow-sm border border-black/5 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:border-brand/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${statusColors[order.status] || 'bg-oat text-ink'}`}>
                        {React.createElement(getStatusIcon(order.status), { className: "w-6 h-6", strokeWidth: 2 })}
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-ink text-sm flex items-center gap-1.5">
                           Pedido #{order.id.substring(0, 4).toUpperCase()}
                           {order.type === 'dine-in' ? (
                             <span className="bg-oat text-ink px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">Mesa {order.tableNumber || '-'}</span>
                           ) : (
                             <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded text-[8px] font-black tracking-widest uppercase">Entrega</span>
                           )}
                        </h3>
                        <p className="text-[10px] text-ink-muted font-bold uppercase tracking-wider">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')} • {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           handleReorder(order);
                         }}
                         className="p-2 text-brand hover:bg-brand/10 rounded-xl transition-all mr-1"
                         title="Repetir este pedido"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <span className={`text-[9px] font-display font-bold uppercase px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-oat text-ink'}`}>
                        {getStatusText(order.status)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-ink-muted" strokeWidth={3} />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {orders.length === 0 && !loading && (
                <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-black/5">
                  <Package className="w-12 h-12 text-ink-muted mx-auto mb-4 opacity-20" />
                  <p className="text-ink-muted font-display font-bold text-sm tracking-wide">SUA BANDEJA ESTÁ VAZIA</p>
                  <button 
                    onClick={() => navigate('/cardapio')}
                    className="mt-6 text-brand font-display font-black text-xs uppercase tracking-widest border-b-2 border-brand pb-1 active:opacity-50"
                  >
                    Abrir Cardápio
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
