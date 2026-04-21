import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, where, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, Order } from '../../store';
import { updateOrderStatus, completeDelivery } from '../../lib/database';
import { 
  CheckCircle2, 
  QrCode, 
  Copy, 
  ChefHat, 
  Motorbike, 
  Clock, 
  PartyPopper, 
  Navigation, 
  ShieldCheck,
  Receipt,
  UtensilsCrossed,
  BellRing,
  Star,
  Sparkles,
  ChevronLeft,
  Users,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapaUrbanPrime from '../../components/shared/MapaUrbanPrime';
import { QRCodeSVG } from 'qrcode.react';
import PrintTicket from '../../components/PrintTicket';

export default function OrderStatus() {
  const navigate = useNavigate();
  const { currentOrderId, orders, setOrders, tableNumber } = useStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // Table Session States
  const [tableOrders, setTableOrders] = useState<Order[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [sessionItems, setSessionItems] = useState<{name: string, qty: number, price: number, users: string[], extras?: any[]}[]>([]);
  const [rating, setRating] = useState(0);
  const [config, setConfig] = useState<any>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [billRequested, setBillRequested] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
       const docSnap = await getDoc(doc(db, 'settings', 'config'));
       if (docSnap.exists()) setConfig(docSnap.data());
    };
    loadConfig();
  }, []);

  useEffect(() => {
    if (!currentOrderId) {
      setIsChecking(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'orders', currentOrderId), (snapshot) => {
      if (snapshot.exists()) {
        const orderData = { 
          id: snapshot.id, 
          ...snapshot.data(),
          createdAt: snapshot.data().createdAt?.toDate ? snapshot.data().createdAt.toDate().toISOString() : new Date().toISOString()
        } as Order;
        
        setBillRequested(!!orderData.billRequested);

        // Update store with latest data
        useStore.setState((state) => {
          const exists = state.orders.some(o => o.id === orderData.id);
          if (exists) {
            return { orders: state.orders.map(o => o.id === orderData.id ? orderData : o) };
          }
          return { orders: [...state.orders, orderData] };
        });
      }
      setIsChecking(false);
    }, (error) => {
      console.error("Order snapshot permission error:", error);
      setIsChecking(false);
    });

    return () => unsub();
  }, [currentOrderId]);

  const order = useMemo(() => orders.find(o => o.id === currentOrderId), [orders, currentOrderId]);

  // If at table, fetch all active orders for this table to show the "Table Session"
  useEffect(() => {
    const activeTable = order?.tableNumber || tableNumber;
    if (!activeTable) return;

    const q = query(
      collection(db, 'orders'), 
      where('tableNumber', '==', activeTable),
      where('status', 'not-in', ['finalizado', 'cancelado'])
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      
      // Ensure the current order is always part of the session if it's missing (e.g. if it was just finalized)
      let allTableOrders = [...ordersData];
      if (order && !allTableOrders.some(o => o.id === order.id)) {
         allTableOrders.push(order);
      }
      
      setTableOrders(allTableOrders);
      
      // Calculate Session Aggregates
      const total = allTableOrders.reduce((acc, curr) => acc + curr.total, 0);
      setSessionTotal(total);

      const itemsMap: Record<string, {name: string, qty: number, price: number, users: Set<string>, extras?: any[]}> = {};
      allTableOrders.forEach(o => {
        o.items.forEach(i => {
          const extrasPrice = (i.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
          const extrasKey = (i.selectedExtras || []).map(e => e.id).sort().join(',');
          const key = `${i.item.id}-${extrasKey}`;
          
          if (!itemsMap[key]) {
            itemsMap[key] = { 
              name: i.item.name, 
              qty: 0, 
              price: i.item.price + extrasPrice, 
              users: new Set(),
              extras: i.selectedExtras
            };
          }
          itemsMap[key].qty += i.quantity;
          itemsMap[key].users.add(o.customerName || 'Anônimo');
        });
      });

      setSessionItems(Object.values(itemsMap).map(v => ({ ...v, users: Array.from(v.users) })));
    });

    return () => unsub();
  }, [tableNumber, order]);

  useEffect(() => {
    if (!isChecking && (!currentOrderId || !order)) {
      navigate('/');
    }
  }, [currentOrderId, order, navigate, isChecking]);

  if (!order) {
    if (isChecking) return <div className="min-h-screen flex items-center justify-center text-ink-muted font-display font-bold">Buscando seu pedido...</div>;
    return null;
  }

  const handleConfirm = async () => {
    setIsFinalizing(true);
    setShowConfirmation(false);
    try {
      await completeDelivery(order.id);
    } catch (error: any) {
      console.error('Falha crítica ao finalizar:', error);
      alert('Não conseguimos conectar ao nosso servidor. Verifique sua rede e tente novamente.');
    }
    setIsFinalizing(false);
  };

  const handleRequestBill = async () => {
    if (!order) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { billRequested: true });
      setBillRequested(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRate = async (value: number) => {
    if (!order || hasRated) return;
    setRating(value);
    try {
      await updateDoc(doc(db, 'orders', order.id), { rating: value });
      setHasRated(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 100);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const getStatusInfo = () => {
    switch(order.status) {
      case 'na-fila': return { icon: Clock, text: 'Na Fila de Preparo', color: 'text-brand-dark', bg: 'bg-brand/10', progress: 20, stroke: '#FF4E00' };
      case 'preparando': return { icon: ChefHat, text: 'Em Preparo', color: 'text-ink', bg: 'bg-black/5', progress: 40, stroke: '#1C1917' };
      case 'servido': return { icon: UtensilsCrossed, text: 'Servido', color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 100, stroke: '#10B981' };
      case 'pronto-entrega': return { icon: CheckCircle2, text: 'Pronto para Sair', color: 'text-ink', bg: 'bg-black/5', progress: 60, stroke: '#1C1917' };
      case 'em-rota': return { icon: Motorbike, text: 'A Caminho', color: 'text-brand', bg: 'bg-brand/10', progress: 80, stroke: '#FF4E00' };
      case 'finalizado': return { icon: PartyPopper, text: 'Pedido Entregue!', color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 100, stroke: '#10B981' };
      case 'saiu-entrega': return { icon: CheckCircle2, text: order.type === 'delivery' ? 'A Caminho' : 'Pronto para Coleta', color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 80, stroke: '#10B981' };
      default: return { icon: Clock, text: 'Aguardando', color: 'text-ink-muted', bg: 'bg-white', progress: 0, stroke: '#E5E7EB' };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const isPaid = order.paymentStatus === 'paid';
  const exitPassToken = `UP_PASS_${order.id}_${new Date().toISOString().split('T')[0]}`;

  return (
    <div className="bg-oat min-h-screen pb-24">
      {showPrint && <PrintTicket order={order} config={config} />}
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-black/5 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-6 h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate('/cardapio')}
            className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center text-ink-muted hover:text-ink transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center">
            <h1 className="font-display font-bold text-ink text-sm uppercase tracking-tight">Status do Pedido</h1>
            <p className="text-[10px] font-bold text-brand uppercase tracking-widest">
              {order.type === 'dine-in' ? `Mesa ${order.tableNumber}` : `Pedido #${order.id.slice(0, 8)}`}
            </p>
          </div>
          <button 
            onClick={() => navigate('/cardapio')}
            className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-6 pt-8 space-y-6">
        
        {/* Pass Card for Dine-in */}
        <AnimatePresence>
          {order.type === 'dine-in' && isPaid && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-emerald-600 rounded-[40px] p-8 text-white shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative z-10">
                <div className="mb-6 bg-white p-4 rounded-3xl inline-block shadow-lg">
                  <QRCodeSVG value={exitPassToken} size={150} />
                </div>
                <h3 className="text-2xl font-display font-bold mb-2 tracking-tight italic">LIBERADO!</h3>
                <p className="text-emerald-100 font-medium px-4 leading-snug text-sm">
                  Apresente este código na portaria para confirmar seu acerto.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Tracker Card */}
        <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm">
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 mb-8 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="6" />
                <motion.circle 
                  cx="50" cy="50" r="45" fill="none" 
                  stroke={statusInfo.stroke}
                  strokeWidth="6" 
                  strokeLinecap="round"
                  initial={{ strokeDasharray: "0 283" }}
                  animate={{ strokeDasharray: `${(statusInfo.progress / 100) * 283} 283` }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <div className={`absolute inset-0 m-auto w-32 h-32 ${statusInfo.bg} ${statusInfo.color} rounded-full flex flex-col items-center justify-center shadow-inner`}>
                <StatusIcon className="w-12 h-12" strokeWidth={1.5} />
              </div>
            </div>
            <h2 className={`text-2xl font-display font-extrabold mb-1 ${statusInfo.color}`}>{statusInfo.text}</h2>
            <p className="text-ink-muted text-xs font-bold uppercase tracking-widest bg-oat px-4 py-1.5 rounded-full">{order.status.replace('-', ' ')}</p>
          </div>

          <div className="mt-10 pt-8 border-t border-black/5 space-y-4">
             <div className="flex justify-between items-center bg-oat/50 p-4 rounded-2xl border border-black/5">
                <div className="flex items-center gap-3">
                   <div className="bg-black text-brand font-mono font-black px-3 py-1 rounded text-lg">
                      {order.deliveryCode || '----'}
                   </div>
                   <span className="text-[10px] font-display font-bold uppercase tracking-widest text-ink-muted leading-tight">Código de<br/>Segurança</span>
                </div>
                {isPaid ? (
                  <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                  </div>
                ) : (
                   <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
                    Pendente
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Delivery Map if In Route */}
        {order.status === 'em-rota' && order.driverLocation && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] p-6 shadow-xl border border-black/5 overflow-hidden"
          >
             <MapaUrbanPrime 
                driverCoords={order.driverLocation} 
                customerCoords={order.customerLocation}
                height="250px"
             />
             <div className="mt-4 flex items-center gap-4 bg-oat p-4 rounded-3xl">
                <Navigation className="w-5 h-5 text-brand animate-pulse" />
                <p className="text-xs font-bold text-ink uppercase tracking-tight">O entregador está a caminho!</p>
             </div>
          </motion.div>
        )}

        {/* Consumption Summary (Comanda Compartilhada) */}
        {order.type === 'dine-in' ? (
        <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="font-display font-bold text-ink-muted uppercase tracking-[0.2em] text-[10px]">Comanda de Mesa</h3>
             <div className="flex items-center gap-1.5 text-brand bg-brand/5 px-3 py-1 rounded-full border border-brand/10">
                <Users className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase">Sessão Ativa</span>
             </div>
          </div>
          
          <div className="space-y-6">
            {sessionItems.map(item => (
              <div key={item.name} className="flex justify-between items-start">
                <div className="flex gap-4">
                   <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center font-bold text-brand">
                     {item.qty}x
                   </div>
                   <div>
                     <p className="text-sm font-bold text-ink leading-tight">{item.name}</p>
                     {item.extras && item.extras.length > 0 && (
                       <p className="text-[10px] text-brand font-bold mt-0.5">
                         + {item.extras.map((e: any) => e.name).join(', ')}
                       </p>
                     )}
                     <p className="text-[9px] text-ink-muted font-medium mt-1">Pedida por: {item.users.join(', ')}</p>
                   </div>
                </div>
                <span className="text-sm font-bold text-ink">R$ {(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-black/5">
             <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Total da Mesa</span>
                <span className="text-lg font-display font-black text-ink">R$ {Math.max(sessionTotal, order.total).toFixed(2)}</span>
             </div>
             <div className="flex justify-between items-center mb-6">
                <span className="font-display font-black text-ink uppercase tracking-tighter text-xl">Sua Parte</span>
                <span className="font-display font-black text-brand text-2xl">R$ {order.total.toFixed(2)}</span>
             </div>
          </div>
        </div>
        ) : (
        <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="font-display font-bold text-ink-muted uppercase tracking-[0.2em] text-[10px]">Resumo do Pedido</h3>
             <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                <Motorbike className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase">Delivery</span>
             </div>
          </div>
          
          <div className="space-y-6">
            {order.items.map((item, idx) => {
              const extrasTotal = (item.selectedExtras || []).reduce((acc: number, cur: any) => acc + cur.price, 0);
              const unitPrice = item.item.price + extrasTotal;
              
              return (
              <div key={idx} className="flex justify-between items-start">
                <div className="flex gap-4">
                   <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center font-bold text-brand">
                     {item.quantity}x
                   </div>
                   <div>
                     <p className="text-sm font-bold text-ink leading-tight">{item.item.name}</p>
                     {item.selectedExtras && item.selectedExtras.length > 0 && (
                       <p className="text-[10px] text-brand font-bold mt-0.5">
                         + {item.selectedExtras.map((e: any) => e.name).join(', ')}
                       </p>
                     )}
                   </div>
                </div>
                <span className="text-sm font-bold text-ink">R$ {(unitPrice * item.quantity).toFixed(2)}</span>
              </div>
            )})}
          </div>

          <div className="pt-6 border-t border-black/5">
             <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-ink-muted uppercase tracking-wider">Subtotal</span>
                <span className="text-lg font-display font-black text-ink">R$ {((order as any).subtotal || (order.total + ((order as any).discount || 0) - (order.deliveryFee || 0))).toFixed(2)}</span>
             </div>
             {order.deliveryFee > 0 && (
                <div className="flex justify-between items-center mb-2 text-ink-muted">
                   <span className="text-xs font-bold uppercase tracking-wider">Taxa de Entrega</span>
                   <span className="text-sm font-display font-black">R$ {(order.deliveryFee).toFixed(2)}</span>
                </div>
              )}
             {(order as any).discount > 0 && (
               <div className="flex justify-between items-center mb-2 text-emerald-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Desconto Aplicado</span>
                  <span className="text-sm font-display font-black">- R$ {((order as any).discount).toFixed(2)}</span>
               </div>
             )}
             <div className="flex justify-between items-center mb-6">
                <span className="font-display font-black text-ink uppercase tracking-tighter text-xl">Total {order.paymentStatus === 'paid' ? 'Pago' : ''}</span>
                <span className="font-display font-black text-brand text-2xl">R$ {order.total.toFixed(2)}</span>
             </div>
          </div>
        </div>
        )}

        {/* Rating for dine-in paid or delivery finished */}
        <AnimatePresence>
          {((order.type === 'dine-in' && isPaid) || (order.type === 'delivery' && order.status === 'finalizado')) && !hasRated && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white rounded-[40px] p-10 border border-brand/20 shadow-xl text-center"
             >
                <div className="w-16 h-16 bg-brand/10 text-brand rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Star className="w-8 h-8 fill-brand" />
                </div>
                <h3 className="text-xl font-display font-bold text-ink mb-2">Como foi sua experiência?</h3>
                <p className="text-ink-muted mb-8 text-sm font-medium italic">Sua avaliação ajuda nossa evolução Prime.</p>
                
                <div className="flex justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                      key={star}
                      onClick={() => handleRate(star)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                        rating >= star ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink-muted/30'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${rating >= star ? 'fill-white' : ''}`} />
                    </button>
                  ))}
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Actions for Dine-in Unpaid */}
        {order.type === 'dine-in' && !isPaid && (
          <div className="space-y-4">
             <button 
                onClick={handleRequestBill}
                disabled={billRequested}
                className={`w-full h-16 rounded-2xl font-display font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 border-2 transition-all ${
                  billRequested ? 'bg-oat border-transparent text-ink-muted' : 'bg-white border-brand text-brand active:scale-95'
                }`}
             >
                <BellRing className="w-5 h-5" />
                {billRequested ? 'Conta Solicitada' : 'Solicitar a Conta'}
             </button>
             <button 
                onClick={() => navigate('/checkout')}
                className="w-full h-18 bg-emerald-600 text-white rounded-3xl font-display font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
             >
                <CreditCard className="w-6 h-6" />
                Pagar com PIX R$ {order.total.toFixed(2)}
             </button>
          </div>
        )}

        {/* Receive Confirmation for Delivery */}
        {order.type === 'delivery' && (order.status === 'em-rota' || order.status === 'saiu-entrega' || order.status === 'pronto-entrega') && (
          <button 
            disabled={isFinalizing}
            onClick={() => setShowConfirmation(true)}
            className="w-full h-18 bg-emerald-600 text-white rounded-3xl font-display font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-3 animate-pulse"
          >
            <CheckCircle2 className="w-6 h-6" />
            Confirmar Recebimento
          </button>
        )}

        <button 
          onClick={() => navigate('/pedidos')}
          className="w-full py-6 text-ink-muted font-display font-black uppercase tracking-widest text-[10px] hover:text-ink transition-colors flex items-center justify-center gap-2"
        >
          <UtensilsCrossed className="w-4 h-4" /> Voltar aos Meus Pedidos
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl"
          >
            <h3 className="font-display font-bold text-ink text-xl mb-8 leading-tight">Deseja realmente confirmar o recebimento do seu pedido?</h3>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmation(false)} 
                className="flex-1 rounded-2xl py-4 text-ink bg-oat font-bold font-display text-xs"
              >
                NÃO
              </button>
              <button 
                onClick={handleConfirm} 
                className="flex-1 rounded-2xl py-4 bg-emerald-600 text-white font-bold font-display text-xs shadow-lg shadow-emerald-600/10"
              >
                SIM,RECEBI!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Simple CreditCard icon replacement since it was missing from imports
function CreditCard(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  );
}
