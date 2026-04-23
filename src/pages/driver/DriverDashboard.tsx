import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore, Order } from '../../store';
import { acceptDelivery, updateDriverLocation, finalizeOrder } from '../../lib/database';
import { useAuth } from '../../lib/AuthProvider';
import { Package, MapPin, Navigation, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapaUrbanPrime from '../../components/shared/MapaUrbanPrime';

export default function DriverDashboard() {
  const { user } = useAuth();
  const orders = useStore(state => state.orders);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tab state from URL: 'available' | 'active'
  const activeTab = (searchParams.get('tab') as 'available' | 'active') || 'available';
  const setActiveTab = (tab: 'available' | 'active') => setSearchParams({ tab });

  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState('');
  const [currentPos, setCurrentPos] = useState<{ lat: number, lng: number } | null>(null);

  const activeOrder = useMemo(() => {
    return orders.find(o => o.status === 'em-rota' && o.driverId === user?.uid);
  }, [orders, user]);

  const availableOrders = useMemo(() => {
    return orders.filter(o => o.status === 'pronto-entrega' && o.type === 'delivery');
  }, [orders]);

  // Track driver's current position always for distance calculations
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentPos(coords);
        if (activeOrder) {
          updateDriverLocation(activeOrder.id, coords.lat, coords.lng);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeOrder?.id]);

  const handleAccept = async (orderId: string) => {
    if (!user) return;
    await acceptDelivery(orderId, user.uid, user.displayName || 'Entregador Prime');
    setActiveTab('active');
  };

  const handleComplete = async () => {
    if (!activeOrder) return;
    if (confirmCode === activeOrder.deliveryCode) {
      await finalizeOrder(activeOrder.id);
      setConfirmCode('');
      setError('');
      setActiveTab('available');
    } else {
      setError('Código incorreto. Peça ao cliente o código de 4 dígitos.');
    }
  };

  const openInMaps = (order: Order) => {
    const addressStr = `${order.address}${order.addressNumber ? `, ${order.addressNumber}` : ''}`;
    const dest = order.customerLocation 
      ? `${order.customerLocation.lat},${order.customerLocation.lng}`
      : encodeURIComponent(addressStr);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}`, '_blank');
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d.toFixed(1);
  };

  return (
    <div className="min-h-screen bg-oat pb-20">
      {/* Header */}
      <header className="bg-ink text-white p-6 pt-12 rounded-b-[40px] shadow-lg mb-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">Painel Logístico</h1>
        <p className="text-white/60 text-xs font-display font-bold uppercase tracking-widest mt-1">Urban Prime Deliveries</p>
      </header>

      {/* Tabs */}
      <div className="px-6 mb-6">
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-black/5">
          <button 
            onClick={() => setActiveTab('available')}
            className={`flex-1 py-3 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'available' ? 'bg-brand text-white shadow-md' : 'text-ink-muted'}`}
          >
            <Clock className="w-4 h-4" />
            Disponíveis ({availableOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-3 rounded-xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 ${activeTab === 'active' ? 'bg-brand text-white shadow-md' : 'text-ink-muted'}`}
          >
            <Navigation className="w-4 h-4" />
            Em Rota {activeOrder ? '(1)' : ''}
          </button>
        </div>
      </div>

      <main className="px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'available' ? (
            <motion.div 
              key="available"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              {availableOrders.length === 0 ? (
                <div className="text-center py-20">
                  <Package className="w-12 h-12 text-ink/10 mx-auto mb-4" />
                  <p className="text-ink-muted font-medium">Nenhum pedido aguardando entrega no momento.</p>
                </div>
              ) : (
                availableOrders.map(order => (
                  <div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-black/5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 mr-4">
                        <h3 className="font-display font-bold text-ink">{order.customerName}</h3>
                        <p className="text-xs text-ink-muted font-medium flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3 text-brand" /> {order.address}{order.addressNumber ? `, ${order.addressNumber}` : ''}{order.addressComplement ? ` - ${order.addressComplement}` : ''}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                           <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                             order.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                             {order.paymentStatus === 'paid' ? 'Já Pago' : 'Cobrar na Entrega'}
                           </span>
                           <span className="text-[9px] font-bold text-ink-muted bg-gray-50 px-2 py-0.5 rounded-full uppercase border border-black/5">
                             {order.paymentMethod === 'pix' ? 'PIX' : 
                              order.paymentMethod === 'credit' ? 'Cartão Crédito' :
                              order.paymentMethod === 'debit' ? 'Cartão Débito' : 'Dinheiro/Maquininha'}
                           </span>
                        </div>
                      </div>
                      <span className="bg-brand/10 text-brand px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1">
                          R$ {order.total.toFixed(2)}
                        </span>
                        {currentPos && order.customerLocation && (
                          <span className="flex items-center gap-1 text-[8px] opacity-70 border-t border-brand/20 pt-1 mt-1">
                             <Navigation className="w-2.5 h-2.5" />
                             {calculateDistance(currentPos.lat, currentPos.lng, order.customerLocation.lat, order.customerLocation.lng)}km
                          </span>
                        )}
                      </span>
                    </div>

                    <ul className="text-xs text-ink-muted mb-6 space-y-1">
                      {order.items.map((it, i) => (
                        <li key={i}>{it.quantity}x {it.item.name}</li>
                      ))}
                    </ul>

                    <button 
                      onClick={() => handleAccept(order.id)}
                      className="w-full bg-brand hover:bg-brand-light text-white font-display font-bold py-4 rounded-2xl shadow-lg shadow-brand/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
                    >
                      Aceitar Entrega
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="active"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {!activeOrder ? (
                <div className="text-center py-20">
                  <Navigation className="w-12 h-12 text-ink/10 mx-auto mb-4" />
                  <p className="text-ink-muted font-medium">Você não possui entregas em andamento.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-brand/20">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center text-white">
                        <Navigation className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h2 className="text-lg font-display font-bold text-ink">Em Entrega</h2>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider ${
                            activeOrder.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700 animate-pulse'
                          }`}>
                            {activeOrder.paymentStatus === 'paid' ? 'PAGAMENTO OK' : 'COBRAR: R$ ' + activeOrder.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-brand font-bold uppercase tracking-widest">Cliente: {activeOrder.customerName}</p>
                          {currentPos && activeOrder.customerLocation && (
                            <span className="text-[10px] bg-brand text-white px-2 py-0.5 rounded-full font-bold">
                              {calculateDistance(currentPos.lat, currentPos.lng, activeOrder.customerLocation.lat, activeOrder.customerLocation.lng)}km restantes
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <MapaUrbanPrime 
                        driverCoords={currentPos} 
                        customerCoords={activeOrder.customerLocation}
                        height="200px"
                        className="mb-4"
                      />

                      <div className="bg-oat p-4 rounded-2xl border border-black/5">
                        <span className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest block mb-2">Destino</span>
                        <p className="text-ink font-bold text-sm leading-tight">
                          {activeOrder.address}
                          {activeOrder.addressNumber ? `, ${activeOrder.addressNumber}` : ''}
                          {activeOrder.addressComplement ? ` - ${activeOrder.addressComplement}` : ''}
                        </p>
                      </div>

                      <button 
                        onClick={() => openInMaps(activeOrder)}
                        className="w-full flex items-center justify-center gap-3 py-4 bg-ink text-white rounded-2xl font-display font-bold text-sm uppercase tracking-wider hover:bg-black active:scale-95 transition-all shadow-lg"
                      >
                        <MapPin className="w-5 h-5 text-brand" />
                        Abrir GPS (Maps/Waze)
                      </button>
                    </div>

                    <div className="border-t border-black/5 pt-6">
                       <span className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest block mb-4 text-center">Confirmar Entrega</span>
                       
                       <div className="flex gap-2 mb-4">
                        <input 
                          type="text"
                          maxLength={4}
                          value={confirmCode}
                          onChange={(e) => setConfirmCode(e.target.value)}
                          placeholder="CÓDIGO (4 DÍGITOS)"
                          className="w-full bg-oat border-2 border-transparent focus:border-brand rounded-xl py-4 text-center font-mono text-2xl font-bold tracking-[1em] focus:outline-none transition-all placeholder:text-gray-300 pointer-events-auto"
                        />
                       </div>
                       
                       {error && <p className="text-red-500 text-[10px] font-bold text-center mb-4 uppercase">{error}</p>}

                       <button 
                        onClick={handleComplete}
                        disabled={confirmCode.length < 4}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 disabled:text-gray-400 text-white font-display font-bold py-5 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                       >
                         <CheckCircle className="w-5 h-5" />
                         Finalizar Pedido
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
