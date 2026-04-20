import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Settings as SettingsIcon, Save, MapPin, Map, RefreshCw, Percent, Trash2, X } from 'lucide-react';
import { motion } from 'motion/react';
import GooglePlacesAutocomplete, { geocodeByAddress, getLatLng } from 'react-google-places-autocomplete';
import { GoogleMap, useJsApiLoader, Circle, Marker } from '@react-google-maps/api';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Taxas de processamento
  const [pixFee, setPixFee] = useState<number>(0.99);
  const [creditFee, setCreditFee] = useState<number>(3.99);
  const [debitFee, setDebitFee] = useState<number>(1.99);
  const [deliveryFee, setDeliveryFee] = useState<number>(3.50);
  const [coupons, setCoupons] = useState<Record<string, { discount: number, limitPerUser: number }>>({});
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState('');
  const [newLimit, setNewLimit] = useState('');

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
          
          if (googleMapsKey) {
            try {
              const results = await geocodeByAddress(formattedAddress);
              const latLng = await getLatLng(results[0]);
              setLat(latLng.lat);
              setLng(latLng.lng);
            } catch (e) {
              console.error("Geocoding failed", e);
            }
          }
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
    if (newCode && newDiscount) {
      const updatedCoupons = { 
        ...coupons, 
        [newCode]: { 
          discount: Number(newDiscount), 
          limitPerUser: Number(newLimit) || 1 
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">CEP</label>
                <input 
                  type="text" 
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-mono transition-all text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-display font-bold text-ink-muted uppercase tracking-wider mb-2">Endereço da Loja</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={isFetchingCep ? "Buscando CEP..." : "Rua das Flores, Centro..."}
                    className="w-full bg-oat border-2 border-transparent rounded-2xl p-4 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 text-ink font-medium transition-all text-sm"
                    disabled={isFetchingCep}
                  />
                  {isFetchingCep && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
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

            {/* Coordinates Status block */}
            <div className={`mt-4 p-4 rounded-2xl border flex items-center gap-3 ${lat && lng ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-oat border-black/5 text-ink-muted'}`}>
              <Map className={`w-5 h-5 shrink-0 ${lat && lng ? 'text-emerald-500' : ''}`} />
              <div className="text-sm font-medium">
                {lat && lng ? (
                  <>
                    <span className="font-bold">Coordenadas capturadas:</span> Latitude {lat.toFixed(6)}, Longitude {lng.toFixed(6)}. O sistema anti-fraude está pronto para cálculos invisíveis.
                  </>
                ) : (
                  <>
                    <span className="font-bold">Aguardando Coordenadas:</span> Digite um CEP ou endereço válido para o sistema ancorar a loja no satélite.
                  </>
                )}
              </div>
            </div>

            {isLoaded && lat && lng && (
              <div className="mt-4 border-2 border-black/5 rounded-3xl overflow-hidden shadow-sm h-[400px]">
                <GoogleMap
                  mapContainerStyle={{ width: '100%', height: '100%' }}
                  center={{ lat, lng }}
                  zoom={deliveryRadiusKm > 0 ? (deliveryRadiusKm > 10 ? 11 : 13) : 15}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                  }}
                >
                  <Marker position={{ lat, lng }} />
                  
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
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 animate-pulse">Salva automaticamente ao adicionar/remover</p>
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
              Object.entries(coupons).map(([code, { discount, limitPerUser }]) => (
                <div key={code} className="flex justify-between items-center p-4 bg-white border border-black/5 rounded-2xl shadow-sm hover:border-brand/20 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand/5 rounded-xl flex items-center justify-center">
                      <Percent className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                      <span className="block font-display font-bold text-ink leading-tight">{code}</span>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{discount}% de desconto</span>
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
