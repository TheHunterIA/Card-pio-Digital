import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useStore, Order } from '../../store';
import { Clock, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function OrderHistory() {
  const navigate = useNavigate();
  const deviceId = useStore(state => state.deviceId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('userId', '==', deviceId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate().toISOString() : new Date().toISOString()
      } as Order));
      setOrders(ordersData);
      setLoading(false);
    });
  }, [deviceId]);

  return (
    <div className="p-5 max-w-2xl mx-auto">
      <h2 className="text-2xl font-display font-bold text-ink mb-6">Histórico de Pedidos</h2>
      
      {loading ? (
        <div className="text-center text-ink-muted">Carregando...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-black/5">
          <p className="text-ink-muted font-medium">Nenhum pedido realizado ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div 
              key={order.id}
              onClick={() => {
                useStore.setState({ currentOrderId: order.id });
                navigate('/status');
              }}
              className="bg-white p-5 rounded-3xl shadow-sm border border-black/5 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer hover:border-brand/20"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-oat rounded-xl flex items-center justify-center text-ink">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-ink">Pedido #{order.id.substring(0, 4)}</h3>
                  <p className="text-xs text-ink-muted capitalize">
                    {new Date(order.createdAt).toLocaleDateString('pt-BR')} • {order.status}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-ink text-sm">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                </p>
                <ChevronRight className="w-5 h-5 text-ink-muted" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
