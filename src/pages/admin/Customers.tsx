import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import { Search, Phone, Calendar, ShoppingBag, TrendingUp, UserCheck, UserMinus, UserPlus, Filter, Eye, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CustomerStats {
  name: string;
  whatsapp: string;
  orderCount: number;
  totalSpent: number;
  lastOrderDate: Date;
  favoriteItem: string;
  status: 'fiel' | 'ativo' | 'sumido';
  allOrders: any[];
}

export default function Customers() {
  const orders = useStore(state => state.orders);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | 'fiel' | 'ativo' | 'sumido'>('todos');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerStats | null>(null);

  const customers = useMemo(() => {
    const groups: Record<string, { orders: typeof orders, name: string }> = {};
    
    // Group orders by WhatsApp
    orders.forEach(order => {
      if (!order.whatsapp) return;
      if (!groups[order.whatsapp]) {
        groups[order.whatsapp] = { orders: [], name: order.customerName };
      }
      groups[order.whatsapp].orders.push(order);
    });

    // Compute stats
    return Object.entries(groups).map(([whatsapp, data]): CustomerStats => {
      const sortedOrders = [...data.orders].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      const lastOrder = sortedOrders[0];
      const lastDate = parseISO(lastOrder.createdAt);
      const daysSince = differenceInDays(new Date(), lastDate);
      
      // Calculate favorite item
      const itemCounts: Record<string, number> = {};
      data.orders.forEach(o => {
        o.items.forEach(i => {
          itemCounts[i.item.name] = (itemCounts[i.item.name] || 0) + i.quantity;
        });
      });
      
      const favoriteItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      const orderCount = data.orders.length;

      let status: CustomerStats['status'] = 'ativo';
      if (orderCount >= 5 && daysSince < 15) status = 'fiel';
      else if (daysSince >= 30) status = 'sumido';

      return {
        name: data.name,
        whatsapp,
        orderCount,
        totalSpent: data.orders.reduce((sum, o) => sum + o.total, 0),
        lastOrderDate: lastDate,
        favoriteItem,
        status,
        allOrders: sortedOrders
      };
    }).sort((a, b) => b.orderCount - a.orderCount);
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                           c.whatsapp.includes(search);
      const matchesFilter = filter === 'todos' || c.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [customers, search, filter]);

  const stats = useMemo(() => ({
    total: customers.length,
    fiel: customers.filter(c => c.status === 'fiel').length,
    sumido: customers.filter(c => c.status === 'sumido').length,
  }), [customers]);

  return (
    <>
      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      <header>
        <h2 className="text-3xl font-display font-bold text-ink tracking-tight mb-2 italic uppercase">CRM <span className="text-brand">BASE DE CLIENTES</span></h2>
        <p className="text-ink-muted font-medium">Gerencie sua base e entenda os hábitos de consumo dos seus clientes.</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-oat rounded-2xl flex items-center justify-center text-ink">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-display font-bold text-ink-muted uppercase tracking-widest">Total Base</p>
            <h4 className="text-2xl font-display font-black text-ink">{stats.total}</h4>
          </div>
        </div>
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-display font-bold text-emerald-600/60 uppercase tracking-widest">Clientes Fiéis</p>
            <h4 className="text-2xl font-display font-black text-emerald-600">{stats.fiel}</h4>
          </div>
        </div>
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500 rounded-2xl flex items-center justify-center text-white">
            <UserMinus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-display font-bold text-red-600/60 uppercase tracking-widest">Estão Sumidos</p>
            <h4 className="text-2xl font-display font-black text-red-600">{stats.sumido}</h4>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-muted group-focus-within:text-brand transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por nome ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border-2 border-black/5 rounded-2xl py-4 pl-12 pr-4 font-medium text-ink focus:outline-none focus:border-brand/40 focus:ring-4 focus:ring-brand/5 transition-all"
          />
        </div>
        <div className="flex gap-2">
          {(['todos', 'fiel', 'ativo', 'sumido'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-4 rounded-2xl font-display font-bold text-xs uppercase tracking-widest border-2 transition-all ${
                filter === f 
                ? 'bg-ink border-ink text-white shadow-md' 
                : 'bg-white border-black/5 text-ink-muted hover:border-black/10'
              }`}
            >
              {f === 'todos' ? 'Todos' : f === 'fiel' ? 'Fiéis' : f === 'ativo' ? 'Ativos' : 'Sumidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table / Mobile Cards */}
      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-oat/50 border-b border-black/5 font-display text-xs uppercase font-black text-ink-muted tracking-widest">
              <tr>
                <th className="text-left px-8 py-5">Cliente</th>
                <th className="text-left px-8 py-5">Frequência</th>
                <th className="text-left px-8 py-5">Preferência</th>
                <th className="text-left px-8 py-5">Último Pedido</th>
                <th className="text-right px-8 py-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredCustomers.map(c => (
                <tr key={c.whatsapp} className="hover:bg-oat/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand/10 text-brand rounded-2xl flex items-center justify-center font-display font-black text-lg">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <h5 className="font-display font-bold text-ink group-hover:text-brand transition-colors">{c.name}</h5>
                        <p className="text-xs text-ink-muted font-medium flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3" />
                          {c.whatsapp}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-ink font-bold text-sm">{c.orderCount} Pedidos</span>
                      <span className="text-[10px] font-display font-bold text-emerald-600 uppercase tracking-tight">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.totalSpent)} total
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm text-ink-muted font-medium italic">
                    <div className="flex items-center gap-2">
                       <ShoppingBag className="w-4 h-4 opacity-50" />
                       {c.favoriteItem}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2 text-ink text-sm font-medium">
                       <Calendar className="w-4 h-4 text-brand" />
                       {format(c.lastOrderDate, "dd 'de' MMM", { locale: ptBR })}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <span className={`inline-block px-4 py-2 rounded-xl font-display font-bold text-[10px] uppercase tracking-widest shadow-sm ${
                        c.status === 'fiel' ? 'bg-emerald-500 text-white' :
                        c.status === 'ativo' ? 'bg-ink text-white' :
                        'bg-red-50 text-red-600 border border-red-100'
                      }`}>
                        {c.status}
                      </span>
                      <button 
                        onClick={() => setSelectedCustomer(c)}
                        className="p-2 bg-oat rounded-xl text-ink-muted hover:text-brand hover:bg-brand/10 transition-all active:scale-95"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-black/5">
          {filteredCustomers.map(c => (
            <div 
              key={c.whatsapp} 
              className="p-6 space-y-4 active:bg-oat/50 transition-colors"
              onClick={() => setSelectedCustomer(c)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/10 text-brand rounded-xl flex items-center justify-center font-display font-black">
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <h5 className="font-display font-bold text-ink">{c.name}</h5>
                    <p className="text-xs text-ink-muted font-medium">{c.whatsapp}</p>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-lg font-display font-bold text-[8px] uppercase tracking-widest ${
                  c.status === 'fiel' ? 'bg-emerald-500 text-white' :
                  c.status === 'ativo' ? 'bg-ink text-white' :
                  'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {c.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-black/5">
                <div>
                  <p className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest mb-1">Frequência</p>
                  <p className="text-sm font-bold text-ink">{c.orderCount} Pedidos</p>
                </div>
                <div>
                  <p className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest mb-1">Preferência</p>
                  <p className="text-sm font-medium text-ink truncate italic">{c.favoriteItem}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredCustomers.length === 0 && (
          <div className="p-20 text-center text-ink-muted font-display font-bold">
            Nenhum cliente encontrado nessa filtragem.
          </div>
        )}
      </div>
    </div>

    {/* Detail Modal */}
    <AnimatePresence>
      {selectedCustomer && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedCustomer(null)}
            className="fixed inset-0 bg-ink/80 backdrop-blur-md z-[100]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-oat z-[101] shadow-2xl overflow-y-auto"
          >
            <div className="p-8 pb-32">
              <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setSelectedCustomer(null)}
                  className="p-3 bg-white rounded-2xl text-ink-muted hover:text-brand transition-all shadow-sm"
                >
                  <X className="w-6 h-6" />
                </button>
                <span className={`px-4 py-2 rounded-xl font-display font-bold text-[10px] uppercase tracking-widest ${
                  selectedCustomer.status === 'fiel' ? 'bg-emerald-500 text-white' :
                  selectedCustomer.status === 'ativo' ? 'bg-ink text-white' :
                  'bg-red-50 text-red-600 border border-red-100'
                }`}>
                  {selectedCustomer.status}
                </span>
              </div>

              <div className="flex items-center gap-6 mb-12">
                <div className="w-20 h-20 bg-brand text-white rounded-[32px] flex items-center justify-center font-display font-black text-3xl shadow-lg">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-3xl font-display font-bold text-ink tracking-tight mb-1">{selectedCustomer.name}</h3>
                  <p className="text-brand font-bold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {selectedCustomer.whatsapp}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-12">
                <div className="bg-white p-5 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest mb-1">Total Gasto</p>
                  <p className="text-2xl font-display font-black text-emerald-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedCustomer.totalSpent)}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-black/5">
                  <p className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest mb-1">Pedidos</p>
                  <p className="text-2xl font-display font-black text-ink">{selectedCustomer.orderCount}</p>
                </div>
              </div>

              <h4 className="font-display font-bold text-ink uppercase tracking-widest text-xs mb-6 flex items-center gap-3">
                Histórico de Pedidos
                <div className="flex-1 h-[1px] bg-black/5"></div>
              </h4>

              <div className="space-y-4">
                {selectedCustomer.allOrders.map((order, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-oat rounded-xl group-hover:bg-brand/10 transition-colors">
                          <ShoppingBag className="w-5 h-5 text-ink-muted group-hover:text-brand" />
                        </div>
                        <div>
                          <p className="text-xs font-display font-bold text-ink-muted uppercase tracking-widest">
                            {format(parseISO(order.createdAt), "dd 'de' MMMM", { locale: ptBR })}
                          </p>
                          <p className="text-[10px] text-ink-muted/60 font-medium font-mono uppercase">#{order.id}</p>
                        </div>
                      </div>
                      <p className="font-display font-bold text-ink">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                      </p>
                    </div>
                    
                    <div className="pl-12 space-y-2">
                       {order.items.map((item: any, i: number) => (
                         <div key={i} className="flex justify-between text-xs font-medium border-b border-black/5 pb-2 last:border-0 last:pb-0">
                            <span className="text-ink-muted">{item.quantity}x <span className="text-ink">{item.item.name}</span></span>
                            <span className="text-ink-muted/40 font-mono">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.item.price * item.quantity)}
                            </span>
                         </div>
                       ))}
                       {order.notes && (
                         <p className="text-[10px] bg-oat p-3 rounded-xl text-ink-muted italic border-l-4 border-brand/20">
                            "{order.notes}"
                         </p>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="absolute bottom-10 left-10 right-10">
               <a 
                 href={`https://wa.me/55${selectedCustomer.whatsapp.replace(/\D/g, '')}`} 
                 target="_blank" 
                 rel="noreferrer"
                 className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-display font-bold py-5 rounded-full shadow-lg flex items-center justify-center gap-3 active:scale-95 transition-all text-lg"
               >
                 <Phone className="w-6 h-6" />
                 Falar com Cliente no WhatsApp
               </a>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
