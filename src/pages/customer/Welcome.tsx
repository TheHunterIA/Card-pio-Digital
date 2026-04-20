import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, OrderType, Order } from '../../store';
import { getDistanceInMeters } from '../../lib/utils';
import { QrCode, MapPin, Store, UtensilsCrossed, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function Welcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setOrderType, setCustomerName, setTableNumber, currentOrderId, setRequireUpfrontPayment } = useStore();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [step, setStep] = useState<'type' | 'table'>('type');
  const [selectedType, setSelectedType] = useState<OrderType>('dine-in');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!currentOrderId) {
      setActiveOrder(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'orders', currentOrderId), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as Order;
        // Only show banner if order is NOT finalized or cancelled
        if (data.status !== 'finalizado' && data.status !== 'cancelado') {
          setActiveOrder({ id: doc.id, ...data });
        } else {
          setActiveOrder(null);
        }
      } else {
        setActiveOrder(null);
      }
    }, (err) => {
      console.error('Welcome order snapshot error:', err);
      // If permission denied or other error, clear local tracking to prevent loop
      useStore.getState().setCurrentOrderId(null);
      setActiveOrder(null);
    });

    return () => unsub();
  }, [currentOrderId]);

  useEffect(() => {
    const mesaParam = searchParams.get('mesa');
    if (!mesaParam) return;

    const validateLocationAndProceed = async () => {
      // Por padrão, setamos requireUpfrontPayment como false a menos que falhe
      setRequireUpfrontPayment(false);
      setOrderType('dine-in');
      setTableNumber(mesaParam);
      
      try {
        const configDoc = await getDoc(doc(db, 'settings', 'config'));
        const config = configDoc.data();

        // Se Geofence não está ligada ou não tem coordenada, apenas prossegue normal
        if (!config?.geoEnabled || typeof config?.lat !== 'number' || typeof config?.lng !== 'number') {
          navigate('/cardapio');
          return;
        }

        // Se não tem GPS, prossegue exigindo pagamento antecipado silenciosamente
        if (!navigator.geolocation) {
          setRequireUpfrontPayment(true);
          navigate('/cardapio');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const distance = getDistanceInMeters(
              pos.coords.latitude, 
              pos.coords.longitude, 
              config.lat, 
              config.lng
            );
            
            const maxRadius = config.radiusMeters || 200;
            
            // Se estiver longe, exige pagamento antecipado
            if (distance > maxRadius) {
              setRequireUpfrontPayment(true);
            }
            navigate('/cardapio');
          },
          (err) => {
            console.error('GPS error:', err);
            // Se negou permissão, exige pagamento antecipado
            setRequireUpfrontPayment(true);
            navigate('/cardapio');
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

      } catch (err) {
        console.error('Erro ao buscar config de geo:', err);
        // Em caso de erro de rede, apenas prossegue
        navigate('/cardapio');
      }
    };

    validateLocationAndProceed();
  }, [searchParams, setOrderType, setTableNumber, navigate, setRequireUpfrontPayment]);

  const handleTypeSelect = (type: OrderType) => {
    setSelectedType(type);
    setOrderType(type);
    if (type === 'dine-in') {
      setStep('table');
    } else {
      navigate('/cardapio');
    }
  };

  const handleTableSelect = (table: string) => {
    setTableNumber(table);
    navigate('/cardapio');
  };

  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        scanner.clear();
        setIsScanning(false);
        // Ex: "https://site.com/?mesa=04" -> "04"
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
            // Or maybe the QR code just has the number "04"
            handleTableSelect(decodedText);
          }
        } catch (e) {
          handleTableSelect(decodedText);
        }
      }, (err) => {
        // silent fail on scan to not spam console
      });

      return () => {
        scanner.clear().catch(e => console.error(e));
      };
    }
  }, [isScanning]);

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
                <p className="text-emerald-700/70 text-xs font-medium">Toque para acompanhar</p>
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
                <button 
                  onClick={() => {
                    setOrderType('delivery');
                    setTableNumber('');
                    navigate('/cardapio');
                  }}
                  className="w-full flex items-center justify-between p-6 bg-brand text-white rounded-[24px] active:scale-[0.98] transition-all shadow-[0_15px_30px_-8px_rgba(255,78,0,0.4)] group"
                >
                  <div className="text-left">
                    <h3 className="font-display font-bold text-xl uppercase tracking-tight">Ver Cardápio</h3>
                    <p className="text-white/70 text-sm font-medium">Peça e receba em casa</p>
                  </div>
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                </button>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-black/5"></div>
                  <span className="flex-shrink-0 mx-4 text-ink-muted/40 text-[10px] font-display font-bold uppercase tracking-[0.2em]">Está no restaurante?</span>
                  <div className="flex-grow border-t border-black/5"></div>
                </div>

                <button 
                  onClick={() => setIsScanning(true)}
                  className="w-full flex items-center gap-4 p-5 border-2 border-black/5 bg-oat/30 rounded-[24px] hover:border-brand/30 hover:bg-white transition-all active:scale-[0.98] text-left group"
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-black/5 group-hover:text-brand transition-colors">
                    <QrCode className="w-6 h-6" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-ink">Escanear Mesa</h3>
                    <p className="text-ink-muted text-xs font-medium">Identifique sua mesa por QR Code</p>
                  </div>
                </button>
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
            className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center pt-24 px-4"
          >
            <button 
              onClick={() => setIsScanning(false)}
              className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="text-center mb-8">
              <h3 className="font-display font-bold text-white text-2xl tracking-tight mb-2">Escaneie o QR Code</h3>
              <p className="text-white/60 text-sm font-medium">Aponte a câmera para o código colado na sua mesa.</p>
            </div>
            
            <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden p-2">
              <div id="reader" className="w-full" style={{ border: 'none' }}></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
