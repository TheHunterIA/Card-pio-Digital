import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { finalizeOrder, markManualPayment } from '../../lib/database';
import { ChevronLeft, Receipt, QrCode, CheckCircle2, Utensils, Printer, ShieldCheck, AlertCircle, MessageCircle, Send, X as CloseIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import PrintTicket from '../../components/PrintTicket';
import { motion, AnimatePresence } from 'motion/react';

export default function WaiterBill() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const orders = useStore(state => state.orders);
  const setTableNumber = useStore(state => state.setTableNumber);
  const setOrderType = useStore(state => state.setOrderType);
  
  const [config, setConfig] = useState<any>(null);
  const [printingVisitor, setPrintingVisitor] = useState<{ id: string, salt: string } | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappName, setWhatsappName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const [printingOrder, setPrintingOrder] = useState<any>(null); // holds the specific order to print

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  const tableOrders = useMemo(() => {
    return orders.filter(o => o.tableNumber === tableId && o.status !== 'finalizado' && o.status !== 'cancelado');
  }, [orders, tableId]);

  const total = useMemo(() => {
    return tableOrders.reduce((sum, order) => sum + order.total, 0);
  }, [tableOrders]);

  const combinedOrderId = useMemo(() => tableOrders.length > 0 ? tableOrders[0].id : '', [tableOrders]);
  const exitPassToken = combinedOrderId ? `UP_PASS_${combinedOrderId}_${new Date().toISOString().split('T')[0]}` : '';

  const handlePrintOrder = () => {
    if (tableOrders.length === 0) return;
    setPrintingVisitor(null);
    setPrintingOrder(tableOrders[0]); // General print takes the first one as primary
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
      setPrintingOrder(null);
    }, 500);
  };

  const handlePrintIndividualOrder = (orderToPrint: any) => {
    setPrintingVisitor(null);
    setPrintingOrder(orderToPrint);
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
      setPrintingOrder(null);
    }, 500);
  };

  const handlePrintVisitor = () => {
    if (!tableId) return;
    setShowPrint(false); // Ensure we're not showing regular print
    // Generate a unique salt for this specific print action
    const salt = Math.random().toString(36).substring(7).toUpperCase();
    setPrintingVisitor({ id: tableId, salt });
    setTimeout(() => {
      window.print();
      setPrintingVisitor(null);
    }, 500);
  };

  const handleWhatsappShare = () => {
    if (tableOrders.length === 0) return;
    // Pre-fill name if order has it
    if (tableOrders[0].customerName && !whatsappName) {
      setWhatsappName(tableOrders[0].customerName);
    }
    setShowWhatsappModal(true);
  };

  const confirmWhatsappSend = () => {
    if (!whatsappNumber || whatsappNumber.length < 10) {
      alert("Por favor, insira um número de WhatsApp válido.");
      return;
    }

    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    let message = `*Comanda Mesa ${tableId} - Urban Prime*\n`;
    message += `--------------------------\n`;
    message += `*Cliente:* ${whatsappName || 'Não informado'}\n`;
    message += `*Mesa:* ${tableId}\n`;
    message += `--------------------------\n`;
    message += `*Itens:*\n`;
    
    tableOrders.forEach(order => {
      order.items.forEach(it => {
        message += `• ${it.quantity}x ${it.item.name} - R$ ${((it.item.price || 0) * it.quantity).toFixed(2)}\n`;
        if (it.notes) message += `   _(Obs: ${it.notes})_\n`;
      });
    });

    message += `--------------------------\n`;
    message += `*Total: R$ ${total.toFixed(2)}*\n\n`;
    message += `Obrigado pela preferência! 🥤🍔`;

    const url = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    setShowWhatsappModal(false);
  };

  const handleLaunchOrder = () => {
    if (!tableId) return;
    setTableNumber(tableId);
    setOrderType('dine-in');
    navigate(`/garcom/mesa/${tableId}`);
  };

  const isOccupied = tableOrders.length > 0;
  const order = tableOrders[0]; // Primary order for QR generation

  return (
    <div className="p-6 max-w-2xl mx-auto min-h-screen pb-32">
      {printingVisitor && (
        <PrintTicket 
          isVisitor={true} 
          tableNumber={printingVisitor.id}
          visitorId={printingVisitor.salt}
          config={config} 
        />
      )}
      {showPrint && printingOrder && (
        <PrintTicket 
          order={printingOrder}
          config={config} 
        />
      )}

      <button onClick={() => navigate('/garcom')} className="mb-8 flex items-center gap-2 text-ink-muted hover:text-ink transition-colors font-bold uppercase tracking-widest text-[10px]">
        <ChevronLeft className="w-5 h-5 text-brand" /> Painel de Mesas
      </button>

      <div className="mb-10">
        <h2 className="text-4xl font-display font-black text-ink uppercase tracking-tighter flex items-center gap-4">
          <Receipt className="w-10 h-10 text-brand" strokeWidth={2.5} />
          Mesa {tableId}
        </h2>
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-brand' : 'bg-ink/10'}`} />
          <p className="text-ink-muted text-xs font-bold uppercase tracking-widest">
            {isOccupied ? `${tableOrders.length} Pedido(s) Ativo(s)` : 'Mesa Disponível'}
          </p>
        </div>
      </div>
      
      {!isOccupied ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           <motion.button
             whileHover={{ y: -2 }}
             whileTap={{ scale: 0.98 }}
             onClick={handleLaunchOrder}
             className="w-full py-8 bg-brand/5 border-2 border-brand/20 rounded-[40px] text-brand flex flex-col items-center justify-center gap-2 group hover:bg-brand hover:text-white transition-all shadow-sm"
           >
             <Utensils className="w-8 h-8" />
             <span className="font-display font-black uppercase tracking-widest">Lançar Novo Pedido</span>
             <span className="text-[10px] opacity-60 font-bold">INICIAR CONSUMO NA MESA {tableId}</span>
           </motion.button>

           <div className="h-px bg-black/5 mx-10" />

           {/* High Impact Visitor Action */}
           <div className="bg-white rounded-[40px] p-8 border-2 border-black/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-[100%] transition-all group-hover:scale-110" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-brand/10 border border-brand/20 text-brand rounded-[24px] flex items-center justify-center mb-6">
                   <ShieldCheck className="w-8 h-8" />
                </div>
                
                <h3 className="text-2xl font-display font-black text-ink uppercase tracking-tight mb-2">Passe Visitante</h3>
                <p className="text-ink-muted text-xs font-bold uppercase tracking-widest leading-relaxed mb-10 w-2/3">
                  Liberação imediata para clientes que não consumiram.
                </p>

                <div className="flex flex-col gap-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handlePrintVisitor}
                    className="w-full h-24 bg-ink text-white rounded-[2rem] font-display font-black uppercase tracking-[0.25em] text-sm shadow-2xl flex items-center justify-between px-8 group relative overflow-hidden active:bg-brand transition-colors"
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="text-[10px] opacity-40 mb-1">Comando Industrial</span>
                      <span className="text-white group-active:text-white">IMPRIMIR PASSE</span>
                    </div>
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center group-hover:bg-brand transition-all duration-300">
                      <Printer className="w-7 h-7 text-white" />
                    </div>
                    
                    {/* Decorative Industrial Pattern */}
                    <div className="absolute top-0 right-0 w-32 h-full opacity-[0.03] pointer-events-none">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_white_1px,_transparent_1px)] bg-[size:10px_10px]" />
                    </div>
                  </motion.button>
                </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-white p-8 rounded-[40px] border-2 border-brand/20 shadow-2xl flex flex-col items-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-brand" />
              <div className="bg-brand/5 p-4 rounded-[2rem] mb-6">
                <QRCodeSVG value={exitPassToken} size={180} className="rounded-xl" />
              </div>
              <p className="font-display font-black text-ink uppercase tracking-tight text-xl mb-1">QR Code de Saída</p>
              <p className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mb-6 text-center px-4">
                Apresente este código na recepção para liberar sua saída.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full px-4">
                <button 
                  onClick={handlePrintOrder}
                  className="flex-1 flex items-center justify-center gap-3 bg-ink text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand transition-all shadow-xl active:scale-95"
                >
                  <Printer className="w-5 h-5" /> Imprimir 
                </button>
                <button 
                  onClick={handleWhatsappShare}
                  className="flex-1 flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl active:scale-95"
                >
                  <MessageCircle className="w-5 h-5" /> Enviar por WhatsApp
                </button>
              </div>
          </div>

          <div className="space-y-4">
            {tableOrders.map(order => (
              <div key={order.id} className="bg-white p-6 rounded-[32px] border-2 border-black/5 shadow-sm group hover:border-brand/20 transition-all">
                <div className="flex justify-between items-start border-b border-black/5 pb-4 mb-4">
                  <div>
                    <h3 className="font-display font-black text-ink uppercase tracking-tight text-lg mb-1">{order.customerName || 'Cliente'}</h3>
                    <p className="font-mono text-ink-muted text-xs font-bold uppercase tracking-widest">Pedido #{order.id.slice(0, 4)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`w-2 h-2 rounded-full ${order.status === 'preparando' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                      <span className="text-[10px] font-black uppercase text-ink-muted tracking-widest">{order.status}</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 items-end">
                    {order.paymentStatus === 'pending' ? (
                      <button 
                        onClick={() => markManualPayment(order.id)}
                        className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Pago (Dinheiro)
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4" /> Pago
                      </span>
                    )}

                    <button 
                      onClick={() => handlePrintIndividualOrder(order)}
                      className="flex items-center gap-2 text-ink-muted bg-oat px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-ink hover:text-white transition-all shadow-sm mt-2"
                    >
                      <Printer className="w-4 h-4" /> Imprimir 
                    </button>
                  </div>
                </div>
                
                <ul className="space-y-4">
                    {(order.items || []).map((cartItem, i) => (
                      <li key={i} className="flex flex-col">
                        <div className="flex justify-between items-center">
                           <span className="font-display font-bold text-ink text-sm">
                             <span className="text-brand mr-2">{cartItem.quantity}x</span>
                             {cartItem.item?.name || 'Item'}
                           </span>
                           <span className="font-mono text-xs font-bold text-ink-muted">R$ {((cartItem.item?.price || 0) * cartItem.quantity).toFixed(2)}</span>
                        </div>
                        {cartItem.notes && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-ink-muted bg-oat/50 p-2 rounded-lg italic">
                            <AlertCircle className="w-3 h-3 text-brand/40" />
                            Obs: {cartItem.notes}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-8 bg-ink text-white rounded-[40px] shadow-2xl flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">Total da Comanda</p>
              <p className="text-4xl font-display font-black tracking-tighter">R$ {total.toFixed(2)}</p>
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
               <Receipt className="w-7 h-7 text-brand" />
            </div>
          </div>

            <motion.button
               whileHover={{ y: -2 }}
               whileTap={{ scale: 0.98 }}
               onClick={handleLaunchOrder}
               className="w-full py-6 bg-white border-2 border-black/10 rounded-[32px] text-ink flex items-center justify-center gap-3 group hover:border-brand hover:text-brand transition-all shadow-sm"
             >
               <Utensils className="w-5 h-5" />
               <span className="font-display font-black uppercase tracking-widest text-xs">Adicionar Itens</span>
             </motion.button>

             <div className="h-px bg-black/5 mx-10 my-8" />
                 <div className="bg-oat/50 p-6 rounded-[32px] border border-dashed border-black/10">
                <p className="text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] mb-4 text-center">Gestão de Acesso</p>
                <div className="grid grid-cols-3 gap-3">
                   <button 
                    onClick={handlePrintOrder}
                    className="bg-white border-2 border-black/5 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-brand/40 group transition-all shadow-sm active:scale-95"
                   >
                     <Printer className="w-5 h-5 text-ink-muted group-hover:text-brand transition-colors" />
                     <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-ink leading-tight">Imprimir</p>
                        <p className="text-[7px] font-bold text-ink-muted uppercase tracking-widest leading-tight">Ticket</p>
                     </div>
                   </button>
                   <button 
                    onClick={handleWhatsappShare}
                    className="bg-white border-2 border-black/5 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-emerald-400/40 group transition-all shadow-sm active:scale-95"
                   >
                     <MessageCircle className="w-5 h-5 text-ink-muted group-hover:text-emerald-500 transition-colors" />
                     <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-ink leading-tight">Enviar</p>
                        <p className="text-[7px] font-bold text-ink-muted uppercase tracking-widest leading-tight">WhatsApp</p>
                     </div>
                   </button>
                   <button 
                    onClick={handlePrintVisitor}
                    className="bg-white border-2 border-black/5 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-brand/40 group transition-all shadow-sm active:scale-95"
                   >
                     <ShieldCheck className="w-5 h-5 text-ink-muted group-hover:text-brand transition-colors" />
                     <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-ink leading-tight">Passe</p>
                        <p className="text-[7px] font-bold text-ink-muted uppercase tracking-widest leading-tight">Visitante</p>
                     </div>
                   </button>
                </div>
             </div>
          </div>
       )}

       {/* WhatsApp Modal */}
       <AnimatePresence>
         {showWhatsappModal && (
           <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setShowWhatsappModal(false)}
               className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="bg-white w-full max-w-sm rounded-[40px] p-8 relative z-10 shadow-2xl overflow-hidden"
             >
                <div className="absolute top-0 right-0 p-6">
                  <button onClick={() => setShowWhatsappModal(false)} className="text-ink-muted hover:text-ink">
                    <CloseIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-display font-black text-ink uppercase tracking-tight">Enviar Comanda</h3>
                  <p className="text-ink-muted text-xs font-bold uppercase tracking-widest mt-1">Total: R$ {total.toFixed(2)}</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink-muted ml-4 mb-2 block">Nome do Cliente</label>
                    <input 
                      type="text"
                      value={whatsappName}
                      onChange={(e) => setWhatsappName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full bg-oat border-2 border-transparent focus:border-emerald-500/20 rounded-2xl px-6 py-4 text-ink font-bold placeholder:text-ink/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-ink-muted ml-4 mb-2 block">Número WhatsApp</label>
                    <input 
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="(DD) 99999-9999"
                      className="w-full bg-oat border-2 border-transparent focus:border-emerald-500/20 rounded-2xl px-6 py-4 text-ink font-bold placeholder:text-ink/20 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={confirmWhatsappSend}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-display font-black uppercase tracking-[0.25em] py-5 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                >
                  <Send className="w-5 h-5" />
                  Abrir WhatsApp
                </button>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
}
