import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, PaymentMethod } from '../../store';
import { placeOrder } from '../../lib/database';
import { doc, getDoc, query, collection, where, getDocs, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { QrCode, Banknote, MapPin, Store, X, CreditCard, Smartphone, Check, Percent, Camera, AlertTriangle, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import IdentifyModal from '../../components/IdentifyModal';
import GooglePlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-google-places-autocomplete';
import { Scanner } from '@yudiel/react-qr-scanner';
import { geocodeAddressFallback, getDistanceInMeters, getDeliveryFeeCalculation, reverseGeocode } from '../../lib/utils';
import { subscribeToDeliveryConfig } from '../../lib/database';

export default function Checkout() {
  const navigate = useNavigate();
  const orderType = useStore(state => state.orderType);
  const setOrderType = useStore(state => state.setOrderType);
  const cart = useStore(state => state.cart);
  const address = useStore(state => state.address);
  const setAddress = useStore(state => state.setAddress);
  const addressNumber = useStore(state => state.addressNumber);
  const setAddressNumber = useStore(state => state.setAddressNumber);
  const addressComplement = useStore(state => state.addressComplement);
  const setAddressComplement = useStore(state => state.setAddressComplement);
  const cep = useStore(state => state.cep);
  const setCep = useStore(state => state.setCep);
  const setCustomerLocation = useStore(state => state.setCustomerLocation);
  const customerLocation = useStore(state => state.customerLocation);
  const deliveryConfig = useStore(state => state.deliveryConfig);
  const tableNumber = useStore(state => state.tableNumber);
  const setTableNumber = useStore(state => state.setTableNumber);
  const customerName = useStore(state => state.customerName);
  const whatsapp = useStore(state => state.whatsapp);
  const requireUpfrontPayment = useStore(state => state.requireUpfrontPayment);
  const couponCode = useStore(state => state.couponCode);
  const setCouponCode = useStore(state => state.setCouponCode);
  const couponDiscount = useStore(state => state.couponDiscount);
  const setCouponDiscount = useStore(state => state.setCouponDiscount);
  const isFreeDeliveryCoupon = useStore(state => state.isFreeDeliveryCoupon);
  const setIsFreeDeliveryCoupon = useStore(state => state.setIsFreeDeliveryCoupon);

  const total = cart.reduce((sum, item) => {
    const extrasPrice = (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
    return sum + (((item.item?.price || 0) + extrasPrice) * item.quantity);
  }, 0);

  const googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const handleGeocodeCustomerAddress = async (street: string, num: string) => {
    if (!street) return;
    setIsGeocoding(true);
    try {
      const query = num ? `${street}, ${num}` : street;
      let coords = await geocodeAddressFallback(query, googleMapsKey);
      
      if (!coords && num) {
         // Fallback to street only if number fails
         coords = await geocodeAddressFallback(street, googleMapsKey);
      }

      if (coords) {
         setCustomerLocation(coords);
      } else {
         console.error("Geocoding failed entirely to find customer location");
      }
    } catch (e) {
      console.error("Geocoding unhandled error", e);
    } finally {
      setIsGeocoding(false);
    }
  };
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(requireUpfrontPayment ? 'pix' : null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showIdentify, setShowIdentify] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [storeConfig, setStoreConfig] = useState<any>(null);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [currentDeliveryFee, setCurrentDeliveryFee] = useState(0);
  const [hasActiveTableOrder, setHasActiveTableOrder] = useState(false);
  const orders = useStore(state => state.orders);
  const deviceId = useStore(state => state.deviceId);

  const pendingTableTotal = React.useMemo(() => {
    if (orderType !== 'dine-in' || !tableNumber) return 0;
    return orders
      .filter(o => 
        o.tableNumber === tableNumber && 
        o.status !== 'finalizado' && 
        o.status !== 'cancelado' &&
        o.paymentStatus !== 'paid' &&
        (o.userId === deviceId || o.deviceId === deviceId)
      )
      .reduce((acc, curr) => acc + curr.total, 0);
  }, [orders, orderType, tableNumber, deviceId]);

  // Check if this table already has an active order from this client
  useEffect(() => {
    if (orderType === 'dine-in' && tableNumber) {
      const active = orders.some(o => 
        o.tableNumber === tableNumber && 
        o.status !== 'finalizado' && 
        o.status !== 'cancelado' &&
        o.paymentStatus !== 'paid' &&
        (o.userId === deviceId || o.deviceId === deviceId)
      );
      setHasActiveTableOrder(active);
    } else {
      setHasActiveTableOrder(false);
    }
  }, [orders, orderType, tableNumber, deviceId]);

  // Sync orderType if table exists
  useEffect(() => {
    if (tableNumber && orderType !== 'dine-in') {
      setOrderType('dine-in');
    }
  }, [tableNumber, orderType, setOrderType]);

  useEffect(() => {
    const unsub = subscribeToDeliveryConfig();
    return () => unsub();
  }, []);

  useEffect(() => {
    // Geocode stored address if location is missing
    if (address && !customerLocation) {
      handleGeocodeCustomerAddress(address, addressNumber);
    }
  }, []);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'config'));
        if (docSnap.exists()) {
          setStoreConfig(docSnap.data());
        }
      } catch (e) {
        console.error("Failed to load store config", e);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const baseLat = deliveryConfig?.baseLocation?.lat || storeConfig?.lat;
    const baseLng = deliveryConfig?.baseLocation?.lng || storeConfig?.lng;
    const hasBaseLocation = baseLat && baseLng && baseLat !== 0;

    if (orderType === 'delivery' && customerLocation && hasBaseLocation) {
      const distanceMeters = getDistanceInMeters(
        customerLocation.lat,
        customerLocation.lng,
        baseLat,
        baseLng
      );
      
      const distanceKm = distanceMeters / 1000;

      // 1. Check Range Limit
      if (storeConfig?.deliveryGeoEnabled) {
        const limitKm = storeConfig.deliveryRadiusKm || 5;
        setIsOutOfRange(distanceKm > limitKm);
      } else {
        setIsOutOfRange(false);
      }

      // 2. Calculate Dynamic Fee
      if (deliveryConfig && deliveryConfig.radii.length > 0) {
        const dynamicFee = getDeliveryFeeCalculation(distanceKm, deliveryConfig, total);
        setCurrentDeliveryFee(dynamicFee);
      } else {
        // Fallback to static fee in storeConfig
        setCurrentDeliveryFee(storeConfig?.deliveryFee || 0);
      }
    } else {
      setIsOutOfRange(false);
      // Fallback to static fee if we don't have location yet but it's delivery
      if (orderType === 'delivery') {
        setCurrentDeliveryFee(storeConfig?.deliveryFee || 0);
      } else {
        setCurrentDeliveryFee(0);
      }
    }
  }, [customerLocation, storeConfig, orderType, deliveryConfig, total]);

  const applyCoupon = async () => {
    const code = useStore.getState().couponCode;
    if (!code) return;

    if (!auth.currentUser) {
      alert("Você precisa estar logado para usar cupons.");
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'config'));
      if (docSnap.exists()) {
        const config = docSnap.data();
        const couponData = config.coupons?.[code];
        
        if (!couponData) {
          alert("Cupom inválido!");
          setIsApplyingCoupon(false);
          return;
        }

        const { discount, limitPerUser, type } = couponData;

        // Check usage
        const usageQuery = query(
          collection(db, 'couponUsage'),
          where('uid', '==', auth.currentUser.uid),
          where('code', '==', code)
        );
        const usageSnap = await getDocs(usageQuery);
        let currentUsage = 0;
        if (!usageSnap.empty) {
          currentUsage = usageSnap.docs[0].data().count;
        }

        if (currentUsage >= limitPerUser) {
          alert(`Você já atingiu o limite de uso deste cupom (${limitPerUser}x).`);
          setIsApplyingCoupon(false);
          return;
        }

        useStore.getState().setCouponDiscount(discount || 0);
        useStore.getState().setIsFreeDeliveryCoupon(type === 'free_delivery');
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao aplicar o cupom.");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    useStore.getState().setCouponCode('');
    useStore.getState().setCouponDiscount(0);
    useStore.getState().setIsFreeDeliveryCoupon(false);
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
            setTableNumber(mesa);
            setOrderType('dine-in');
          } else {
            setTableNumber(decodedText);
            setOrderType('dine-in');
          }
        } else {
          setTableNumber(decodedText);
          setOrderType('dine-in');
        }
      } catch (e) {
        setTableNumber(decodedText);
        setOrderType('dine-in');
      }
    }
  };

  const lookupCep = async (cepValue: string) => {
    if (cepValue.length !== 8) return;
    
    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepValue}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        const formattedAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
        setAddress(formattedAddress);
        await handleGeocodeCustomerAddress(formattedAddress, addressNumber);
      }
    } catch (err) {
      console.error("CEP lookup failed", err);
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 8);
    setCep(value);
    if (value.length === 8) {
      await lookupCep(value);
    }
  };

  const discountAmount = total * (couponDiscount / 100);
  const deliveryFeeValue = (orderType === 'delivery' && !isFreeDeliveryCoupon) ? currentDeliveryFee : 0;
  const finalTotal = total - discountAmount + deliveryFeeValue + pendingTableTotal;

  const handleGetLocation = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCustomerLocation({ lat, lng });
        
        const addressData = await reverseGeocode(lat, lng, googleMapsKey);
        if (addressData) {
           // Define address with standard format (Street, Neighborhood, City - UF)
           setAddress(addressData.formattedAddress);
           
           // If we have a number, put it in the number field
           if (addressData.number) {
             setAddressNumber(addressData.number);
           } else {
             setAddressNumber(''); // Reset if google doesn't know the exact house number
           }

           // Update CEP if found
           if (addressData.cep) {
             setCep(addressData.cep.replace(/\D/g, ''));
           }

           // Calculate delivery fee with the new coordinates
           const baseLat = deliveryConfig?.baseLocation?.lat || storeConfig?.lat;
           const baseLng = deliveryConfig?.baseLocation?.lng || storeConfig?.lng;
           if (baseLat && baseLng) {
             const dist = getDistanceInMeters(lat, lng, baseLat, baseLng) / 1000;
             const fee = getDeliveryFeeCalculation(dist, deliveryConfig, total);
             setCurrentDeliveryFee(fee);
           }
        } else {
           alert("Não conseguimos identificar seu endereço exato. Por favor, digite manualmente.");
        }

        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          alert('GPS bloqueado pelo seu navegador.\n\nPara consertar, você precisaria ir nas "Configurações de Site" do seu navegador e reliberar o acesso.\n\nDICA RÁPIDA: Você não é obrigado a usar o GPS. Basta digitar o nome da sua rua ou CEP no campo de busca abaixo para calcularmos a entrega rapidinho!');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          alert('Sinal de GPS indisponível no momento. Tente chegar mais perto de uma janela.');
        } else {
          alert('Não foi possível obter sua localização. Verifique o GPS do aparelho.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleFinish = async () => {
    if (!paymentMethod) return;
    if (orderType === 'delivery' && (!address.trim() || !addressNumber.trim())) return;

    // Check identification
    if (!customerName || !whatsapp) {
      setShowIdentify(true);
      return;
    }

    setIsProcessing(true);
    
    try {
      // 1. If cart has items, place the new order
      if (cart.length > 0) {
        const feeToCharge = orderType === 'delivery' ? currentDeliveryFee : 0;
        await placeOrder(paymentMethod, feeToCharge);
      }

      // 2. If it's dine-in and payment is upfront (PIX/Credit/Debit), update existing pending orders
      if (orderType === 'dine-in' && tableNumber && ['pix', 'credit', 'debit'].includes(paymentMethod)) {
        const userPendingOrders = orders.filter(o => 
          o.tableNumber === tableNumber && 
          o.status !== 'finalizado' && 
          o.status !== 'cancelado' &&
          o.paymentStatus !== 'paid' &&
          (o.userId === deviceId || o.deviceId === deviceId)
        );
        
        for (const po of userPendingOrders) {
           await updateDoc(doc(db, 'orders', po.id), { 
             paymentStatus: 'paid', 
             paymentMethod,
             updatedAt: serverTimestamp() 
           });
        }
      }

      useStore.getState().clearCart();
      navigate('/status', { replace: true });
    } catch (e) {
      console.error("Checkout error:", e);
      alert("Não foi possível processar o pagamento. Verifique sua conexão.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-oat min-h-[calc(100vh-5rem)] flex flex-col pt-6 pb-40">
      <div className="px-5 flex-1 space-y-8 max-w-2xl mx-auto w-full">
        
        <h2 className="text-3xl font-display font-bold text-ink mb-2 tracking-tight">Quase lá!</h2>

        {/* Info Block */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${orderType === 'dine-in' ? 'bg-brand/10 text-brand' : 'bg-brand/10 text-brand'}`}>
                {orderType === 'dine-in' ? <Store className="w-6 h-6" strokeWidth={2.5} /> : <MapPin className="w-6 h-6" strokeWidth={2.5} />}
              </div>
              <div>
                <h2 className="font-display font-bold text-ink text-lg leading-tight">
                  {orderType === 'dine-in' ? 'Consumo no Local' : 'Delivery'}
                </h2>
                <p className="text-ink-muted text-sm font-medium">
                  {customerName}
                  {orderType === 'dine-in' && tableNumber && ` • Mesa ${tableNumber}`}
                </p>
              </div>
            </div>
            
            {orderType === 'delivery' && (
              <button 
                onClick={() => setIsScanning(true)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center border border-black/5 group-active:scale-95 transition-all">
                  <QrCode className="w-5 h-5 text-ink-muted group-hover:text-brand transition-colors" />
                </div>
                <span className="text-[9px] font-bold text-ink-muted uppercase tracking-tighter">Mesa?</span>
              </button>
            )}
          </div>

          {orderType === 'delivery' && (
            <div className="mt-5 pt-5 border-t border-black/5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider">Endereço de Entrega</label>
                <button 
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${customerLocation ? 'bg-emerald-100 text-emerald-700' : 'bg-brand/10 text-brand'}`}
                >
                  {isLocating ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-3 h-3 border border-brand/20 border-t-brand rounded-full" />
                  ) : (
                    <MapPin className="w-3 h-3" />
                  )}
                  {customerLocation ? 'Localização Ativada' : 'Usar Localização Atual'}
                </button>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input 
                    type="text"
                    value={cep}
                    onChange={handleCepChange}
                    maxLength={8}
                    placeholder="CEP (Somente números)"
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                  />
                  {isFetchingCep && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full"
                      />
                    </div>
                  )}
                </div>

                {googleMapsKey ? (
                  <div className="relative z-50">
                    <GooglePlacesAutocomplete
                      apiKey={googleMapsKey}
                      selectProps={{
                        value: address ? { label: address, value: address } : null,
                        onChange: async (val: any) => {
                          if (val && val.label) {
                            setAddress(val.label);
                            await handleGeocodeCustomerAddress(val.label, addressNumber);
                          }
                        },
                        onInputChange: (inputValue, { action }) => {
                          if (action === 'input-change') {
                            setAddress(inputValue);
                          }
                        },
                        onBlur: () => {
                          if (address) {
                            handleGeocodeCustomerAddress(address, addressNumber);
                          }
                        },
                        placeholder: "Buscar endereço...",
                        styles: {
                          control: (provided) => ({
                            ...provided,
                            backgroundColor: '#F5F2ED',
                            border: '2px solid transparent',
                            borderRadius: '1rem',
                            padding: '0.25rem',
                            boxShadow: 'none',
                            '&:hover': { border: '2px solid #FF4E00' }
                          }),
                          input: (provided) => ({ ...provided, fontFamily: 'Inter', fontWeight: '500' }),
                          placeholder: (provided) => ({ ...provided, color: '#8E9299', fontSize: '14px' }),
                          option: (provided, state) => ({
                            ...provided,
                            backgroundColor: state.isFocused ? '#FF4E00' : 'white',
                            color: state.isFocused ? 'white' : '#1C1917',
                            fontFamily: 'Inter',
                            fontSize: '14px'
                          })
                        }
                      }}
                    />
                  </div>
                ) : (
                  <input 
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => handleGeocodeCustomerAddress(address, addressNumber)}
                    placeholder="Nome da Rua / Logradouro"
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
                  <input 
                    type="text"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    onBlur={() => handleGeocodeCustomerAddress(address, addressNumber)}
                    placeholder="Número"
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                  />
                  <input 
                    type="text"
                    value={addressComplement}
                    onChange={(e) => setAddressComplement(e.target.value)}
                    placeholder="Compl. (Opcional)"
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                  />
                </div>
              </div>

              {customerLocation && !isOutOfRange && (
                <div className="mt-2 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  Garantimos que o entregador encontrará sua posição exata.
                </div>
              )}
              {isOutOfRange && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs font-medium text-red-700 bg-red-50 border border-red-100 px-4 py-3 rounded-xl flex items-start gap-2 shadow-sm"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p>
                    Infelizmente o seu endereço está fora da nossa área de entrega (máx {storeConfig?.deliveryRadiusKm || 5}km). 
                    Por favor, tente um endereço mais próximo ou no formato Retirada.
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>

        {/* Discount Coupon */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-brand/10 rounded-xl">
              <Percent className="w-5 h-5 text-brand" strokeWidth={2.5} />
            </div>
            <h2 className="font-display font-bold text-ink text-lg tracking-tight">Cupom de Desconto</h2>
          </div>
          
          <div className="flex gap-2">
            <input 
              placeholder="Digite o código..."
              className="flex-1 bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand text-sm font-bold uppercase placeholder:font-normal transition-all"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            <button 
              className="bg-ink text-white px-6 rounded-2xl font-display font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-md disabled:opacity-50"
              onClick={applyCoupon}
              disabled={isApplyingCoupon}
            >
              {isApplyingCoupon ? "..." : "Aplicar"}
            </button>
          </div>

          {couponDiscount > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-emerald-600">
                <Check className="w-4 h-4" strokeWidth={3} />
                <span className="text-xs font-bold uppercase tracking-wider">Cupom Ativado!</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-display font-bold text-ink">-{couponDiscount}%</span>
                <button 
                  onClick={removeCoupon}
                  className="text-[10px] font-black text-red-500 uppercase tracking-tighter"
                >
                  Remover
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Order Summary */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5">
          <h3 className="font-display font-bold text-ink text-lg mb-4">Resumo do Pedido</h3>
          
          <div className="space-y-4 mb-4">
            {cart.map((item) => (
              <div key={item.id} className="text-sm">
                <div className="flex justify-between text-ink">
                  <span className="font-medium">{item.quantity}x {item.item.name}</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((item.item.price + (item.selectedExtras || []).reduce((acc, e) => acc + e.price, 0)) * item.quantity)}</span>
                </div>
                {item.selectedExtras && item.selectedExtras.length > 0 && (
                  <p className="text-[10px] text-brand font-bold mt-0.5">
                    + {item.selectedExtras.map(e => e.name).join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-4 border-t border-black/5">
            <div className="flex justify-between text-sm text-ink-muted">
              <span>Subtotal</span>
              <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span>Desconto</span>
                <span>-{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountAmount)}</span>
              </div>
            )}
            {orderType === 'delivery' && (
              <div className="flex flex-col gap-1 py-1">
                <div className="flex justify-between text-sm text-ink-muted">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span>Taxa de Entrega</span>
                      {isGeocoding ? (
                        <span className="text-[10px] text-brand font-bold animate-pulse">Calculando frete...</span>
                      ) : customerLocation && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-md font-bold">
                          {((getDistanceInMeters(
                            customerLocation.lat, 
                            customerLocation.lng, 
                            deliveryConfig?.baseLocation?.lat || storeConfig?.lat || 0, 
                            deliveryConfig?.baseLocation?.lng || storeConfig?.lng || 0
                          ) || 0) / 1000).toFixed(1)} km
                        </span>
                      )}
                    </div>
                    {!(deliveryConfig?.baseLocation?.lat || storeConfig?.lat) && (
                      <span className="text-[9px] text-red-500 font-bold flex items-center gap-1 leading-tight max-w-[200px]">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        O app está sem a localização da loja! Ajuste no Admin.
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-ink">
                    {isGeocoding ? '---' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentDeliveryFee)}
                  </span>
                </div>
                {!isGeocoding && !customerLocation && address.trim() && (
                  <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Selecione o endereço sugerido para calcular o frete exato.
                  </p>
                )}
              </div>
            )}
            <div className="pt-3 border-t border-black/5 flex justify-between items-center">
              <span className="font-display font-bold text-ink">Total</span>
              <span className="text-xl font-display font-black text-ink">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div>
          <h2 className="font-display font-bold text-ink mb-4 px-1 text-lg tracking-tight">Forma de Pagamento</h2>
          <div className="space-y-4">
            
            {orderType === 'dine-in' && !requireUpfrontPayment && (
              <button 
                onClick={() => setPaymentMethod('na-entrega')}
                className={`w-full flex items-center p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${
                  paymentMethod === 'na-entrega' 
                  ? 'border-brand bg-brand/5 shadow-[0_8px_20px_-6px_rgba(255,78,0,0.15)]' 
                  : 'border-black/5 bg-white hover:border-black/10 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${paymentMethod === 'na-entrega' ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink border border-black/5'}`}>
                  <UtensilsCrossed className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-display font-bold text-ink text-base">Adicionar à Comanda</h3>
                  <p className="text-brand text-sm font-semibold tracking-wide">Pagar ao finalizar atendimento</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'na-entrega' ? 'border-brand bg-white' : 'border-black/10'}`}>
                  {paymentMethod === 'na-entrega' && <div className="w-3 h-3 bg-brand rounded-full" />}
                </div>
              </button>
            )}

            {storeConfig?.acceptedPaymentMethods?.pix !== false && (
              <button 
                onClick={() => setPaymentMethod('pix')}
                className={`w-full flex items-center p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${
                  paymentMethod === 'pix' 
                  ? 'border-brand bg-brand/5 shadow-[0_8px_20px_-6px_rgba(255,78,0,0.15)]' 
                  : 'border-black/5 bg-white hover:border-black/10 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${paymentMethod === 'pix' ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink border border-black/5'}`}>
                  <QrCode className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-display font-bold text-ink text-base">PIX</h3>
                  <p className="text-brand text-sm font-semibold tracking-wide">Aprovação imediata</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'pix' ? 'border-brand bg-white' : 'border-black/10'}`}>
                  {paymentMethod === 'pix' && <div className="w-3 h-3 bg-brand rounded-full" />}
                </div>
              </button>
            )}

            {storeConfig?.acceptedPaymentMethods?.credit !== false && (
              <button 
                onClick={() => setPaymentMethod('credit')}
                className={`w-full flex items-center p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${
                  paymentMethod === 'credit' 
                  ? 'border-brand bg-brand/5 shadow-[0_8px_20px_-6px_rgba(255,78,0,0.15)]' 
                  : 'border-black/5 bg-white hover:border-black/10 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${paymentMethod === 'credit' ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink border border-black/5'}`}>
                  <CreditCard className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-display font-bold text-ink text-base">Cartão de Crédito</h3>
                  <p className="text-emerald-600 text-sm font-semibold tracking-wide">Digital (Simulação)</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'credit' ? 'border-brand bg-white' : 'border-black/10'}`}>
                  {paymentMethod === 'credit' && <div className="w-3 h-3 bg-brand rounded-full" />}
                </div>
              </button>
            )}

            {storeConfig?.acceptedPaymentMethods?.debit !== false && (
              <button 
                onClick={() => setPaymentMethod('debit')}
                className={`w-full flex items-center p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${
                  paymentMethod === 'debit' 
                  ? 'border-brand bg-brand/5 shadow-[0_8px_20px_-6px_rgba(255,78,0,0.15)]' 
                  : 'border-black/5 bg-white hover:border-black/10 shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${paymentMethod === 'debit' ? 'bg-brand text-white shadow-md' : 'bg-oat text-ink border border-black/5'}`}>
                  <Smartphone className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-display font-bold text-ink text-base">Cartão de Débito</h3>
                  <p className="text-emerald-600 text-sm font-semibold tracking-wide">Digital (Simulação)</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'debit' ? 'border-brand bg-white' : 'border-black/10'}`}>
                  {paymentMethod === 'debit' && <div className="w-3 h-3 bg-brand rounded-full" />}
                </div>
              </button>
            )}

            {storeConfig?.acceptedPaymentMethods?.['na-entrega'] !== false && orderType !== 'dine-in' && (
              <button 
                onClick={() => {
                  if (requireUpfrontPayment) return;
                  setPaymentMethod('na-entrega');
                }}
                disabled={requireUpfrontPayment}
                className={`w-full flex items-center p-5 rounded-3xl border-2 transition-all active:scale-[0.98] ${
                  requireUpfrontPayment ? 'opacity-40 cursor-not-allowed bg-oat border-black/5' : 
                  paymentMethod === 'na-entrega' 
                  ? 'border-ink bg-ink text-white shadow-[0_8px_20px_-6px_rgba(28,25,23,0.3)]' 
                  : 'border-black/5 bg-white hover:border-black/10 text-ink shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${paymentMethod === 'na-entrega' ? 'bg-white/10 text-white' : 'bg-oat text-ink border border-black/5'}`}>
                  <Banknote className="w-6 h-6" strokeWidth={2.5} />
                </div>
                <div className="text-left flex-1">
                  <h3 className={`font-display font-bold text-base ${paymentMethod === 'na-entrega' ? 'text-white' : 'text-ink'}`}>
                    Pagar na Entrega
                  </h3>
                  <p className={`text-sm font-medium ${paymentMethod === 'na-entrega' ? 'text-white/70' : 'text-ink-muted'}`}>
                    {requireUpfrontPayment ? 'Indisponível (Valid. Endereço)' : 'Cartão ou Dinheiro'}
                  </p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${paymentMethod === 'na-entrega' ? 'border-white bg-transparent' : 'border-black/10'}`}>
                  {paymentMethod === 'na-entrega' && <div className="w-3 h-3 bg-white rounded-full" />}
                </div>
              </button>
            )}
          </div>
        </div>

      </div>

      <div className="fixed bottom-0 left-0 w-full p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,20px))] z-50 pointer-events-none">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <button 
            onClick={handleFinish}
            disabled={!paymentMethod || (orderType === 'delivery' && (!address.trim() || !addressNumber.trim())) || isProcessing || isOutOfRange || isGeocoding}
            className="w-full h-14 bg-brand disabled:bg-gray-300 disabled:text-gray-500 text-white font-display font-bold rounded-full active:scale-95 transition-all text-base flex items-center justify-center shadow-[0_20px_40px_-15px_rgba(255,78,0,0.5)] disabled:shadow-none tracking-wide"
          >
            {isProcessing || isGeocoding ? (
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
              />
            ) : (
              `${hasActiveTableOrder ? 'Adicionar à Comanda' : (orderType === 'dine-in' ? 'Confirmar Pedido' : 'Finalizar Pedido')} • ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(finalTotal)}`
            )}
          </button>
        </div>
      </div>

      <IdentifyModal 
        isOpen={showIdentify} 
        onClose={() => setShowIdentify(false)} 
        onConfirm={handleFinish} 
      />

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
              <h3 className="font-display font-bold text-white text-3xl tracking-tight mb-2">Escaneie o QR da Mesa</h3>
              <p className="text-white/70 text-sm font-medium">Aponte para o código da mesa para mudar para Consumo Local.</p>
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
