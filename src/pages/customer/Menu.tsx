import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import { Search, UtensilsCrossed, AlertTriangle, MapPin, ShieldCheck, Navigation, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { subscribeToSession, subscribeToMenu } from '../../lib/database';

export default function Menu() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const menu = useStore(state => state.menu);
  const { setTableNumber, setOrderType, currentSessionId, setCurrentSessionId, orderType, orders, tableNumber } = useStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [sessionLock, setSessionLock] = useState<string | null>(null);
  const [showLGPD, setShowLGPD] = useState(() => !localStorage.getItem('up_lgpd_accepted'));

  const handleAcceptLGPD = () => {
    localStorage.setItem('up_lgpd_accepted', 'true');
    setShowLGPD(false);
  };

  // Subscribe to menu
  useEffect(() => {
    const unsub = subscribeToMenu();
    return () => unsub();
  }, []);

  // Sync session based on URL or existing session
  useEffect(() => {
    const tableParam = searchParams.get('mesa');
    if (tableParam) {
      // Check for lock
      if (currentSessionId && currentSessionId !== `table-${tableParam}`) {
        // Find if my previous session is still active with pending payment
        const hasPending = orders.some(o => 
          o.sessionId === currentSessionId && 
          o.paymentStatus !== 'paid' && 
          o.status !== 'cancelado'
        );
        
        if (hasPending) {
          setSessionLock(currentSessionId.replace('table-', ''));
          return;
        }
      }

      setTableNumber(tableParam);
      setOrderType('dine-in');
      const sid = `table-${tableParam}`;
      setCurrentSessionId(sid);
    }
  }, [searchParams, setTableNumber, setOrderType, setCurrentSessionId, currentSessionId, orders]);

  useEffect(() => {
    if (currentSessionId) {
      const unsubscribe = subscribeToSession(currentSessionId);
      return () => unsubscribe();
    }
  }, [currentSessionId]);

  // Geofencing Check
  useEffect(() => {
    const checkGeofence = async () => {
      if (showLGPD) return; // Aguarda aprovação antes de pedir GPS da API nativa
      
      const docSnap = await getDoc(doc(db, 'settings', 'config'));
      if (docSnap.exists() && docSnap.data().geoEnabled) {
        const config = docSnap.data();
        navigator.geolocation.getCurrentPosition((pos) => {
          const lat1 = pos.coords.latitude;
          const lon1 = pos.coords.longitude;
          const lat2 = config.lat;
          const lon2 = config.lng;
          
          if (!lat2 || !lon2) return;

          // Haversine formula
          const R = 6371e3; // meters
          const φ1 = lat1 * Math.PI/180;
          const φ2 = lat2 * Math.PI/180;
          const Δφ = (lat2-lat1) * Math.PI/180;
          const Δλ = (lon2-lon1) * Math.PI/180;

          const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ/2) * Math.sin(Δλ/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;

          if (distance > config.radiusMeters) {
            setGeoError(`Você parece estar fora do estabelecimento (${Math.round(distance)}m). Pedidos no local só são permitidos presencialmente.`);
          } else {
            setGeoError(null);
          }
        }, (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setGeoError("Você negou o acesso à localização. Autorize no seu navegador/celular para pedir na mesa.");
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            setGeoError("Sinal de GPS indisponível no momento. Tente chegar mais perto de uma janela.");
          } else {
            setGeoError("Ative o GPS ou permita a localização no navegador para pedir no local (Medida de segurança).");
          }
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      }
    };

    if (orderType === 'dine-in') {
      checkGeofence();
    }
  }, [orderType, showLGPD]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(menu.map(item => item.category)));
    
    // Sort logic
    const order = ['Lanches', 'Acompanhamentos', 'Bebidas'];
    const sortedCats = cats.sort((a, b) => {
      const indexA = order.indexOf(a);
      const indexB = order.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return ['Todos', ...sortedCats];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();
    const order = ['Combos', 'Lanches', 'Acompanhamentos', 'Bebidas', 'Sobremesas'];
    
    // Intelligent mapping for synonyms
    const synonyms: Record<string, string[]> = {
      'hamburguer': ['lanches', 'burger', 'burguer', 'sanduiche', 'pão', 'carne'],
      'burguer': ['lanches', 'hamburguer', 'burger', 'sanduiche'],
      'burger': ['lanches', 'hamburguer', 'burguer', 'sanduiche'],
      'lanche': ['lanches', 'hamburguer', 'burger', 'burguer'],
      'combo': ['combos', 'combo', 'promoção', 'oferta', 'kit'],
      'promocao': ['combos', 'promo', 'promoção', 'oferta'],
      'refri': ['bebidas', 'refrigerante', 'suco', 'coca', 'beber'],
      'beber': ['bebidas', 'refrigerante', 'suco', 'cerveja'],
      'refrigerante': ['bebidas', 'refri', 'coca'],
      'batata': ['acompanhamentos', 'frita', 'porção', 'rústica'],
      'fritas': ['acompanhamentos', 'batata', 'porção'],
      'porção': ['acompanhamentos', 'batata', 'fritas', 'entrada'],
      'doce': ['sobremesas', 'chocolate', 'sorvete'],
      'saudavel': ['suco', 'natural', 'salada']
    };

    return menu
      .filter(item => item.isActive)
      .filter(item => activeCategory === 'Todos' || item.category === activeCategory)
      .filter(item => {
        if (!searchTerm) return true;
        
        const name = item.name.toLowerCase();
        const desc = item.description.toLowerCase();
        const cat = item.category.toLowerCase();
        
        // Direct match
        if (name.includes(searchTerm) || desc.includes(searchTerm) || cat.includes(searchTerm)) {
          return true;
        }

        // Synonym match
        for (const [key, relatedWords] of Object.entries(synonyms)) {
          if (searchTerm.includes(key) || key.includes(searchTerm)) {
            const matchesRelated = relatedWords.some(word => 
              cat.includes(word) || name.includes(word) || desc.includes(word)
            );
            if (matchesRelated) return true;
          }
        }

        return false;
      })
      .sort((a, b) => {
        const indexA = order.indexOf(a.category);
        const indexB = order.indexOf(b.category);
        
        if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
        if (indexA !== -1 && indexB === -1) return -1;
        if (indexA === -1 && indexB !== -1) return 1;
        
        // Secondary sort by name
        return a.name.localeCompare(b.name);
      });
  }, [menu, search, activeCategory]);

  return (
    <div className="px-5 py-6 pb-32">
      <AnimatePresence>
        {showLGPD && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl relative overflow-hidden text-center border-b-4 border-brand">
              <div className="w-16 h-16 bg-brand/10 text-brand rounded-[24px] flex items-center justify-center mx-auto mb-6">
                 <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-display font-black text-ink mb-3 uppercase italic tracking-tighter leading-none">
                Uma experiência <br/><span className="text-brand">feita pra você!</span>
              </h3>
              <p className="text-ink-muted text-sm font-medium leading-relaxed mb-6">
                Para deixar seu pedido rápido e sem complicação, precisamos de duas permissões básicas:
              </p>
              
              <div className="space-y-4 text-left bg-oat/50 p-5 rounded-2xl mb-8">
                 <div className="flex gap-4 items-start">
                    <Navigation className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-ink text-sm">Localização (GPS)</p>
                      <p className="text-ink-muted text-xs font-medium">Pra saber se você já está na mesa conosco ou para mandar a encomenda pra sua casa certinho.</p>
                    </div>
                 </div>
                 <div className="flex gap-4 items-start pt-4 border-t border-black/5">
                    <Info className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-ink text-sm">Contatos / WhatsApp</p>
                      <p className="text-ink-muted text-xs font-medium">Apenas pra te avisar quando a comida ficar pronta e o garçom te achar rapidinho.</p>
                    </div>
                 </div>
              </div>
              
              <button 
                onClick={handleAcceptLGPD}
                className="w-full bg-brand text-white h-14 rounded-2xl font-display font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
              >
                Entendi e Aceito
              </button>
              <p className="text-[9px] text-ink-muted font-bold uppercase tracking-widest mt-6">
                 🔒 Respeitamos seus dados (LGPD)<br/> Usaremos apenas para sua fome!
              </p>
            </div>
          </motion.div>
        )}

        {sessionLock && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
             <div className="bg-white rounded-[40px] p-10 text-center max-w-sm border-2 border-brand/20 shadow-2xl">
                <div className="w-20 h-20 bg-brand/10 text-brand rounded-[32px] flex items-center justify-center mx-auto mb-6">
                   <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-black text-ink mb-2 uppercase italic tracking-tighter">Sessão Bloqueada</h3>
                <p className="text-ink-muted text-sm font-medium leading-relaxed mb-8">
                   Identificamos que você ainda possui um consumo pendente na <span className="text-brand font-bold">Mesa {sessionLock}</span>. 
                   Finalize o pagamento anterior antes de abrir uma nova mesa.
                </p>
                <div className="space-y-4">
                  <button 
                    onClick={() => navigate('/status')}
                    className="w-full bg-brand text-white h-16 rounded-2xl font-display font-bold uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    Ir para Comanda Mesa {sessionLock}
                  </button>
                  <button 
                    onClick={() => setSessionLock(null)}
                    className="w-full h-12 text-ink-muted font-display font-bold uppercase tracking-widest text-[10px]"
                  >
                    Fechar Alerta
                  </button>
                </div>
             </div>
          </motion.div>
        )}

        {geoError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800 leading-tight">Geocerca Ativa</p>
              <p className="text-xs text-red-700 mt-1 font-medium">{geoError}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome & Search - Compact Content */}
      <div className="mb-6 font-display">
        <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-ink uppercase italic tracking-tighter leading-none">
                Urban <span className="text-brand">Prime</span>
              </h1>
              <p className="text-ink-muted text-[9px] font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                {orderType === 'dine-in' ? `CONSUMO LOCAL • MESA ${tableNumber || '?'}` : 'DELIVERY / TAKEAWAY'}
              </p>
            </div>
          <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center">
             <UtensilsCrossed className="w-5 h-5 text-brand" />
          </div>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-ink-muted group-focus-within:text-brand transition-colors">
            <Search className="h-4 w-4" strokeWidth={3} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-11 pr-5 py-3.5 bg-white border-2 border-black/5 rounded-2xl shadow-sm text-xs text-ink font-bold placeholder:text-ink-muted/40 focus:outline-none focus:border-brand/40 focus:ring-4 focus:ring-brand/5 transition-all uppercase tracking-widest"
            placeholder="O que vamos brasear?"
          />
        </div>
      </div>

      {/* Categories Grid/Wrap Layout - More Compact */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2.5">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`group relative px-4 py-2.5 rounded-xl font-display font-black text-[10px] uppercase tracking-wider transition-all border-2 ${
                  isActive 
                    ? 'bg-ink border-ink text-white shadow-md' 
                    : 'bg-white border-black/5 text-ink-muted hover:border-brand/30 hover:text-ink'
                }`}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeCategory"
                    className="absolute inset-0 bg-ink rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {cat === 'Todos' ? '🛒 Todos' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-12">
        {categories.filter(c => c !== 'Todos' && (activeCategory === 'Todos' || activeCategory === c)).map(cat => {
          const items = filteredMenu.filter(item => item.category === cat);
          if (items.length === 0) return null;

          return (
            <div key={cat} className="space-y-5">
              {/* Category Header */}
              <div className="flex items-center gap-3 px-1">
                <h3 className="font-display font-black text-[10px] uppercase tracking-[0.25em] text-ink-muted/50">{cat}</h3>
                <div className="flex-1 h-[1px] bg-black/5"></div>
              </div>

              {/* Grid for this category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => navigate(`/produto/${item.id}`)}
                    className="bg-white rounded-2xl p-3 flex flex-row gap-3 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer border border-transparent hover:border-brand/10 group items-center"
                  >
                    <div className="w-20 h-20 flex-shrink-0 bg-oat rounded-xl overflow-hidden">
                      <img 
                        src={item.image} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-bold text-ink text-sm leading-tight group-hover:text-brand transition-colors truncate">{item.name}</h3>
                      <p className="text-ink-muted text-[10px] line-clamp-2 leading-relaxed mb-0.5">
                        {item.description}
                      </p>
                      <div className="font-display font-bold text-brand text-xs">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {filteredMenu.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl opacity-80 shadow-sm border border-black/5">
            <p className="text-ink-muted font-medium text-lg">Nenhum item encontrado :(</p>
          </div>
        )}
      </div>
    </div>
  );
}
