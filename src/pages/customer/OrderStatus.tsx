import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, where, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, Order } from '../../store';
import { updateOrderStatus, finalizeOrder } from '../../lib/database';
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
  MessageCircle,
  ImageIcon,
  Send,
  Loader2,
  Share2,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapaUrbanPrime from '../../components/shared/MapaUrbanPrime';
import { QRCodeSVG } from 'qrcode.react';
import PrintTicket from '../../components/PrintTicket';
import { toBlob } from 'html-to-image';
import { useRef } from 'react';
import { syncManualClient } from '../../lib/database';

export default function OrderStatus() {
  const navigate = useNavigate();
  const { currentOrderId, orders, setOrders, tableNumber, deviceId } = useStore();
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
  const [isSharing, setIsSharing] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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

  const userTotal = useMemo(() => {
    if (!order) return 0;
    const myDeviceId = order.deviceId || deviceId;
    return tableOrders
      .filter(o => o.deviceId === myDeviceId || (o.userId === order.userId && o.userId !== undefined))
      .reduce((acc, curr) => acc + curr.total, 0);
  }, [tableOrders, order, deviceId]);

  const userItems = useMemo(() => {
    if (!order) return [];
    const myDeviceId = order.deviceId || deviceId;
    const items: any[] = [];
    tableOrders
      .filter(o => o.deviceId === myDeviceId || (o.userId === order.userId && o.userId !== undefined))
      .forEach(o => {
        items.push(...o.items);
      });
    return items;
  }, [tableOrders, order, deviceId]);

  const userPendingTotal = useMemo(() => {
    if (!order) return 0;
    const myDeviceId = order.deviceId || deviceId;
    return tableOrders
      .filter(o => (o.deviceId === myDeviceId || (o.userId === order.userId && o.userId !== undefined)) && o.paymentStatus !== 'paid')
      .reduce((acc, curr) => acc + curr.total, 0);
  }, [tableOrders, order, deviceId]);

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
      await finalizeOrder(order.id);
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

  const handleShareToWhatsapp = async () => {
    if (!order || isSharing) return;
    setIsSharing(true);

    try {
      if (!ticketRef.current) {
        throw new Error("Elemento de ticket não encontrado");
      }

      const blob = await toBlob(ticketRef.current, {
        cacheBust: true,
        backgroundColor: '#FCF9F2',
        style: { padding: '40px', borderRadius: '0px' }
      });

      if (!blob) throw new Error("Falha ao gerar imagem");

      const cleanNumber = (order.whatsapp || '').replace(/\D/g, '');
      const text = `*Minha Comanda Digital - Urban Prime*\nOlá! Segue meu passe digital com o QR Code de saída para apresentar na recepção.`;
      
      // If we have a number, open WhatsApp directly. 
      // If not, ask or use Web Share if available
      if (cleanNumber) {
        const whatsappUrl = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(text)}`;
        
        // Try to copy to clipboard (only works in secure contexts and with user gesture)
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            const data = [new ClipboardItem({ [blob.type]: blob })];
            await navigator.clipboard.write(data);
          }
        } catch (e) {
          console.warn("Clipboard copy failed", e);
        }

        window.open(whatsappUrl, '_blank');
        alert("Enviando para seu WhatsApp! Se a imagem não aparecer, você pode COLAR (Ctrl+V) na conversa.");
      } else {
        // No number, try Web Share API
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'comanda.png', { type: 'image/png' })] })) {
          const file = new File([blob], 'comanda.png', { type: 'image/png' });
          await navigator.share({
            title: 'Minha Comanda Digital - Urban Prime',
            text: text,
            files: [file]
          });
        } else {
          // Final fallback: download
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `minha-comanda-urban-prime.png`;
          link.click();
          alert("Imagem da comanda baixada! Você pode enviá-la para seu próprio WhatsApp.");
        }
      }
    } catch (err) {
      console.error("Erro ao compartilhar:", err);
      alert("Não foi possível gerar a imagem para compartilhamento.");
    } finally {
      setIsSharing(false);
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
      case 'na-fila': return { icon: Clock, text: 'Na Fila de Preparo', label: 'Cozinha', color: 'text-brand-dark', bg: 'bg-brand/10', progress: 20, stroke: '#FF4E00' };
      case 'preparando': return { icon: ChefHat, text: 'Em Preparo', label: 'Em Produção', color: 'text-ink', bg: 'bg-black/5', progress: 40, stroke: '#1C1917' };
      case 'servido': return { 
        icon: UtensilsCrossed, 
        text: 'Bom apetite!', 
        label: 'Servido', 
        color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 100, stroke: '#10B981' 
      };
      case 'pronto-entrega': return { 
        icon: CheckCircle2, 
        text: order.type === 'delivery' ? 'Aguardando Entregador' : 'Pronto para Retirada', 
        label: order.type === 'delivery' ? 'Pronto' : 'No Balcão',
        color: 'text-ink', bg: 'bg-black/5', progress: 60, stroke: '#1C1917' 
      };
      case 'em-rota': return { icon: Motorbike, text: 'A Caminho', label: 'Entrega', color: 'text-brand', bg: 'bg-brand/10', progress: 80, stroke: '#FF4E00' };
      case 'finalizado': return { 
        icon: PartyPopper, 
        text: order.type === 'dine-in' ? 'Obrigado e volte sempre!' : 'Pedido Entregue!', 
        label: 'Finalizado', 
        color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 100, stroke: '#10B981' 
      };
      case 'saiu-entrega': return { 
        icon: CheckCircle2, 
        text: order.type === 'delivery' ? 'A Caminho' : 
              order.type === 'dine-in' ? 'Garçom trazendo seu pedido!' : 'Pronto para Coleta', 
        label: order.type === 'dine-in' ? 'Saindo' : 'Em Trânsito',
        color: 'text-emerald-700', bg: 'bg-emerald-50', progress: 80, stroke: '#10B981' 
      };
      default: return { icon: Clock, text: 'Aguardando', label: 'Status', color: 'text-ink-muted', bg: 'bg-white', progress: 0, stroke: '#E5E7EB' };
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
        
        {/* ADD MORE ITEMS CALL TO ACTION */}
        {order.type === 'dine-in' && !isPaid && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => navigate('/cardapio')}
            className="w-full bg-brand text-white p-6 rounded-[28px] overflow-hidden flex items-center justify-between shadow-[0_20px_40px_-10px_rgba(255,78,0,0.3)] group active:scale-[0.98] transition-all relative"
          >
            <div className="text-left relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-white/60 mb-1 block">Ainda com fome?</span>
              <h3 className="font-display font-black text-xl uppercase tracking-tighter">ADICIONAR ITENS</h3>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform relative z-10">
              <UtensilsCrossed className="w-6 h-6" />
            </div>
            {/* Gloss effect */}
            <div className="absolute top-0 right-0 w-32 h-full bg-white/5 skew-x-[-20deg] transform translate-x-16 group-hover:translate-x-8 transition-transform" />
          </motion.button>
        )}

        {/* Pass Card for Dine-in */}
        <AnimatePresence>
          {order.type === 'dine-in' && isPaid && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-emerald-600 rounded-[40px] p-8 text-white shadow-2xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="mb-6 bg-white p-6 rounded-[2.5rem] inline-block shadow-2xl scale-110 transition-transform hover:scale-115">
                  <QRCodeSVG value={exitPassToken} size={180} level="H" />
                </div>
                
                <div className="space-y-2 mb-8">
                  <h3 className="text-3xl font-display font-black tracking-tight italic uppercase leading-none">COMANDA DIGITAL</h3>
                  <div className="flex items-center justify-center gap-2 bg-white/10 px-4 py-1.5 rounded-full border border-white/20">
                     <ShieldCheck className="w-4 h-4" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Passe de Saída</span>
                  </div>
                </div>

                <p className="text-emerald-50 font-medium px-4 leading-relaxed text-sm mb-8 opacity-90">
                  Esta é sua via digital. Apresente este QR Code na portaria/saída para liberar sua passagem.
                </p>

                <button 
                  onClick={handleShareToWhatsapp}
                  disabled={isSharing}
                  className="w-full bg-white text-emerald-700 h-16 rounded-2xl font-display font-black uppercase tracking-widest text-xs shadow-xl shadow-black/10 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5 fill-emerald-700 text-white" />}
                  {isSharing ? 'GERANDO TICKET...' : 'SALVAR NO MEU WHATSAPP'}
                </button>
                <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-4">
                  DICA: TIRE UM PRINT DESTA TELA
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
            <p className="text-ink-muted text-xs font-bold uppercase tracking-widest bg-oat px-4 py-1.5 rounded-full">{statusInfo.label}</p>
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
                <span className="font-display font-black text-brand text-2xl">R$ {userTotal.toFixed(2)}</span>
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
        {order.type === 'dine-in' && userPendingTotal > 0 && (
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
                <CreditCardIcon className="w-6 h-6" />
                Pagar com PIX R$ {userPendingTotal.toFixed(2)}
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

      {/* Hidden Ticket for Image Generation */}
      <div className="fixed -left-[2000px] top-0 pointer-events-none">
          <div ref={ticketRef} className="w-[400px] bg-[#FCF9F2] p-10 font-sans">
             <div className="text-center border-b-2 border-dashed border-ink pb-6 mb-6">
                <h1 className="text-3xl font-display font-black text-ink uppercase tracking-tight">Urban Prime</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted mt-1">Industrial Food & Co.</p>
             </div>

             <div className="mb-8">
                <div className="flex justify-between items-baseline mb-2">
                   <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Mesa</span>
                   <span className="text-3xl font-display font-black text-brand">{order.tableNumber}</span>
                </div>
                <div className="flex justify-between items-baseline">
                   <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Tipo</span>
                   <span className="text-[10px] font-bold text-ink uppercase tracking-tight">COMANDA DIGITAL</span>
                </div>
                <div className="flex justify-between items-baseline">
                   <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Cliente</span>
                   <span className="text-sm font-bold text-ink uppercase tracking-tight">{order.customerName || 'Consumidor'}</span>
                </div>
                <div className="flex justify-between items-baseline mt-1">
                   <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Data</span>
                   <span className="text-[10px] font-mono font-bold text-ink-muted">{new Date().toLocaleDateString('pt-BR')}</span>
                </div>
             </div>

             <div className="border-y-2 border-dashed border-ink/10 py-6 mb-6 space-y-4">
                {userItems.map((it, i) => {
                  const extrasTotal = (it.selectedExtras || []).reduce((acc: number, cur: any) => acc + cur.price, 0);
                  return (
                    <div key={i} className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-ink leading-tight">
                            <span className="text-brand mr-1">{it.quantity}x</span> {it.item.name}
                          </p>
                          {it.selectedExtras && it.selectedExtras.length > 0 && (
                            <p className="text-[8px] text-brand/70 font-medium">
                              + {it.selectedExtras.map((e: any) => e.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-mono font-black text-ink">R$ {((it.item.price + extrasTotal) * it.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
             </div>

             <div className="flex justify-between items-center mb-10">
                <span className="text-[10px] font-black uppercase tracking-widest text-ink-muted">Total Pago</span>
                <span className="text-4xl font-display font-black text-ink tracking-tighter">R$ {userTotal.toFixed(2)}</span>
             </div>

             <div className="bg-white p-8 rounded-[40px] flex flex-col items-center border-4 border-emerald-500 shadow-xl">
                <div className="bg-brand/5 p-4 rounded-2xl mb-4">
                   <QRCodeSVG value={exitPassToken} size={150} level="H" />
                </div>
                <p className="text-xl font-display font-black uppercase tracking-tight text-ink text-center">PASSE DE SAÍDA</p>
                <p className="text-[9px] font-bold text-ink-muted text-center mt-1 uppercase tracking-widest leading-none">Apresente na recepção para liberar sua saída</p>
             </div>

             <div className="mt-10 text-center text-[9px] font-bold text-ink-muted uppercase tracking-[0.2em] opacity-30">
                Obrigado pela preferência! Urban Prime.
             </div>
          </div>
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
