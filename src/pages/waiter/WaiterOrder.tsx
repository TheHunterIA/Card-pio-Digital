import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { placeOrder } from '../../lib/database';
import { Plus, Minus, Search, ShoppingBag, ChevronLeft, Check, Trash2, Receipt, ArrowLeft, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PrintTicket from '../../components/PrintTicket';
import { Order } from '../../store';

export default function WaiterOrder() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const menu = useStore(state => state.menu);
  const cart = useStore(state => state.cart);
  const addToCart = useStore(state => state.addToCart);
  const removeFromCart = useStore(state => state.removeFromCart);
  const clearCart = useStore(state => state.clearCart);
  const waiterName = useStore(state => state.waiterName);
  const orders = useStore(state => state.orders);

  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [selectedItemForNotes, setSelectedItemForNotes] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  
  useEffect(() => {
    if (showPrint) {
      const timer = setTimeout(() => {
        window.print();
        setShowPrint(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showPrint]);

  const PREDEFINED_NOTES = ['Sem cebola', 'Sem salada', 'Com gelo', 'Com limão', 'Bem passado', 'Mal passado', 'Sem molho'];

  const handleAddItem = (item: any) => {
    setSelectedItemForNotes(item);
  };

  const confirmAddItem = () => {
    addToCart(selectedItemForNotes, notes);
    setNotes('');
    setSelectedItemForNotes(null);
  };

  const filteredMenu = useMemo(() => {
    return menu.filter(item => 
      item.isActive && 
      (item.name.toLowerCase().includes(search.toLowerCase()) || 
       item.category.toLowerCase().includes(search.toLowerCase()))
    );
  }, [menu, search]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.item.price * item.quantity), 0);

  const handleSendToKDS = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);
    try {
      const orderId = await placeOrder('na-entrega');
      // Find the order in the list (it should be there via snapshot)
      // Since it's a demo, we might need a small delay or look it up
      // Or just create a mock order object from the cart for printing
      const orderData = orders.find(o => o.id === orderId);
      setSubmittedOrder(orderData || null);
      setShowCart(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao enviar pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedOrder) {
    return (
      <div className="min-h-screen bg-oat flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[40px] p-10 shadow-2xl border border-black/5 max-w-md w-full"
        >
          <div className="w-20 h-20 bg-brand/10 text-brand rounded-[32px] flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-black text-ink italic uppercase tracking-tighter mb-2">Pedido Enviado!</h2>
          <p className="text-ink-muted text-sm font-medium mb-8">
            Os itens para a Mesa {tableId} já estão na fila de produção.
          </p>

          <div className="space-y-4">
            <button 
              onClick={() => setShowPrint(true)}
              className="w-full h-16 bg-brand text-white rounded-2xl font-display font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-lg shadow-brand/20"
            >
              <Printer className="w-5 h-5" /> Imprimir Comanda para o Cliente
            </button>
            <button 
              onClick={() => navigate('/garcom')}
              className="w-full h-14 bg-white text-ink border border-black/5 rounded-2xl font-display font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar ao Salão
            </button>
          </div>
        </motion.div>

        {showPrint && submittedOrder && (
          <div className="hidden">
             <div id="printable-ticket">
                <PrintTicket order={submittedOrder} />
             </div>
          </div>
        )}
        
        <AnimatePresence>
          {showPrint && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 text-[10px] font-bold text-ink-muted uppercase tracking-[0.2em] animate-pulse"
            >
              Enviando para impressora...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)]">
      {/* Search Header */}
      <div className="p-4 bg-white sticky top-20 z-40 border-b border-black/5 shadow-sm flex items-center gap-2">
        <button 
          onClick={() => navigate(`/garcom/comanda/${tableId}`)}
          className="bg-brand/10 text-brand p-4 rounded-2xl"
        >
          <Receipt className="w-6 h-6" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted" />
          <input 
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-oat border-2 border-transparent rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
          />
        </div>
      </div>

      {/* Menu Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 overflow-y-auto">
        {filteredMenu.map(item => {
          const cartItem = cart.find(c => c.menuItemId === item.id);
          const quantity = cartItem?.quantity || 0;

          return (
            <div key={item.id} className="bg-white p-3 rounded-3xl border border-black/5 flex items-center gap-4 shadow-sm">
              <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-black/5">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-display font-bold text-ink truncate text-sm">{item.name}</h4>
                <p className="text-brand font-bold text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {quantity > 0 ? (
                    <div className="flex items-center gap-3 bg-oat rounded-xl p-1 px-2 border border-black/5">
                      <button 
                        onClick={() => removeFromCart(cartItem!.id)}
                        className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-ink-muted active:scale-90 transition-all border border-black/5 shadow-sm"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-display font-black text-ink text-sm">{quantity}</span>
                      <button 
                        onClick={() => handleAddItem(item)}
                        className="w-7 h-7 bg-brand text-white rounded-lg flex items-center justify-center active:scale-90 transition-all shadow-md"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleAddItem(item)}
                      className="flex items-center gap-2 bg-brand/10 text-brand px-3 py-1.5 rounded-xl text-xs font-display font-bold uppercase tracking-widest active:scale-95 transition-all w-fit"
                    >
                      <Plus className="w-4 h-4" /> Adicionar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-0 w-full px-6 z-50 flex flex-col gap-3"
          >
            <button 
              onClick={() => setShowCart(true)}
              className="w-full h-16 bg-ink text-white rounded-[24px] flex items-center justify-between px-6 shadow-2xl active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1">Mesa {tableId}</p>
                  <p className="font-display font-bold tracking-tight text-base leading-none">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'} no lançamento
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest leading-none mb-1">Total Parcial</p>
                <p className="font-display font-black text-lg leading-none">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartTotal)}
                </p>
              </div>
            </button>

            <button 
              onClick={handleSendToKDS}
              disabled={isSubmitting}
              className="w-full h-14 bg-brand text-white rounded-[24px] flex items-center justify-center gap-2 shadow-xl shadow-brand/20 font-display font-bold uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" strokeWidth={3} />
                  Lançar para Cozinha
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer (simplified) */}
      <AnimatePresence>
        {selectedItemForNotes && (
          <>
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setSelectedItemForNotes(null)}
               className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
               initial={{ y: '10%', opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: '10%', opacity: 0 }}
               className="fixed bottom-0 left-0 w-full bg-white rounded-t-[40px] z-[70] p-8 max-h-[80vh] overflow-y-auto"
            >
              <h3 className="font-display font-bold text-xl mb-4">Adicionar Observação a {selectedItemForNotes.name}</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PREDEFINED_NOTES.map(note => (
                  <button key={note} onClick={() => setNotes(prev => prev ? `${prev}, ${note}` : note)} className="p-3 bg-oat rounded-xl text-xs font-bold text-ink-muted hover:bg-brand/10">{note}</button>
                ))}
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ou digite outra observação..." className="w-full p-4 border rounded-2xl mb-4" rows={3}></textarea>
              <button onClick={confirmAddItem} className="w-full h-16 bg-brand text-white rounded-[24px] font-bold">Confirmar Adição</button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCart && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="fixed bottom-0 left-0 w-full bg-white rounded-t-[40px] z-[70] p-8 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-display font-bold text-ink tracking-tight">O que será lançado?</h3>
                  <p className="text-ink-muted text-sm font-medium">Confirme os itens para a Mesa {tableId}</p>
                </div>
                <button 
                  onClick={() => setShowCart(false)}
                  className="p-3 bg-oat rounded-2xl text-ink-muted"
                >
                  <ChevronLeft className="w-6 h-6 rotate-[-90deg]" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-black/5">
                    <div className="flex items-center gap-4">
                      <span className="font-display font-black text-brand text-lg">{item.quantity}x</span>
                      <span className="font-bold text-ink">{item.item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className="font-medium text-ink-muted text-sm">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.item.price * item.quantity)}
                      </span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                 <button 
                  onClick={handleSendToKDS}
                  disabled={isSubmitting}
                  className="w-full h-16 bg-brand text-white rounded-[24px] font-display font-bold uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"
                >
                  Confirmar Lançamento
                </button>
                <button 
                  onClick={() => {
                    clearCart();
                    setShowCart(false);
                  }}
                  className="w-full py-4 text-ink-muted text-[10px] font-display font-bold uppercase tracking-widest hover:text-red-500 transition-colors"
                >
                  Limpar Lançamento Atual
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
