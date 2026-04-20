import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Order } from '../../store';
import MapaUrbanPrime from '../../components/shared/MapaUrbanPrime';
import { Motorbike, MapPin, X } from 'lucide-react';

export default function FleetMap() {
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', '==', 'em-rota')
    );

    return onSnapshot(q, (snapshot) => {
      const deliveries = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .filter(order => order.driverLocation);
      setActiveDeliveries(deliveries);
    });
  }, []);

  return (
    <div className="h-screen flex flex-col bg-oat">
      <header className="p-6 bg-white border-b border-black/5 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-display font-bold text-ink">Frota em Tempo Real</h2>
          <p className="text-sm text-ink-muted">{activeDeliveries.length} entregadores em rota</p>
        </div>
      </header>
      
      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
        {activeDeliveries.map(delivery => (
          <div key={delivery.id} className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-ink-muted">Pedido #{delivery.id.substring(0,6)}</p>
                    <p className="text-sm font-bold text-ink">{delivery.driverName || 'Entregador'}</p>
                </div>
                <Motorbike className="w-6 h-6 text-brand" />
            </div>
            
            <MapaUrbanPrime 
               driverCoords={delivery.driverLocation && typeof delivery.driverLocation.lat === 'number' && typeof delivery.driverLocation.lng === 'number' ? delivery.driverLocation : undefined}
               customerCoords={delivery.customerLocation}
               height="200px"                
               className="w-full"
            />
          </div>
        ))}
        {activeDeliveries.length === 0 && (
          <div className="col-span-full py-20 text-center text-ink-muted">Nenhum entregador em rota no momento.</div>
        )}
      </div>
    </div>
  );
}
