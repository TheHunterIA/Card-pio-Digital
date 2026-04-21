import React, { useState, useEffect } from 'react';
import { useStore, DeliveryRadius, PeakHourRule, DeliveryConfig } from '../../store';
import { updateDeliveryConfig, subscribeToDeliveryConfig } from '../../lib/database';
import { MapPin, Clock, Plus, Trash2, Save, RefreshCw, AlertCircle, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default function LogisticsSettings() {
  const deliveryConfig = useStore(state => state.deliveryConfig);
  const [localConfig, setLocalConfig] = useState<DeliveryConfig>({
    radii: [],
    peakHours: [],
    baseLocation: { lat: 0, lng: 0 }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const syncBaseLocation = async (silent = false) => {
    // Try to get base location from main config first
    if (!silent) setIsLoading(true);
    try {
      const configSnap = await getDoc(doc(db, 'settings', 'config'));
      if (configSnap.exists()) {
        const data = configSnap.data();
        if (data.lat && data.lng && data.lat !== 0) {
          setLocalConfig(prev => ({
            ...prev,
            baseLocation: { lat: data.lat, lng: data.lng }
          }));
          if (!silent) {
            alert('📍 Coordenadas sincronizadas do perfil da loja!');
          }
        } else if (!silent) {
          alert('⚠️ O perfil da loja não possui coordenadas válidas. Por favor, selecione seu endereço nas Configurações Gerais.');
        }
      }
    } catch (e) {
      console.error("Sync failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const unsub = subscribeToDeliveryConfig();
    return () => unsub();
  }, []);

  useEffect(() => {
    if (deliveryConfig) {
      setLocalConfig(deliveryConfig);
      setIsLoading(false);
      // If deliveryConfig exists but baseLocation is empty, try to sync from main config
      if (deliveryConfig.baseLocation?.lat === 0 || !deliveryConfig.baseLocation) {
        syncBaseLocation(true);
      }
    } else {
      syncBaseLocation(true);
    }
  }, [deliveryConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDeliveryConfig(localConfig);
      alert('Configurações de logística salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const addRadius = () => {
    const newRadius: DeliveryRadius = {
      id: Math.random().toString(36).substr(2, 9),
      maxDistance: 5,
      feePerKm: 2.5
    };
    setLocalConfig({
      ...localConfig,
      radii: [...localConfig.radii, newRadius].sort((a, b) => a.maxDistance - b.maxDistance)
    });
  };

  const removeRadius = (id: string) => {
    setLocalConfig({
      ...localConfig,
      radii: localConfig.radii.filter(r => r.id !== id)
    });
  };

  const updateRadius = (id: string, field: keyof DeliveryRadius, value: number) => {
    setLocalConfig({
      ...localConfig,
      radii: localConfig.radii.map(r => r.id === id ? { ...r, [field]: value } : r)
    });
  };

  const addPeakHour = () => {
    const newPeak: PeakHourRule = {
      id: Math.random().toString(36).substr(2, 9),
      dayOfWeek: 5, // Sexta
      startHour: '18:00',
      endHour: '23:59',
      feeMultiplier: 1.5
    };
    setLocalConfig({
      ...localConfig,
      peakHours: [...localConfig.peakHours, newPeak]
    });
  };

  const removePeakHour = (id: string) => {
    setLocalConfig({
      ...localConfig,
      peakHours: localConfig.peakHours.filter(p => p.id !== id)
    });
  };

  const updatePeakHour = (id: string, field: keyof PeakHourRule, value: any) => {
    setLocalConfig({
      ...localConfig,
      peakHours: localConfig.peakHours.map(p => p.id === id ? { ...p, [field]: value } : p)
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-oat">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full bg-oat pb-32">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink tracking-tight flex items-center gap-3">
             <TrendingUp className="w-8 h-8 text-brand" />
             Logística de Entrega
          </h2>
          <p className="text-ink-muted font-medium mt-1">Defina taxas por distância e horários de pico dinâmicos.</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-brand text-white px-8 py-4 rounded-2xl font-display font-bold uppercase tracking-widest text-xs hover:bg-brand-dark transition-all flex items-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Logística
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Base Location Info */}
        <div className="lg:col-span-2 bg-white border border-black/5 rounded-[32px] p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
           <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${localConfig.baseLocation.lat !== 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-oat text-ink-muted'}`}>
                 <MapPin className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs font-bold text-ink-muted uppercase">Ponto de Partida</p>
                 <div className="flex flex-col">
                   <p className="text-sm font-bold text-ink">
                      {localConfig.baseLocation.lat !== 0 
                        ? `${localConfig.baseLocation.lat.toFixed(6)}, ${localConfig.baseLocation.lng.toFixed(6)}` 
                        : 'Coordenadas não vinculadas'}
                   </p>
                   {localConfig.baseLocation.lat === 0 && (
                     <p className="text-[10px] text-ink-muted leading-tight mt-1 max-w-[200px]">
                       Para frete por Km, selecione seu endereço nas <strong>Configurações Gerais</strong>.
                     </p>
                   )}
                 </div>
              </div>
           </div>
           
           <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
             <div className="flex items-center gap-3 bg-oat rounded-2xl px-4 py-2 border border-black/5 w-full sm:w-auto">
               <div className="text-left">
                 <p className="text-[9px] font-bold text-ink-muted uppercase">Frete grátis apartir de (R$)</p>
                 <input 
                   type="number"
                   value={localConfig.freeDeliveryThreshold || ''}
                   onChange={e => setLocalConfig({...localConfig, freeDeliveryThreshold: parseFloat(e.target.value) || 0})}
                   placeholder="Ex: 100"
                   className="bg-transparent border-none focus:ring-0 text-sm font-bold text-brand p-0 w-24"
                 />
               </div>
             </div>
             <button 
               onClick={() => syncBaseLocation(false)}
               className="px-4 py-2 bg-oat border border-black/5 rounded-xl text-xs font-bold text-ink-muted hover:bg-black/5 hover:text-ink transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
             >
               <RefreshCw className="w-3 h-3" />
               Atualizar do Perfil da Loja
             </button>
           </div>
        </div>

        {/* Distance Ranges */}
        <section className="space-y-6">
          <div className="bg-white border border-black/5 rounded-[32px] p-8 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand" />
                Taxas por Raio (Distance)
              </h3>
              <button 
                onClick={addRadius}
                className="p-2 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {localConfig.radii.length === 0 ? (
                <div className="text-center py-12 bg-oat/50 rounded-3xl border border-dashed border-black/10">
                  <p className="text-sm text-ink-muted font-medium">Nenhum raio configurado.<br/>Clique no + para começar.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {localConfig.radii.map((radius, idx) => (
                    <motion.div 
                      key={radius.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-oat/50 p-4 rounded-3xl border border-black/5 flex items-center gap-4 group"
                    >
                      <div className="w-10 h-10 bg-brand text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ink-muted uppercase">Até (Km)</label>
                          <input 
                            type="number"
                            value={radius.maxDistance}
                            onChange={(e) => updateRadius(radius.id, 'maxDistance', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-brand"
                            step="0.5"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-ink-muted uppercase">R$ p/ Km</label>
                          <input 
                            type="number"
                            value={radius.feePerKm}
                            onChange={(e) => updateRadius(radius.id, 'feePerKm', parseFloat(e.target.value) || 0)}
                            className="w-full bg-white border border-black/5 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-brand"
                            step="0.1"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => removeRadius(radius.id)}
                        className="p-2 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            
            <div className="mt-6 flex items-start gap-2 p-4 bg-brand/5 rounded-2xl">
              <AlertCircle className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand-dark font-medium leading-relaxed">
                O sistema calculará a distância em linha reta (Haversine) do endereço da loja até o cliente. 
                Será aplicado o <strong>valor por Km</strong> da faixa correspondente multiplicado pela distância total.
              </p>
            </div>
          </div>
        </section>

        {/* Peak Hours */}
        <section className="space-y-6">
          <div className="bg-white border border-black/5 rounded-[32px] p-8 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-ink flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand" />
                Horários de Pico (Multiplicador)
              </h3>
              <button 
                onClick={addPeakHour}
                className="p-2 bg-brand/5 text-brand rounded-xl hover:bg-brand hover:text-white transition-all shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {localConfig.peakHours.length === 0 ? (
                <div className="text-center py-12 bg-oat/50 rounded-3xl border border-dashed border-black/10">
                  <p className="text-sm text-ink-muted font-medium">Sem regras de pico.<br/>Preço fixo por distância o tempo todo.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {localConfig.peakHours.map((peak) => (
                    <motion.div 
                      key={peak.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-oat/50 p-4 rounded-3xl border border-black/5 space-y-3 group"
                    >
                      <div className="flex justify-between items-center">
                        <select 
                          value={peak.dayOfWeek}
                          onChange={(e) => updatePeakHour(peak.id, 'dayOfWeek', parseInt(e.target.value))}
                          className="bg-white border border-black/5 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                        >
                          {DAYS.map((day, d) => <option key={d} value={d}>{day}</option>)}
                        </select>
                        <button 
                          onClick={() => removePeakHour(peak.id)}
                          className="p-1.5 text-ink-muted opacity-0 group-hover:opacity-100 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-ink-muted uppercase">Início</label>
                          <input 
                            type="time"
                            value={peak.startHour}
                            onChange={(e) => updatePeakHour(peak.id, 'startHour', e.target.value)}
                            className="w-full bg-white border border-black/5 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-ink-muted uppercase">Fim</label>
                          <input 
                            type="time"
                            value={peak.endHour}
                            onChange={(e) => updatePeakHour(peak.id, 'endHour', e.target.value)}
                            className="w-full bg-white border border-black/5 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-ink-muted uppercase">Multiplicador</label>
                          <div className="relative">
                            <input 
                              type="number"
                              value={peak.feeMultiplier}
                              onChange={(e) => updatePeakHour(peak.id, 'feeMultiplier', parseFloat(e.target.value) || 1)}
                              className="w-full bg-white border border-black/5 rounded-xl px-2 py-2 text-xs font-bold focus:outline-none"
                              step="0.1"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink-muted font-bold">x</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="mt-6 flex items-start gap-2 p-4 bg-brand/5 rounded-2xl">
              <TrendingUp className="w-4 h-4 text-brand shrink-0 mt-0.5" />
              <p className="text-[10px] text-brand-dark font-medium leading-relaxed">
                Se a hora atual coincidir com uma regra de pico, a taxa de distância será multiplicada pelo valor definido (ex: 1.5 = +50%). 
                Evite sobrepor horários para o mesmo dia.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
