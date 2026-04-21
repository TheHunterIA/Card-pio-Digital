import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, MenuItemExtra } from '../../store';
import { Minus, Plus, CheckCircle2 } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const menu = useStore(state => state.menu);
  const { cart, addToCart, updateCartItem } = useStore();
  
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selectedExtras, setSelectedExtras] = useState<MenuItemExtra[]>([]);

  const product = menu.find(i => i.id === id);
  const isEditing = Boolean(editId);

  useEffect(() => {
    if (isEditing) {
      const cartItem = cart.find(item => item.id === editId);
      if (cartItem) {
        setQuantity(cartItem.quantity);
        setNotes(cartItem.notes);
        setSelectedExtras(cartItem.selectedExtras || []);
      }
    }
  }, [editId, cart, isEditing]);

  useEffect(() => {
    if (!product) {
      navigate('/cardapio');
    }
  }, [product, navigate]);

  if (!product) return null;

  const toggleExtra = (extra: MenuItemExtra) => {
    setSelectedExtras(prev => 
      prev.some(e => e.id === extra.id)
        ? prev.filter(e => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const isOutOfStock = product.trackStock && (product.stockQuantity === undefined || product.stockQuantity <= 0);

  const handleAdd = () => {
    if (isOutOfStock) return;
    if (isEditing && editId) {
      updateCartItem(editId, product, notes, quantity, selectedExtras);
    } else {
      addToCart(product, notes, quantity, selectedExtras);
    }
    navigate('/carrinho');
  };

  const extrasTotal = selectedExtras.reduce((sum, e) => sum + e.price, 0);
  const total = (product.price + extrasTotal) * quantity;

  return (
    <div className="bg-oat min-h-screen flex flex-col md:flex-row pb-32 md:pb-0">
      <div className="relative h-64 md:h-[calc(100vh-5rem)] w-full md:w-1/2 bg-white overflow-hidden rounded-b-[32px] md:rounded-l-none md:rounded-r-[60px] md:sticky md:top-20 shadow-sm">
        <img 
          src={product.image} 
          alt={product.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        
        {/* Decorative label for desktop */}
        <div className="hidden md:flex absolute bottom-8 left-8 bg-brand text-white px-6 py-3 rounded-2xl font-display font-extrabold text-2xl shadow-xl">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
        </div>
      </div>

      <div className="px-5 pt-4 flex-1 md:max-w-2xl md:mx-auto md:px-10 md:pt-12 space-y-6">
        <div className="text-ink-muted">
          <div className="flex justify-between items-start mb-1 md:mb-6">
            <h1 className="text-2xl md:text-5xl font-display font-bold text-ink leading-tight pr-4">{product.name}</h1>
            <span className="text-xl md:hidden font-display font-black text-brand whitespace-nowrap">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
            </span>
          </div>
          <p className="text-ink-muted text-sm md:text-lg leading-relaxed">{product.description}</p>
        </div>

        {/* Extras Selection */}
        {product.extras && product.extras.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-ink text-sm uppercase tracking-[0.2em] mb-4">Turbine seu Pedido</h3>
            <div className="grid grid-cols-1 gap-3">
              {product.extras.map(extra => {
                const isSelected = selectedExtras.some(e => e.id === extra.id);
                return (
                  <button 
                    key={extra.id}
                    onClick={() => toggleExtra(extra)}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      isSelected ? 'bg-brand/5 border-brand shadow-sm' : 'bg-white border-black/5 hover:border-black/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'bg-brand border-brand' : 'border-black/10 bg-white'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3 h-3 text-white" strokeWidth={4} />}
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? 'text-ink' : 'text-ink-muted'}`}>{extra.name}</span>
                    </div>
                    <span className={`text-sm font-mono font-bold ${isSelected ? 'text-brand' : 'text-ink-muted'}`}>
                      + R$ {extra.price.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white p-4 md:p-8 rounded-[32px] shadow-sm border border-black/5">
          <h3 className="font-display font-bold text-ink mb-2 text-base md:text-xl uppercase tracking-widest text-[10px]">Nota para a cozinha</h3>
          <textarea 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Tira o picles..."
            className="w-full bg-oat border-2 border-transparent rounded-xl p-3 md:p-6 text-sm md:text-base text-ink placeholder-gray-400 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-none font-medium h-20 md:h-auto"
            rows={2}
          />
        </div>
      </div>

      {/* Floating Action Bar */}
      <div className="fixed bottom-0 left-0 w-full p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,20px))] z-50 pointer-events-none sticky md:relative">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <div className="bg-white p-3 rounded-[32px] shadow-[0_15px_30px_-10px_rgba(28,25,23,0.3)] flex items-center gap-3 border border-black/5">
            <div className="flex items-center bg-oat rounded-2xl p-1 shrink-0">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 flex items-center justify-center text-ink active:bg-black/5 rounded-xl transition-colors"
                aria-label="Diminuir"
              >
                <Minus className="w-5 h-5" strokeWidth={2.5} />
              </button>
              <span className="w-8 text-center font-display font-bold text-ink text-lg">{quantity}</span>
              <button 
                onClick={() => setQuantity(quantity + 1)}
                 className="w-12 h-12 flex items-center justify-center text-ink active:bg-black/5 rounded-xl transition-colors"
                 aria-label="Aumentar"
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            <button 
              onClick={handleAdd}
              disabled={isOutOfStock}
              className={`flex-1 font-display font-bold py-4 rounded-2xl transition-all flex items-center justify-between px-6 shadow-lg ${
                isOutOfStock 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                  : 'bg-brand hover:bg-brand-light text-white active:scale-95 shadow-brand/20'
              }`}
            >
              <span className="tracking-wide text-xs uppercase tracking-widest">
                {isOutOfStock ? 'Esgotado' : (isEditing ? 'Atualizar' : 'Adicionar')}
              </span>
              {!isOutOfStock && <span className="text-base">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
