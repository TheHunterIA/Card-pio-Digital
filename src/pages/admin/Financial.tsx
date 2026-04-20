import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../../store';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'motion/react';
import { 
  TrendingUp, DollarSign, ShoppingBag, Users, Calendar, 
  ArrowUpRight, ArrowDownRight, Coffee, Pizza, Beer, Package, ChevronDown, AlertCircle,
  CreditCard, Smartphone, Banknote, ShieldCheck, QrCode
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, isWithinInterval, parseISO, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'today' | 'yesterday' | '7days' | '30days' | 'month';

export default function Financial() {
  const [period, setPeriod] = useState<Period>('7days');
  const [pixFee, setPixFee] = useState<number>(0.99);
  const [creditFee, setCreditFee] = useState<number>(3.99);
  const [debitFee, setDebitFee] = useState<number>(1.99);
  const [deliveryFee, setDeliveryFee] = useState<number>(3.50);
  const orders = useStore(state => state.orders);

  useEffect(() => {
    const loadFees = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'config'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.pixFee !== undefined) setPixFee(data.pixFee);
          if (data.creditFee !== undefined) setCreditFee(data.creditFee);
          if (data.debitFee !== undefined) setDebitFee(data.debitFee);
          if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
        }
      } catch (e) {
        console.error("Error loading fees for financial report", e);
      }
    };
    loadFees();
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case '30days':
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    }
  }, [period]);

  const finishedOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = parseISO(o.createdAt);
      return isAfter(orderDate, dateRange.start) && isBefore(orderDate, dateRange.end);
    });
  }, [orders, dateRange]);

  const stats = useMemo(() => {
    const finishedFiltered = finishedOrders.filter(o => o.status === 'finalizado');
    const totalRevenue = finishedFiltered.reduce((acc, o) => acc + (o.total || 0), 0);
    
    // Audit Portaria: Compare all table orders with those that actually cleared the gate
    const sessionOrders = finishedOrders.filter(o => o.type === 'dine-in');
    const gatedOrders = sessionOrders.filter(o => o.status === 'finalizado');
    const pendingGate = sessionOrders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado');

    // Split by method
    const pixOrders = finishedFiltered.filter(o => o.paymentMethod === 'pix');
    const creditOrders = finishedOrders.filter(o => o.paymentMethod === 'credit');
    const debitOrders = finishedOrders.filter(o => o.paymentMethod === 'debit');
    const deliveryOrders = finishedOrders.filter(o => !['pix', 'credit', 'debit'].includes(o.paymentMethod || ''));

    const pixGross = pixOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const creditGross = creditOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const debitGross = debitOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const deliveryGross = deliveryOrders.reduce((acc, o) => acc + (o.total || 0), 0);

    const pixFees = pixGross * (pixFee / 100);
    const creditFees = creditGross * (creditFee / 100);
    const debitFees = debitGross * (debitFee / 100);
    const deliveryFees = deliveryGross * (deliveryFee / 100);
    
    const totalFees = pixFees + creditFees + debitFees + deliveryFees;

    const pixNet = pixGross - pixFees;
    const creditNet = creditGross - creditFees;
    const debitNet = debitGross - debitFees;
    const deliveryNet = deliveryGross - deliveryFees;
    const totalNet = totalRevenue - totalFees;
    
    const avgTicket = finishedOrders.length > 0 ? totalRevenue / finishedOrders.length : 0;
    
    return {
      totalRevenue: totalRevenue || 0,
      pixGross, pixNet,
      creditGross, creditNet,
      debitGross, debitNet,
      deliveryGross, deliveryNet,
      totalFees,
      totalNet,
      avgTicket,
      totalOrders: finishedFiltered.length || 0,
      activeOrders: orders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado').length || 0,
      gateLeakage: pendingGate.length,
      gateEfficiency: sessionOrders.length > 0 ? (gatedOrders.length / sessionOrders.length) * 100 : 100
    };
  }, [finishedOrders, orders, pixFee, creditFee, debitFee, deliveryFee]);

  const revenueData = useMemo(() => {
    // Determine how many days to show in the chart
    let daysCount = 7;
    if (period === 'today' || period === 'yesterday') daysCount = 1;
    else if (period === '30days') daysCount = 30;
    else if (period === 'month') {
        const now = new Date();
        daysCount = now.getDate();
    }

    const data = Array.from({ length: daysCount }).map((_, i) => {
      const date = subDays(endOfDay(dateRange.end), i);
      const label = period === 'today' || period === 'yesterday' ? 
        (period === 'today' ? 'Hoje' : 'Ontem') : 
        format(date, 'dd/MM');

      return {
        date: label,
        fullDate: date,
        revenue: 0,
        orders: 0
      };
    }).reverse();

    finishedOrders.forEach(order => {
      if (!order.createdAt) return;
      
      const orderDate = parseISO(order.createdAt);
      const dayLabel = period === 'today' || period === 'yesterday' ? 
        (period === 'today' ? 'Hoje' : 'Ontem') : 
        format(orderDate, 'dd/MM');
      
      const dayData = data.find(d => d.date === dayLabel);
      if (dayData) {
        dayData.revenue += (order.total || 0);
        dayData.orders += 1;
      }
    });

    return data;
  }, [finishedOrders, dateRange, period]);

  const paymentData = useMemo(() => {
    const data = [
      { name: 'PIX', value: 0, color: '#FF4E00' },
      { name: 'Crédito', value: 0, color: '#EAB308' },
      { name: 'Débito', value: 0, color: '#06B6D4' },
      { name: 'Entrega (Din/Card)', value: 0, color: '#1B1B1B' }
    ];

    finishedOrders.forEach(o => {
      if (o.paymentMethod === 'pix') data[0].value += (o.total || 0);
      else if (o.paymentMethod === 'credit') data[1].value += (o.total || 0);
      else if (o.paymentMethod === 'debit') data[2].value += (o.total || 0);
      else data[3].value += (o.total || 0);
    });

    return data.filter(d => d.value > 0);
  }, [finishedOrders]);

  const productData = useMemo(() => {
    const productMap: Record<string, { name: string, qty: number, revenue: number }> = {};
    
    finishedOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productMap[item.menuItemId]) {
          productMap[item.menuItemId] = { name: item.item.name, qty: 0, revenue: 0 };
        }
        productMap[item.menuItemId].qty += item.quantity;
        productMap[item.menuItemId].revenue += item.item.price * item.quantity;
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [finishedOrders]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto w-full pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink tracking-tight flex items-center gap-3">
             <MainBarChartIcon className="text-brand w-8 h-8" />
             ANÁLISE <span className="text-brand">FINANCEIRA</span>
          </h2>
          <p className="text-ink-muted font-medium">Acompanhe a saúde financeira e o desempenho do seu restaurante.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-black/5 shadow-sm">
           {[
             { id: 'today', label: 'Hoje' },
             { id: 'yesterday', label: 'Ontem' },
             { id: '7days', label: '7 dias' },
             { id: '30days', label: '30 dias' },
             { id: 'month', label: 'Este Mês' }
           ].map((p) => (
             <button
               key={p.id}
               onClick={() => setPeriod(p.id as Period)}
               className={`px-4 py-2 rounded-xl text-[10px] font-display font-bold uppercase tracking-wider transition-all ${
                 period === p.id 
                   ? 'bg-brand text-white shadow-md' 
                   : 'text-ink-muted hover:bg-oat'
               }`}
             >
               {p.label}
             </button>
           ))}
        </div>
      </header>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
         <StatsCard 
           title="Faturamento Total" 
           value={formatCurrency(stats.totalNet)} 
           subtitle={`Bruto: ${formatCurrency(stats.totalRevenue)}`}
           icon={DollarSign}
           trend="+12%"
           isPositive={true}
           color="text-brand"
         />
         <StatsCard 
           title="Faturamento PIX" 
           value={formatCurrency(stats.pixNet)} 
           subtitle={`Bruto: ${formatCurrency(stats.pixGross)} (${pixFee}%)`}
           icon={DollarSign}
           trend="+15%"
           isPositive={true}
           color="text-emerald-600"
         />
         <StatsCard 
           title="Faturamento Crédito" 
           value={formatCurrency(stats.creditNet)} 
           subtitle={`Bruto: ${formatCurrency(stats.creditGross)} (${creditFee}%)`}
           icon={CreditCard}
           trend="+12%"
           isPositive={true}
           color="text-yellow-600"
         />
         <StatsCard 
           title="Faturamento Débito" 
           value={formatCurrency(stats.debitNet)} 
           subtitle={`Bruto: ${formatCurrency(stats.debitGross)} (${debitFee}%)`}
           icon={Smartphone}
           trend="+5%"
           isPositive={true}
           color="text-cyan-600"
         />
         <StatsCard 
           title="Faturamento Outros" 
           value={formatCurrency(stats.deliveryNet)} 
           subtitle={`Bruto: ${formatCurrency(stats.deliveryGross)} (${deliveryFee}%)`}
           icon={Banknote}
           trend="+8%"
           isPositive={true}
           color="text-brand"
         />
         <StatsCard 
           title="Custo de Taxas" 
           value={formatCurrency(stats.totalFees)} 
           subtitle="Taxas de processamento"
           icon={ArrowDownRight}
           isPositive={false}
           color="text-red-500"
           trend="Est."
         />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         <StatsCard 
           title="Ticket Médio" 
           value={formatCurrency(stats.avgTicket)} 
           subtitle="Por pedido"
           icon={TrendingUp}
           trend="+5%"
           isPositive={true}
         />
         <StatsCard 
           title="Volume de Vendas" 
           value={stats.totalOrders.toString()} 
           subtitle="Volume de vendas"
           icon={ShoppingBag}
           trend="+18%"
           isPositive={true}
         />
         <StatsCard 
           title="Taxa de Saída (Gate)" 
           value={`${stats.gateEfficiency.toFixed(1)}%`} 
           subtitle={`${stats.gateLeakage} comandas pendentes`}
           icon={ShieldCheck}
           trend={stats.gateEfficiency > 95 ? 'Auditado' : 'Atenção'}
           isPositive={stats.gateEfficiency > 95}
         />
         <StatsCard 
           title="Pedidos Ativos" 
           value={stats.activeOrders.toString()} 
           subtitle="Na cozinha/entrega"
           icon={Package}
           neutral
         />
      </div>

      <div className="bg-brand/5 border border-brand/10 p-4 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-brand text-white rounded-xl grow-0 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="text-xs font-medium text-ink-muted leading-relaxed">
          <span className="font-bold text-brand block mb-1 uppercase tracking-widest text-[10px]">Cálculo de Receita Líquida</span>
          Os valores "Líquidos" são estimativas automáticas baseadas nas taxas configuradas em suas Configurações: 
          <span className="font-bold text-ink"> PIX ({pixFee}%)</span>, 
          <span className="font-bold text-ink"> Crédito ({creditFee}%)</span>, 
          <span className="font-bold text-ink"> Débito ({debitFee}%) </span> e 
          <span className="font-bold text-ink"> Pagamento na Entrega ({deliveryFee}% Est.)</span>. 
          Use estes dados para conferência com seus extratos bancários e de operadoras de cartão.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display font-bold text-ink text-lg italic uppercase tracking-tight">Faturamento Diário</h3>
            <div className="flex gap-4 text-[10px] font-display font-bold uppercase tracking-widest text-ink-muted">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-brand" /> Receita
               </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF4E00" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#FF4E00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1A1', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1A1', fontSize: 10, fontWeight: 700 }}
                  tickFormatter={(val) => `R$${val}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontFamily: 'inherit',
                    fontWeight: 700,
                    fontSize: '12px'
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#FF4E00" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm flex flex-col">
          <h3 className="font-display font-bold text-ink text-lg italic uppercase tracking-tight mb-8 text-center lg:text-left">Métodos de Pagamento</h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 pt-4 border-t border-black/5">
             <p className="text-[10px] font-display font-bold text-ink-muted uppercase tracking-widest text-center">Concentração de Receita por Canal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Top Selling Products */}
         <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
           <h3 className="font-display font-bold text-ink text-lg italic uppercase tracking-tight mb-8">Top 5 Produtos (Receita)</h3>
           <div className="space-y-4">
              {productData.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-oat rounded-2xl border border-black/5 transition-transform hover:scale-[1.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center font-display font-black shadow-sm">
                       {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-ink text-sm">{product.name}</h4>
                      <p className="text-[10px] text-ink-muted uppercase font-black tracking-widest">{product.qty} vendidos</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-black text-ink">{formatCurrency(product.revenue)}</p>
                    <div className="w-24 h-1.5 bg-black/5 rounded-full mt-1 overflow-hidden">
                       <div 
                         className="h-full bg-brand rounded-full" 
                         style={{ width: `${(product.revenue / productData[0].revenue) * 100}%` }} 
                       />
                    </div>
                  </div>
                </div>
              ))}
              {productData.length === 0 && (
                <div className="py-20 text-center font-display font-bold text-ink-muted italic">Sem dados de vendas suficientes.</div>
              )}
           </div>
         </div>

         {/* Daily Orders Bar Chart */}
         <div className="bg-white p-8 rounded-[32px] border border-black/5 shadow-sm">
           <h3 className="font-display font-bold text-ink text-lg italic uppercase tracking-tight mb-8">Volume de Pedidos</h3>
           <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1A1', fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#A1A1A1', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: '#f8f8f8' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => [`${value} pedidos`, 'Volume']}
                />
                <Bar 
                  dataKey="orders" 
                  fill="#1B1B1B" 
                  radius={[8, 8, 0, 0]} 
                  barSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
           </div>
         </div>

         {/* Portaria Audit Section */}
         <div className="lg:col-span-2 bg-black text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-10">
                  <h3 className="font-display font-bold text-2xl tracking-tighter uppercase italic">Auditoria de <span className="text-brand">Portaria</span></h3>
                  <ShieldCheck className="w-8 h-8 text-brand" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <p className="text-white/60 text-sm font-medium leading-relaxed">Cruzamento de dados entre pedidos finalizados na cozinha e validações físicas de saída. Garante que nenhum item saia sem o devido acerto fiscal.</p>
                     
                     <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <div className="flex justify-between items-center mb-1">
                           <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Eficiência Logística</span>
                           <span className="text-sm font-black text-brand tracking-tight">{stats.gateEfficiency.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                           <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${stats.gateEfficiency}%` }}
                              className="h-full bg-brand rounded-full shadow-[0_0_10px_rgba(255,78,0,0.5)]" 
                           />
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
                        <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                           <QrCode className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-display font-black text-white leading-none mb-1">{finishedOrders.filter(o => o.type === 'dine-in' && o.status === 'finalizado').length}</p>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Saídas Validadas</p>
                     </div>

                     <div className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
                        <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                           <AlertCircle className="w-5 h-5" />
                        </div>
                        <p className="text-2xl font-display font-black text-white leading-none mb-1">{stats.gateLeakage}</p>
                        <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Fugas/Pendentes</p>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon: Icon, trend, isPositive, neutral, color }: any) {
  return (
    <div className="bg-white p-6 rounded-[32px] border border-black/5 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
       <div className="flex justify-between items-start mb-4">
         <div className={`p-3 bg-oat rounded-2xl border border-black/5 ${color || 'text-ink-muted'} group-hover:bg-brand/10 group-hover:text-brand transition-colors`}>
            <Icon className="w-5 h-5" strokeWidth={2.5} />
         </div>
         {!neutral && (
           <div className={`flex items-center gap-1 text-[10px] font-display font-black uppercase tracking-widest ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
             {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
             {trend}
           </div>
         )}
       </div>
       <div className="space-y-1">
         <h4 className="text-[10px] font-display font-black text-ink-muted uppercase tracking-widest">{title}</h4>
         <p className="text-2xl font-display font-black text-ink tracking-tight">{value}</p>
         <p className="text-[10px] text-ink-muted/60 font-medium italic">{subtitle}</p>
       </div>
    </div>
  );
}

function MainBarChartIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>
    </svg>
  );
}
