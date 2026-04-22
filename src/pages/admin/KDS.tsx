import React, { useMemo, useState } from 'react';
import { useStore, OrderStatus as StatusType, Order } from '../../store';
import { updateOrderStatus, confirmPayment } from '../../lib/database';
import { Clock, ChefHat, Motorbike, Check, AlertCircle, Package, MessageCircle, Info, History, X, Phone, Receipt, Printer, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PrintTicket from '../../components/PrintTicket';

export default function KDS() {
  const orders = useStore(state => state.orders);
  const [selectedHabitCustomer, setSelectedHabitCustomer] = useState<string | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  React.useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  const customerHabits = useMemo(() => {
    if (!selectedHabitCustomer) return null;
    const customerOrders = orders
      .filter(o => o.whatsapp === selectedHabitCustomer)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return {
      name: customerOrders[0]?.customerName || 'Cliente',
      whatsapp: selectedHabitCustomer,
      history: customerOrders.slice(0, 5).map(o => ({
        date: o.createdAt,
        notes: o.items.map(i => i.notes).filter(Boolean).join(' | ') || 'Sem observações'
      }))
    };
  }, [orders, selectedHabitCustomer]);

  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'cancelado' && o.status !== 'finalizado');
  }, [orders]);

  const cols: { key: string, title: string, icon: any, color: string, statuses: StatusType[] }[] = [
    { key: 'fila', title: 'Fila', icon: Clock, color: 'text-ink-muted', statuses: ['na-fila'] },
    { key: 'preparo', title: 'Em Preparo', icon: ChefHat, color: 'text-ink-muted', statuses: ['preparando'] },
    { key: 'caminho', title: 'A Caminho', icon: Motorbike, color: 'text-brand', statuses: ['saiu-entrega', 'pronto-entrega', 'em-rota'] }
  ];

  const handleNextStatus = (order: Order) => {
    if (order.status === 'na-fila') updateOrderStatus(order.id, 'preparando');
    else if (order.status === 'preparando') {
      if (order.type === 'delivery') updateOrderStatus(order.id, 'pronto-entrega');
      else updateOrderStatus(order.id, 'saiu-entrega');
    }
    else if (order.status === 'pronto-entrega') updateOrderStatus(order.id, 'saiu-entrega');
    else if (order.status === 'saiu-entrega' || order.status === 'em-rota') updateOrderStatus(order.id, 'finalizado');
  };

  const handleCancelOrder = (order: Order) => {
    if (window.confirm(`Tem certeza que deseja CANCELAR o pedido de ${order.customerName}? Essa ação não pode ser desfeita.`)) {
      updateOrderStatus(order.id, 'cancelado');
      
      if (order.whatsapp) {
        setTimeout(() => {
          if (window.confirm('Deseja avisar o cliente sobre o cancelamento pelo WhatsApp?')) {
            const reason = window.prompt('Qual o motivo do cancelamento? (ex: Produto em falta)');
            if (reason) {
              const numericPhone = order.whatsapp.replace(/\D/g, '');
              const text = `Olá, ${order.customerName}.\n\nInfelizmente seu pedido no nosso estabelecimento precisou ser *cancelado*.\n\n*Motivo:* ${reason}\n\nAgradecemos a compreensão.`;
              window.open(`https://wa.me/55${numericPhone}?text=${encodeURIComponent(text)}`, '_blank');
            }
          }
        }, 100);
      }
    }
  };

  const handlePrint = (order: Order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setPrintingOrder(null);
    }, 500);
  };

  return (
    <>
      {printingOrder && <PrintTicket order={printingOrder} config={config} />}
      <div className="h-full flex flex-col p-4 md:p-8 overflow-y-auto md:overflow-hidden bg-oat">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-black/5 shadow-sm shrink-0">
          <div>
            <h2 className="text-2xl font-display font-bold text-ink tracking-tight uppercase">Dashboard de Produção</h2>
            <p className="text-ink-muted text-xs font-display font-bold uppercase tracking-widest mt-1">Fluxo: Fila → Preparo → A Caminho</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-auto px-5 py-3 bg-brand/10 text-brand rounded-full text-sm font-display font-bold border border-brand/20 flex items-center justify-center tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-brand mr-3 animate-pulse shadow-[0_0_8px_rgba(255,78,0,0.6)]"></span>
              {activeOrders.length} PEDIDOS ATIVOS
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:grid md:grid-cols-3 gap-6 md:overflow-hidden pb-8 md:pb-0">
          {cols.map(col => (
            <div key={col.key} className="bg-white border border-black/5 rounded-3xl shadow-sm flex flex-col overflow-hidden min-h-[450px] md:min-h-0 md:h-full">
              <div className="p-5 border-b border-black/5 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <col.icon className={`w-6 h-6 ${col.color}`} strokeWidth={2.5} />
                  <h3 className="font-display font-bold text-ink tracking-widest uppercase text-sm">{col.title}</h3>
                </div>
                <span className="text-xs font-display font-bold text-ink bg-oat px-3 py-1.5 rounded-full border border-black/5">
                  {activeOrders.filter(o => col.statuses.includes(o.status)).length}
                </span>
              </div>
              
              <div className="flex-1 p-5 overflow-y-auto hide-scrollbar space-y-5 bg-oat/50">
                <AnimatePresence>
                  {activeOrders.filter(o => col.statuses.includes(o.status)).map((order) => {
                    const createdAtDate = (order.createdAt as any)?.toDate ? (order.createdAt as any).toDate() : new Date(order.createdAt);
                    const minutesPassed = Math.floor((new Date().getTime() - createdAtDate.getTime()) / 60000);
                    const isDelayed = minutesPassed > 20;

                    const cardTheme = isDelayed ? 'bg-red-50 border-red-200' : 
                                      col.key === 'caminho' ? 'bg-emerald-50 border-emerald-200' : 
                                      col.key === 'fila' ? 'bg-brand/5 border-brand/20' : 'bg-[#FFFBEB] border-[#FDE68A]';
                    
                    const timeColor = isDelayed ? 'text-red-600' : 'text-ink-muted';

                    return (
                      <motion.div 
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        layout
                        className={`${cardTheme} border-2 rounded-2xl p-4 shadow-sm relative overflow-hidden`}
                      >
                        {isDelayed && <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />}
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <span className="font-display font-black text-ink text-lg tracking-tight leading-none">
                              {order.customerName || 'Cliente'}
                            </span>
                            <span className="text-[10px] font-display font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                              {order.type === 'dine-in' ? (
                                <span className="bg-brand/10 text-brand px-2 py-0.5 rounded flex items-center gap-1"><UtensilsCrossed className="w-3 h-3"/> Mesa {order.tableNumber || '-'}</span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded flex items-center gap-1"><Motorbike className="w-3 h-3"/> Delivery #{order.id.substring(0,4)}</span>
                              )}
                              {order.waiterName && <span className="ml-2 text-brand">• Atend.: {order.waiterName}</span>}
                            </span>
                            {order.billRequested && order.paymentStatus !== 'paid' && (
                              <motion.div 
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ repeat: Infinity, duration: 1.5 }}
                                className="mt-2 inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20"
                              >
                                <Receipt className="w-3.5 h-3.5" /> Pediu a Conta
                              </motion.div>
                            )}
                          </div>
                          <span className={`font-mono font-bold text-lg ${timeColor}`}>{String(minutesPassed).padStart(2, '0')}'</span>
                        </div>

                        {order.whatsapp && (
                          <div className="mb-3 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-display font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                WhatsApp: {order.whatsapp}
                              </span>
                              <div className="flex gap-1.5">
                                {orders.filter(o => o.whatsapp === order.whatsapp).length > 1 && (
                                  <button 
                                    onClick={() => setSelectedHabitCustomer(order.whatsapp)}
                                    className="bg-brand text-white p-1 rounded-md hover:bg-brand-light transition-colors shadow-sm flex items-center gap-1 px-2"
                                    title="Ver hábitos deste cliente"
                                  >
                                    <History className="w-3 h-3" />
                                    <span className="text-[8px] font-black uppercase tracking-tighter">Histórico</span>
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    const label = col.key === 'fila' ? 'EM PREPARO' : col.key === 'preparo' ? 'A CAMINHO' : 'PEDIDO ENTREGUE';
                                    const message = `🍔 *URBAN PRIME GRILL* 🍔\n\nOlá, *${order.customerName}*! Seu pedido *#${order.id.substring(0, 4).toUpperCase()}* acaba de ser atualizado para: *${label}*.\n\n📍 *Acompanhe aqui:* ${window.location.origin}/status\n\nObrigado pela preferência! 🔥`;
                                    window.open(`https://wa.me/55${order.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                                  }}
                                  className="bg-emerald-500 text-white p-1 rounded-md hover:bg-emerald-600 transition-colors shadow-sm"
                                  title="Atualizar cliente via WhatsApp"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handlePrint(order)}
                                  className="bg-zinc-800 text-white p-1 rounded-md hover:bg-black transition-colors shadow-sm"
                                  title="Imprimir Comanda Térmica"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mb-5 bg-white/60 p-3 rounded-xl border border-black/5">
                          <ul className="text-sm text-ink font-medium space-y-2">
                            {order.items.map((item, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="font-display font-bold text-ink whitespace-nowrap">{item.quantity}x</span>
                                <div className="flex-1">
                                  <span className="">{item.item.name}</span>
                                  {item.notes && <p className="text-brand mt-1 font-bold italic text-xs bg-brand/10 inline-block px-2 py-0.5 rounded-md">Obs: {item.notes}</p>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="mt-auto text-xs">
                          {order.status === 'na-fila' && order.paymentStatus === 'pending' && ['pix', 'credit', 'debit'].includes(order.paymentMethod || '') ? (
                            <div className="bg-white p-3 rounded-xl flex items-center justify-between border-2 border-brand/20 shadow-sm gap-2">
                              <span className="flex items-center gap-1.5 font-display font-bold text-brand uppercase tracking-widest text-[10px] leading-tight flex-1">
                                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={2.5} /> Falta {order.paymentMethod?.toUpperCase()}
                              </span>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleCancelOrder(order)}
                                  className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-[10px] font-display font-bold uppercase tracking-widest active:scale-95 border border-red-200"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => confirmPayment(order.id)}
                                  className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-light transition-colors text-[10px] font-display font-bold uppercase tracking-widest shadow-md active:scale-95"
                                >
                                  Liberar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {/* Option to cancel from anywhere if not finished/cancelled */}
                              <button 
                                onClick={() => handleCancelOrder(order)}
                                className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors uppercase tracking-widest flex items-center justify-center active:scale-95 border border-red-200"
                                title="Cancelar Pedido"
                              >
                                <X className="w-4 h-4" strokeWidth={3} />
                              </button>
                              
                              <button 
                                onClick={() => handleNextStatus(order)}
                                className="flex-1 py-3 bg-ink text-white rounded-xl hover:bg-black transition-colors text-xs font-display font-bold uppercase tracking-widest shadow-md flex items-center justify-center gap-2 active:scale-95"
                              >
                                <Check className="w-4 h-4" strokeWidth={3} />
                                {col.key === 'fila' ? 'Iniciar Preparo' : 
                                 col.key === 'preparo' ? 'Pronto / Enviar' : 
                                 order.status === 'pronto-entrega' ? 'Aguardar Coleta' :
                                 'Finalizar'}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Habit Modal */}
      <AnimatePresence>
        {customerHabits && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHabitCustomer(null)}
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-[32px] shadow-2xl z-[101] overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand text-white rounded-2xl flex items-center justify-center font-display font-black text-xl shadow-md">
                      {customerHabits.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-ink text-xl">{customerHabits.name}</h4>
                      <p className="text-ink-muted text-xs font-bold uppercase tracking-widest">{customerHabits.whatsapp}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedHabitCustomer(null)}
                    className="p-2 bg-oat rounded-xl text-ink-muted hover:text-red-500 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="bg-brand/5 border-2 border-brand/10 p-5 rounded-3xl mb-8 flex items-start gap-4">
                  <div className="p-2 bg-brand text-white rounded-xl">
                    <Info className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-ink-muted font-medium leading-relaxed">
                    Abaixo estão as observações dos últimos pedidos deste cliente. 
                    <span className="block mt-1 font-bold text-brand italic">Use isso para confirmar se ele esqueceu de tirar algo que costuma tirar!</span>
                  </p>
                </div>

                <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {customerHabits.history.map((h, i) => (
                    <div key={i} className="bg-oat/50 rounded-2xl p-4 border border-black/5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest">
                          {format(parseISO(h.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-ink italic leading-relaxed">
                        "{h.notes}"
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <button 
                    onClick={() => {
                        const message = `🍔 *URBAN PRIME GRILL* 🍔\n\nOlá, *${customerHabits.name}*! Notei que no seu pedido atual você não colocou a observação que costuma usar ("${customerHabits.history[0]?.notes}").\n\nApenas confirmando: deseja manter como está ou quer que a gente siga o seu padrão de costume?\n\nObrigado! 🔥`;
                        window.open(`https://wa.me/55${customerHabits.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-display font-bold py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 text-sm uppercase tracking-widest"
                  >
                    <Phone className="w-5 h-5" />
                    Confirmar hábito via WhatsApp
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
