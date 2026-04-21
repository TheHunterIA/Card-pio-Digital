import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Settings as SettingsIcon, Save, MapPin, Map, RefreshCw, Percent, Trash2, X, Bike, AlertTriangle, Search } from 'lucide-react';
import { motion } from 'motion/react';
import GooglePlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-google-places-autocomplete';
import { GoogleMap, useJsApiLoader, Circle, Marker } from '@react-google-maps/api';
import { geocodeAddressFallback } from '../../lib/utils';

export default function Settings() {
  const [cep, setCep] = useState('');
  const [address, setAddress] = useState('');
  const [number, setNumber] = useState('');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState<number>(5);
  const [deliveryGeoEnabled, setDeliveryGeoEnabled] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Taxas de processamento
  const [pixFee, setPixFee] = useState<number>(0.99);
  const [creditFee, setCreditFee] = useState<number>(3.99);
  const [debitFee, setDebitFee] = useState<number>(1.99);
  const [deliveryFee, setDeliveryFee] = useState<number>(3.50);
  const [coupons, setCoupons] = useState<Record<string, { discount: number, limitPerUser: number, type?: 'percentage' | 'free_delivery' }>>({});
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newCouponType, setNewCouponType] = useState<'percentage' | 'free_delivery'>('percentage');

  // @ts-ignore
  const googleMapsKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsKey || '',
  });

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'config'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCep(data.cep || '');
          setAddress(data.address || '');
          setNumber(data.number || '');
          setRadiusMeters(data.radiusMeters || 200);
          setGeoEnabled(data.geoEnabled || false);
          setDeliveryRadiusKm(data.deliveryRadiusKm || 5);
          setDeliveryGeoEnabled(data.deliveryGeoEnabled || false);
          setLat(data.lat || null);
          setLng(data.lng || null);
          setPixFee(data.pixFee ?? 0.99);
          setCreditFee(data.creditFee ?? 3.99);
          setDebitFee(data.debitFee ?? 1.99);
          setDeliveryFee(data.deliveryFee ?? 3.50);
          setCoupons(data.coupons || {});
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleGeocodeAddress = async (fullAddress: string, shopNumber: string) => {
    if (!fullAddress) return;
    
    setIsFetchingLocation(true);
    try {
      const query = shopNumber ? `${fullAddress}, ${shopNumber}` : fullAddress;
      
      // Try with robust fallback (Google REST -> Nominatim Free)
      let coords = await geocodeAddressFallback(query, googleMapsKey);
      
      if (!coords && shopNumber) {
         // Fallback to street only if number fails
         coords = await geocodeAddressFallback(fullAddress, googleMapsKey);
         if (coords) {
             alert('📍 O número exato da loja não foi encontrado. O mapa foi centralizado na rua. Por favor, ajuste o pino clicando no local exato do estabelecimento.');
         }
      }

      if (coords) {
         setLat(coords.lat);
         setLng(coords.lng);
      } else {
         alert('⚠️ Não conseguimos encontrar este endereço em nenhum provedor de mapas (Google/OSM).');
      }
    } catch (e) {
      console.error("Geocoding failed entirely", e);
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '').substring(0, 8);
    setCep(value);

    if (value.length === 8) {
      setIsFetchingCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          const formattedAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}`;
          setAddress(formattedAddress);
          await handleGeocodeAddress(formattedAddress, number);
        }
      } catch (err) {
        console.error('ViaCEP Error:', err);
      } finally {
        setIsFetchingCep(false);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const configRef = doc(db, 'settings', 'config');
      await setDoc(configRef, {
        cep,
        address,
        number,
        radiusMeters,
        geoEnabled,
        deliveryRadiusKm,
        deliveryGeoEnabled,
        lat,
        lng,
        pixFee,
        creditFee,
        debitFee,
        deliveryFee,
        coupons,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error('Error saving config:', err);
      if (err.code === 'permission-denied') {
        alert('Erro de permissão: Verifique se você é o administrador autorizado.');
      } else {
        alert('Erro ao salvar as configurações: ' + (err.message || 'Erro desconhecido'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCoupon = async () => {
    if (newCode && (newCouponType === 'free_delivery' || newDiscount)) {
      const updatedCoupons = { 
        ...coupons, 
        [newCode]: { 
          discount: newCouponType === 'percentage' ? Number(newDiscount) : 0, 
          limitPerUser: Number(newLimit) || 1,
          type: newCouponType
        } 
      };
      setCoupons(updatedCoupons);
      setNewCode('');
      setNewDiscount('');
      setNewLimit('');
      
      // Immediate database sync for coupons list
      try {
        await setDoc(doc(db, 'settings', 'config'), { 
          coupons: updatedCoupons 
        }, { merge: true });
      } catch (err) {
        console.error("Failed to auto-save coupon:", err);
      }
    }
  };

  const handleRemoveCoupon = async (code: string) => {
    const newCoupons = { ...coupons };
    delete newCoupons[code];
    setCoupons(newCoupons);
    
    // Immediate database sync for coupons list
    try {
      await setDoc(doc(db, 'settings', 'config'), { 
        coupons: newCoupons 
      }, { merge: true });
    } catch (err) {
      console.error("Failed to auto-delete coupon:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto w-full">
      <div className="mb-8 pb-6 border-b border-black/5 flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink tracking-tight flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-brand" strokeWidth={2.5} />
            Configurações
          </h2>
          <p className="text-ink-muted font-medium mt-1">Configure as defesas e endereço da sua loja.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-brand text-white px-6 py-3 rounded-2xl font-display font-bold uppercase tracking-widest text-[10px] hover:bg-brand-dark transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </button>
      </div>

      <div className="space-y-6">
        {/* Module: Payment Fees */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2 mb-6">
            <Percent className="w-5 h-5 text-brand" />
            Configuração de Taxas (Cálculo Líquido)
          </h3>
          <p className="text-ink-muted text-sm mb-6 max-w-lg">
            Defina as taxas para que os relatórios financeiros mostrem o valor real que cairá na sua conta.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider">Taxa PIX (%)</label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  value={pixFee}
                  onChange={(e) => setPixFee(Number(e.target.value))}
                  placeholder="Ex: 0.99"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-bold transition-all text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">%</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider">Taxa Cartão Crédito (%)</label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  value={creditFee}
                  onChange={(e) => setCreditFee(Number(e.target.value))}
                  placeholder="Ex: 3.99"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-bold transition-all text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">%</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider">Taxa Cartão Débito (%)</label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  value={debitFee}
                  onChange={(e) => setDebitFee(Number(e.target.value))}
                  placeholder="Ex: 1.99"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-bold transition-all text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">%</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider">Taxa Entrega / Maquininha (%)</label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(Number(e.target.value))}
                  placeholder="Ex: 3.50"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-bold transition-all text-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted font-bold">%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Module: Geo Location */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                Trava de Geolocalização (Mesas)
              </h3>
              <p className="text-ink-muted text-sm mt-1 max-w-lg">
                Se ativado, clientes que escanearem o QR Code fora do raio estabelecido não poderão abrir conta no salão sem pagar imediatamente no PIX.
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={geoEnabled}
                onChange={(e) => setGeoEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-oat border border-black/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500"></div>
            </label>
          </div>

          <div className="flex items-start justify-between mb-6 pt-6 border-t border-black/5">
            <div>
              <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                Raio de Entrega (Delivery)
              </h3>
              <p className="text-ink-muted text-sm mt-1 max-w-lg">
                Se ativado, bloqueia pedidos de delivery cujo endereço esteja além da distância máxima permitida pela loja.
              </p>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer mt-1 shrink-0">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={deliveryGeoEnabled}
                onChange={(e) => setDeliveryGeoEnabled(e.target.checked)}
              />
              <div className="w-11 h-6 bg-oat border border-black/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:border-emerald-500"></div>
            </label>
          </div>

          <div className="space-y-4 pt-6 border-t border-black/5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">CEP</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-mono transition-all text-sm"
                  />
                  {isFetchingCep && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">Número</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    onBlur={() => handleGeocodeAddress(address, number)}
                    placeholder="Ex: 123"
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                  />
                  {isFetchingLocation && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">Endereço / Logradouro</label>
                <div className="relative z-50">
                  {googleMapsKey ? (
                    <GooglePlacesAutocomplete
                      apiKey={googleMapsKey}
                      selectProps={{
                        value: address ? { label: address, value: address } : null,
                        onChange: async (val: any) => {
                          if (val && val.label) {
                            setAddress(val.label);
                            await handleGeocodeAddress(val.label, number);
                          }
                        },
                        onInputChange: (inputValue, { action }) => {
                          if (action === 'input-change') {
                            setAddress(inputValue);
                          }
                        },
                        placeholder: "Buscar endereço da loja...",
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
                  ) : (
                    <div className="relative">
                      <input 
                        type="text" 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Nome da Rua / Logradouro"
                        className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                      />
                    </div>
                  )}
                </div>
                {address && (!lat || !lng) && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3"
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-red-900 leading-tight">Coordenadas não capturadas!</p>
                      <p className="text-[10px] text-red-700 leading-tight mt-0.5">O endereço foi digitado mas o GPS não o reconheceu. <strong>Selecione o endereço na lista de sugestões</strong> ou clique em 'Usar Meu GPS Atual'.</p>
                    </div>
                  </motion.div>
                )}
                
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.geolocation) {
                        setIsFetchingLocation(true);
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setLat(pos.coords.latitude);
                            setLng(pos.coords.longitude);
                            setIsFetchingLocation(false);
                            alert('📍 Localização (Lat/Lng) preenchida com sucesso pelo GPS! Lembre-se de clicar em "Salvar".');
                          },
                          (err) => {
                            setIsFetchingLocation(false);
                            alert('Erro ao buscar GPS: ' + err.message + '. Por favor, autorize o uso de localização no seu navegador.');
                          },
                          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                        );
                      } else {
                        alert('Seu navegador não suporta GPS.');
                      }
                    }}
                    className="flex-1 w-full bg-black text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-black/80 transition-colors active:scale-95"
                  >
                    <MapPin className="w-4 h-4" />
                    Extrair pelo GPS do Aparelho
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleGeocodeAddress(address, number)}
                    disabled={!address || isFetchingLocation}
                    className="flex-1 w-full bg-brand text-white text-xs font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-brand-dark transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isFetchingLocation ? (
                       <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                       <Search className="w-4 h-4" />
                    )}
                    Forçar Busca pelo Endereço
                  </button>
                </div>
                
                <p className="text-[10px] text-ink-muted px-1 mt-2">Ao preencher o endereço ou CEP, o sistema tenta capturar automaticamente a localização. Se falhar, use o GPS ou a busca forçada acima.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">Raio de Tolerância Local (Metros)</label>
                <input 
                  type="number" 
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  placeholder="Ex: 200"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                />
                <p className="text-[10px] text-ink-muted mt-2 font-medium">Distância máx. para o cliente ler o QR na mesa.</p>
              </div>
              
              <div>
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">Raio de Entrega (Km)</label>
                <input 
                  type="number" 
                  value={deliveryRadiusKm}
                  onChange={(e) => setDeliveryRadiusKm(Number(e.target.value))}
                  placeholder="Ex: 5"
                  step="0.5"
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                />
                <p className="text-[10px] text-ink-muted mt-2 font-medium">Distância máx. permitida para pedidos delivery.</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-2">
              <button 
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setLat(pos.coords.latitude);
                      setLng(pos.coords.longitude);
                      alert('Coordenadas capturadas da sua posição atual!');
                    }, (err) => {
                      console.error(err);
                      alert('Não foi possível obter sua localização. Verifique as permissões do navegador.');
                    });
                  }
                }}
                className="text-[10px] font-bold text-brand uppercase tracking-widest bg-brand/5 px-4 py-2 rounded-xl hover:bg-brand/10 transition-all flex items-center gap-2"
              >
                <MapPin className="w-3 h-3" /> Usar minha localização atual
              </button>
              
              <p className="text-[9px] text-ink-muted font-bold uppercase italic">
                Você também pode clicar no mapa para ajustar o pino
              </p>
            </div>

            {/* Coordinates Status block */}
            <div className={`mt-4 p-4 rounded-2xl border flex items-center gap-3 ${lat && lng ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <Map className={`w-5 h-5 shrink-0 ${lat && lng ? 'text-emerald-500' : 'text-red-500'}`} />
              <div className="text-sm font-medium">
                {lat && lng ? (
                  <>
                    <span className="font-bold">Coordenadas capturadas:</span> Latitude {lat.toFixed(6)}, Longitude {lng.toFixed(6)}. O sistema anti-fraude está pronto para cálculos invisíveis.
                  </>
                ) : (
                  <>
                    <span className="font-bold">Sem Coordenadas GPS!</span> O app usará o mapa interativo abaixo. Navegue, dê zoom e <strong>clique no local da sua loja</strong> para fixar o pino 📍.
                  </>
                )}
              </div>
            </div>

            {isLoaded && (
              <div className="mt-4 border-2 border-black/10 rounded-3xl overflow-hidden shadow-sm h-[450px] relative">
                {!lat && !lng && (
                  <div className="absolute inset-0 z-10 pointer-events-none flex items-start justify-center p-4">
                    <div className="bg-ink text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 animate-bounce">
                      <MapPin className="w-4 h-4 text-brand" />
                      Clique no mapa para marcar a loja!
                    </div>
                  </div>
                )}
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={lat && lng ? { lat, lng } : { lat: -23.5505, lng: -46.6333 }} // Fallback to SP, Brazil if empty
                  zoom={lat && lng ? (deliveryRadiusKm > 0 ? (deliveryRadiusKm > 10 ? 11 : 13) : 15) : 5}
                  onClick={(e) => {
                    if (e.latLng) {
                      setLat(e.latLng.lat());
                      setLng(e.latLng.lng());
                    }
                  }}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  {lat !== 0 && lng !== 0 && <Marker position={{ lat, lng }} />}
                  
                  {/* Raio Delivery (Brand) */}
                  {deliveryGeoEnabled && (
                    <Circle 
                      center={{ lat, lng }}
                      radius={deliveryRadiusKm * 1000}
                      options={{
                        fillColor: '#FF4E00',
                        fillOpacity: 0.1,
                        strokeColor: '#FF4E00',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                      }}
                    />
                  )}
                  
                  {/* Raio Local Tables (Verde) */}
                  {geoEnabled && (
                    <Circle 
                      center={{ lat, lng }}
                      radius={radiusMeters}
                      options={{
                        fillColor: '#10B981',
                        fillOpacity: 0.3,
                        strokeColor: '#10B981',
                        strokeOpacity: 1,
                        strokeWeight: 2,
                      }}
                    />
                  )}
                </GoogleMap>
              </div>
            )}

          </div>
        </div>

        {/* Module: Coupons */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm overflow-hidden relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2">
              <Percent className="w-5 h-5 text-brand" />
              Cupons de Desconto
            </h3>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">Salva automaticamente</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mb-8 bg-oat p-4 rounded-2xl border border-black/5">
            <div className="flex-1 space-y-1">
              <label className="block text-[10px] font-display font-bold text-ink-muted uppercase tracking-wider ml-1">Código</label>
              <input 
                placeholder="Ex: DESC10"
                className="w-full bg-white border-2 border-transparent rounded-xl px-4 py-3 focus:outline-none focus:border-brand text-sm font-bold uppercase placeholder:font-normal"
                value={newCode}
                onChange={e => setNewCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              />
            </div>
            <div className="w-full sm:w-40 space-y-1">
              <label className="block text-[10px] font-display font-bold text-ink-muted uppercase tracking-wider ml-1">Tipo</label>
              <select 
                value={newCouponType}
                onChange={e => setNewCouponType(e.target.value as any)}
                className="w-full bg-white border-2 border-transparent rounded-xl px-4 py-3 focus:outline-none focus:border-brand text-sm font-bold"
              >
                <option value="percentage">Desconto %</option>
                <option value="free_delivery">Frete Grátis</option>
              </select>
            </div>
            {newCouponType === 'percentage' && (
              <div className="w-full sm:w-32 space-y-1">
                <label className="block text-[10px] font-display font-bold text-ink-muted uppercase tracking-wider ml-1">Desconto</label>
                <div className="relative">
                  <input 
                    type="number"
                    placeholder="0"
                    className="w-full bg-white border-2 border-transparent rounded-xl px-4 py-3 focus:outline-none focus:border-brand text-sm font-bold"
                    value={newDiscount}
                    onChange={e => setNewDiscount(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted font-bold text-xs">%</span>
                </div>
              </div>
            )}
            <div className="w-full sm:w-32 space-y-1">
              <label className="block text-[10px] font-display font-bold text-ink-muted uppercase tracking-wider ml-1">Limite Cliente</label>
              <input 
                type="number"
                placeholder="1"
                className="w-full bg-white border-2 border-transparent rounded-xl px-4 py-3 focus:outline-none focus:border-brand text-sm font-bold"
                value={newLimit}
                onChange={e => setNewLimit(e.target.value)}
              />
            </div>
            <button 
              className="sm:self-end h-[46px] bg-ink text-white px-6 rounded-xl font-display font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-all shadow-md active:scale-95"
              onClick={handleAddCoupon}
            >
              Adicionar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(coupons).length > 0 ? (
              Object.entries(coupons).map(([code, { discount, limitPerUser, type }]) => (
                <div key={code} className="flex justify-between items-center p-4 bg-white border border-black/5 rounded-2xl shadow-sm hover:border-brand/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand/5 rounded-xl flex items-center justify-center text-brand">
                      {type === 'free_delivery' ? <Bike className="w-5 h-5" /> : <Percent className="w-5 h-5" />}
                    </div>
                    <div>
                      <span className="block font-display font-bold text-ink leading-tight">{code}</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                        {type === 'free_delivery' ? 'Frete Grátis' : `${discount}% de desconto`}
                      </span>
                      <span className="block text-[10px] font-bold text-ink-muted uppercase tracking-wider">Limite: {limitPerUser}x por cliente</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveCoupon(code)} 
                    className="p-2 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center bg-oat rounded-2xl border border-dashed border-black/10">
                <Percent className="w-8 h-8 text-black/10 mx-auto mb-2" />
                <p className="text-sm font-medium text-ink-muted">Nenhum cupom ativo no momento.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
