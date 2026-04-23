import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { LayoutGrid, Utensils, MessageCircle, AlertCircle, ShieldCheck, Printer, X, CheckCircle2, BellRing, Sparkles, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PrintTicket from '../../components/PrintTicket';
import { QRCodeSVG } from 'qrcode.react';

export default function WaiterDashboard() {
  const navigate = useNavigate();
  const orders = useStore(state => state.orders);
  const setTableNumber = useStore(state => state.setTableNumber);
  const setOrderType = useStore(state => state.setOrderType);
  const [config, setConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
      setIsLoadingConfig(false);
    });
  }, []);

  // Generate tables based on config
  const tables = useMemo(() => {
    if (!config) return [];
    const count = config?.tablesCount || 1;
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      label: `Mesa ${i + 1}`
    }));
  }, [config]);

  const activeOrdersByTable = useMemo(() => {
    const map: Record<string, any[]> = {};
    orders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado').forEach(o => {
      if (o.tableNumber) {
        if (!map[o.tableNumber]) map[o.tableNumber] = [];
        map[o.tableNumber].push(o);
      }
    });
    return map;
  }, [orders]);

  const alerts = useMemo(() => {
    return orders.filter(o => 
      o.status !== 'finalizado' && o.status !== 'cancelado' && 
      (o.billRequested || o.status === 'pronto-entrega' || (o.type === 'dine-in' && o.status === 'saiu-entrega'))
    );
  }, [orders]);

  const handleTableClick = (tableId: string) => {
    navigate(`/garcom/comanda/${tableId}`);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Alerts Section (unchanged) */}
      {alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm">
          <h3 className="font-display font-bold text-red-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> Atenção Necessária ({alerts.length})
          </h3>
          <div className="space-y-2">
            {alerts.map(order => (
              <div key={order.id} className="bg-white p-4 rounded-2xl border border-red-100 flex items-center justify-between">
                <div>
                   <p className="font-bold text-ink">Mesa {order.tableNumber}</p>
                   <p className="text-sm text-red-600 font-medium">
                     {order.billRequested ? 'Solicitou a conta' : 'Pedido pronto para servir'}
                   </p>
                </div>
                {order.status === 'pronto-entrega' && (
                  <button onClick={() => navigate(`/garcom/comanda/${order.tableNumber}`)} className="bg-brand text-white text-xs font-bold px-4 py-2 rounded-xl">Ver Comanda</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink tracking-tight flex items-center gap-3">
            <LayoutGrid className="w-8 h-8 text-brand" strokeWidth={2.5} />
            Mesas
          </h2>
          <p className="text-ink-muted font-medium">Selecione uma mesa para gerenciar.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {isLoadingConfig ? (
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-[32px] bg-white animate-pulse border-2 border-black/5" />
          ))
        ) : (
          tables.map(table => {
            const tableOrders = activeOrdersByTable[table.id] || [];
            const isOccupied = tableOrders.length > 0;
            const pendingPix = tableOrders.some(o => o.paymentMethod === 'pix' && o.paymentStatus === 'pending');
            const hasBillRequest = tableOrders.some(o => o.billRequested);
            const hasReadyOrder = tableOrders.some(o => o.status === 'saiu-entrega' || o.status === 'pronto-entrega');

            return (
              <motion.div
                key={table.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleTableClick(table.id)}
                className={`relative overflow-hidden aspect-square rounded-[32px] border-2 transition-all p-4 flex flex-col items-center justify-center gap-2 cursor-pointer ${
                  hasReadyOrder
                    ? 'bg-brand border-brand text-white shadow-[0_0_30px_rgba(255,78,0,0.3)] animate-pulse'
                    : hasBillRequest
                      ? 'bg-amber-500 border-amber-500 text-black shadow-xl'
                      : isOccupied 
                        ? 'bg-ink border-ink text-white shadow-xl rotate-1' 
                        : 'bg-white border-black/5 text-ink hover:border-brand/30'
                }`}
              >
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                   {hasReadyOrder && (
                     <div className="bg-white text-brand px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 shadow-sm">
                        <BellRing className="w-2 h-2 animate-bounce" />
                        PRONTO!
                     </div>
                   )}
                   {hasBillRequest && !hasReadyOrder && (
                     <div className="bg-black text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm">
                        CONTA
                     </div>
                   )}
                </div>

                <span className={`font-display font-black text-4xl ${isOccupied || hasReadyOrder || hasBillRequest ? 'text-white' : 'text-ink'}`}>
                  {table.id}
                </span>
                
                <div className="flex gap-2">
                  {hasReadyOrder ? (
                    <BellRing className="w-6 h-6 text-white animate-bounce" />
                  ) : hasBillRequest ? (
                    <Receipt className="w-6 h-6 text-black" />
                  ) : pendingPix ? (
                    <AlertCircle className="w-6 h-6 text-white animate-pulse" />
                  ) : isOccupied ? (
                    <Utensils className="w-6 h-6 text-brand" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-ink/10" />
                  )}
                </div>

                <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.2em] ${(isOccupied || hasReadyOrder || hasBillRequest) ? 'text-white/60' : 'text-ink-muted'}`}>
                  {hasReadyOrder ? 'ENTREGAR' : hasBillRequest ? 'SOLICITOU CONTA' : isOccupied ? 'OCUPADA' : 'LIVRE'}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
        <h4 className="font-display font-bold text-ink mb-4 text-sm uppercase tracking-widest">Legenda</h4>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white border-2 border-black/5 rounded-md" />
            <span className="text-xs font-medium text-ink-muted">Mesa Livre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-ink rounded-md" />
            <span className="text-xs font-medium text-ink-muted">Mesa Ocupada</span>
          </div>
          <div className="flex items-center gap-2">
             <AlertCircle className="w-4 h-4 text-brand" />
            <span className="text-xs font-medium text-ink-muted">Aguardando PIX</span>
          </div>
          <div className="flex items-center gap-2">
             <BellRing className="w-4 h-4 text-brand" />
            <span className="text-xs font-medium text-ink-muted">Pedido Pronto</span>
          </div>
          <div className="flex items-center gap-2">
             <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-ink-muted">Conta Solicitada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
