import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, OrderType, Order } from '../../store';
import { getDistanceInMeters } from '../../lib/utils';
import { QrCode, MapPin, Store, UtensilsCrossed, ChevronRight, X, ShieldCheck, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Scanner } from '@yudiel/react-qr-scanner';

export default function Welcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setOrderType, setCustomerName, setTableNumber, currentOrderId, setRequireUpfrontPayment, orders, deviceId } = useStore();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [step, setStep] = useState<'type' | 'table'>('type');
  const [selectedType, setSelectedType] = useState<OrderType>('dine-in');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    // Check if there's any active dine-in order for this user/device
    const active = orders.find(o => 
      o.type === 'dine-in' && 
      o.status !== 'finalizado' && 
      o.status !== 'cancelado' &&
      (o.userId === deviceId || o.deviceId === deviceId)
    );
    setActiveOrder(active || null);
  }, [orders, deviceId]);

  useEffect(() => {
    const mesaParam = searchParams.get('mesa');
    if (!mesaParam) return;

    setOrderType('dine-in');
    handleTableSelect(mesaParam);
  }, [searchParams]);

  const handleTypeSelect = (type: OrderType) => {
    setSelectedType(type);
    setOrderType(type);
    if (type === 'dine-in') {
      setStep('table');
    } else {
      navigate('/cardapio');
    }
  };

  const handleTableSelect = async (table: string) => {
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'config'));
      const config = configDoc.data();

      // Set upfront payment to false by default
      setRequireUpfrontPayment(false);

      if (config?.geoEnabled && typeof config?.lat === 'number' && typeof config?.lng === 'number') {
        if (navigator.geolocation) {
          try {
             // Request permission and check distance only when they try to sit at a table
             const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
               navigator.geolocation.getCurrentPosition(resolve, reject, { 
                 enableHighAccuracy: true, 
                 timeout: 10000, 
                 maximumAge: 0 
               });
             });
             
             const distance = getDistanceInMeters(
               pos.coords.latitude, 
               pos.coords.longitude, 
               config.lat, 
               config.lng
             );
             
             const maxRadius = config.radiusMeters || 200;
             if (distance > maxRadius) {
               setRequireUpfrontPayment(true);
             }
          } catch (err) {
             console.error('GPS error on table select:', err);
             setRequireUpfrontPayment(true);
          }
        } else {
          setRequireUpfrontPayment(true);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar config de geo:', err);
    }
    
    setTableNumber(table);
    navigate('/cardapio');
  };

  const handleScan = (detectedCodes: any[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const decodedText = detectedCodes[0].rawValue;
      setIsScanning(false);
      try {
        if (decodedText.startsWith("http")) {
          const url = new URL(decodedText);
          const mesa = url.searchParams.get("mesa");
          if (mesa) {
            handleTableSelect(mesa);
          } else {
            alert("QR Code inválido: Não contém o número da mesa.");
          }
        } else {
          handleTableSelect(decodedText);
        }
      } catch (e) {
        handleTableSelect(decodedText);
      }
    }
  };

  const tableNumber = useStore(state => state.tableNumber);
  const orderType = useStore(state => state.orderType);

  const handleReturnToTable = () => {
    navigate('/cardapio');
  };

  const handleDeliveryStart = () => {
    if (activeOrder) {
      alert("Você possui um atendimento ativo na mesa. Libere sua comanda para pedir delivery.");
      return;
    }
    setOrderType('delivery');
    setTableNumber('');
    navigate('/cardapio');
  };

  return (
    <div className="flex flex-col min-h-screen bg-oat">
      {/* Hero Image */}
      <div className="h-[45vh] w-full relative">
        <img 
          src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=800&h=1000" 
          alt="Burger" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-oat via-oat/20 to-transparent" />
      </div>

      <div className="px-5 -mt-16 relative z-10 flex-1 flex flex-col pb-8 max-w-2xl mx-auto w-full">
        {/* Active Order Banner if exists and is truly active */}
        {activeOrder && (
          <motion.button 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => navigate('/status')}
            className="mb-6 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-display font-bold text-emerald-900 text-sm">Pedido em andamento!</p>
                <p className="text-emerald-700/70 text-xs font-medium">Mesa {activeOrder.tableNumber} • Toque para acompanhar</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-700" />
          </motion.button>
        )}

        <div className="bg-white p-6 rounded-[32px] shadow-sm border border-black/5 flex-1 flex flex-col mb-6">
          
          <div className="flex items-center justify-center mb-8 pb-6 border-b border-black/5">
             <h1 className="font-display font-bold text-2xl tracking-wide text-ink flex flex-col items-center leading-none">
              URBAN PRIME<span className="text-brand text-xs uppercase font-bold tracking-widest mt-0.5">Grill</span>
            </h1>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-3xl font-display font-bold mb-2 text-ink tracking-tight text-center">Fome de quê hoje? 👋</h2>
              <p className="text-ink-muted mb-10 font-medium text-center px-4">Os melhores burgers da cidade, prontos para você.</p>
              
              <div className="space-y-4">
                {activeOrder ? (
                  /* EXTREME PROTECTED MODE: User has an active dine-in session */
                  <div className="space-y-6">
                    <div className="p-8 bg-emerald-50 border-2 border-emerald-100 rounded-[40px] text-center relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-bl-[100%] transition-transform group-hover:scale-110" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-[24px] flex items-center justify-center mb-4 shadow-sm">
                           <UtensilsCrossed className="w-8 h-8" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-display font-black text-emerald-900 uppercase tracking-tight">Atendimento Ativo</h3>
                        <p className="text-emerald-700/70 text-xs font-bold uppercase tracking-widest mt-1">Mesa {activeOrder.tableNumber}</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleReturnToTable}
                      className="w-full flex items-center justify-between p-6 bg-brand text-white rounded-[24px] active:scale-[0.98] transition-all shadow-[0_15px_30px_-8px_rgba(255,78,0,0.4)] group"
                    >
                      <div className="text-left">
                        <h3 className="font-display font-black text-xl uppercase tracking-tight">Fazer Novo Pedido</h3>
                        <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Adicionar à comanda aberta</p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform">
                        <ChevronRight className="w-6 h-6" strokeWidth={3} />
                      </div>
                    </button>

                    <div className="pt-4 border-t border-black/5 flex flex-col items-center">
                       <p className="text-[10px] text-ink-muted font-bold uppercase tracking-widest text-center leading-relaxed">
                         Para pedir delivery, libere sua comanda<br/>com o atendente ou na portaria.
                       </p>
                    </div>
                  </div>
                ) : (
                  /* Standard Mode: No active session */
                  <>
                    <button 
                      onClick={handleDeliveryStart}
                      className="w-full flex items-center justify-between p-7 bg-brand text-white rounded-[32px] active:scale-[0.98] transition-all shadow-[0_20px_40px_-10px_rgba(255,78,0,0.4)] group"
                    >
                      <div className="text-left">
                        <h3 className="font-display font-black text-2xl uppercase tracking-tight italic">PEDIR DELIVERY</h3>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Receba em casa agora</p>
                      </div>
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center group-hover:translate-x-1 transition-all">
                        <ChevronRight className="w-8 h-8" strokeWidth={3} />
                      </div>
                    </button>

                    <div className="relative flex items-center py-6">
                      <div className="flex-grow border-t border-black/5"></div>
                      <span className="flex-shrink-0 mx-4 text-ink-muted/30 text-[10px] font-display font-black uppercase tracking-[0.3em]">Ou</span>
                      <div className="flex-grow border-t border-black/5"></div>
                    </div>

                    <button 
                      onClick={() => setIsScanning(true)}
                      className="w-full flex items-center gap-5 p-6 border-2 border-black/5 bg-oat/30 rounded-[32px] hover:border-brand/30 hover:bg-white transition-all active:scale-[0.98] text-left group"
                    >
                      <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-black/5 group-hover:text-brand transition-colors">
                        <QrCode className="w-8 h-8" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="font-display font-black text-ink uppercase tracking-tight text-lg leading-tight">Escaneie sua Mesa</h3>
                        <p className="text-ink-muted text-[10px] font-bold uppercase tracking-widest mt-1">Para consumo no local</p>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Admin and Driver Links */}
        <div className="text-center flex justify-center items-center gap-4 flex-wrap">
          <button 
            onClick={() => navigate('/pedidos')}
            className="text-[10px] uppercase tracking-widest font-display font-bold text-ink-muted hover:text-ink transition-colors"
          >
            Meus Pedidos
          </button>
        </div>
      </div>

      {/* QR Code Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center pt-16 px-4"
          >
            <button 
              onClick={() => setIsScanning(false)}
              className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-6 relative z-10">
              <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Camera className="w-8 h-8 text-white" strokeWidth={2} />
              </div>
              <h3 className="font-display font-bold text-white text-3xl tracking-tight mb-2">Escaneie o QR Code</h3>
              <p className="text-white/70 text-sm font-medium">Aponte a câmera para a mesa.</p>
            </div>
            
            <div className="w-full max-w-sm aspect-square bg-black rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/10 relative z-10">
              <Scanner 
                onScan={handleScan}
                formats={['qr_code']}
                components={{
                  torch: true,
                  finder: false,
                }}
                styles={{
                  container: { width: '100%', height: '100%' }
                }}
              />
              <div className="absolute inset-0 border-[3px] border-dashed border-white/30 rounded-[40px] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-brand rounded-3xl pointer-events-none" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
