import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Trash2, ShoppingBag, ArrowRight, Plus, Pencil } from 'lucide-react';
import { motion } from 'motion/react';

export default function Cart() {
  const navigate = useNavigate();
  const { cart, removeFromCart } = useStore();

  const total = cart.reduce((sum, item) => {
    const extrasPrice = (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
    return sum + ((item.item.price + extrasPrice) * item.quantity);
  }, 0);

  if (cart.length === 0) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 bg-white shadow-sm border border-black/5 text-ink-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10" strokeWidth={1.5} />
        </div>
        <h2 className="text-3xl font-display font-bold text-ink mb-2 tracking-tight">Sua bandeja<br/>está vazia</h2>
        <p className="text-ink-muted mb-8 font-medium">Bora buscar aquele lanche?</p>
        <button 
          onClick={() => navigate('/cardapio')}
          className="w-full bg-brand text-white font-display font-bold py-4 rounded-full active:scale-95 transition-all shadow-[0_8px_20px_-6px_rgba(255,78,0,0.5)] tracking-wide"
        >
          Ver Menu
        </button>
      </div>
    );
  }

  return (
    <div className="bg-oat min-h-[calc(100vh-5rem)] flex flex-col pt-6 pb-40">
      <div className="px-5 flex-1 max-w-2xl mx-auto w-full">
        <h2 className="text-3xl font-display font-bold text-ink mb-6 tracking-tight">Revise seu<br/>pedido</h2>

        <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-black/5">
          {cart.map((cartItem, idx) => (
            <motion.div 
              key={cartItem.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`p-4 flex gap-4 ${idx !== cart.length - 1 ? 'border-b border-black/5' : ''}`}
            >
              <div className="w-20 h-20 bg-oat rounded-2xl overflow-hidden flex-shrink-0">
                <img 
                  src={cartItem.item.image} 
                  alt={cartItem.item.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-start">
                  <h3 className="font-display font-bold text-ink leading-tight pr-4 text-base">
                    <span className="text-brand mr-1">{cartItem.quantity}x</span> {cartItem.item.name}
                  </h3>
                  <div className="flex -mr-2">
                    <button 
                      onClick={() => navigate(`/produto/${cartItem.menuItemId}?edit=${cartItem.id}`)}
                      className="p-2 text-ink-muted hover:text-brand rounded-xl transition-colors shrink-0"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={() => removeFromCart(cartItem.id)}
                      className="p-2 text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                {cartItem.notes && (
                  <p className="text-ink-muted text-xs mt-1.5 mb-0.5 bg-oat px-3 py-2 rounded-xl italic font-medium inline-block w-fit">
                    "{cartItem.notes}"
                  </p>
                )}
                <div className="font-display font-extrabold text-brand mt-auto text-base">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cartItem.item.price + (cartItem.selectedExtras || []).reduce((acc, e) => acc + e.price, 0)) * cartItem.quantity)}
                </div>
                {cartItem.selectedExtras && cartItem.selectedExtras.length > 0 && (
                  <p className="text-[10px] text-brand font-bold mt-1">
                    + {cartItem.selectedExtras.map(e => e.name).join(', ')}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <button 
          onClick={() => navigate('/cardapio')}
          className="w-full mt-6 py-4 bg-white border border-black/5 shadow-sm text-ink font-display font-bold active:bg-gray-50 rounded-[24px] transition-all text-center flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Adicionar mais itens
        </button>
      </div>

      <div className="fixed bottom-0 left-0 w-full p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,20px))] z-50 pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto bg-white rounded-[32px] p-4 shadow-[0_20px_40px_-15px_rgba(28,25,23,0.3)] border border-black/5">
          <div className="flex justify-between items-center mb-4 px-3">
            <span className="text-ink-muted font-display font-bold uppercase tracking-wider text-xs">Total do pedido</span>
            <span className="text-2xl font-display font-black text-ink">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
            </span>
          </div>
          <button 
            onClick={() => navigate('/checkout')}
            className="w-full bg-brand text-white font-display font-bold py-3.5 rounded-full active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md tracking-wide"
          >
            <span>Confirmar Pagamento</span>
            <ArrowRight className="w-5 h-5" strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );
}
