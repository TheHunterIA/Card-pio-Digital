import React, { useState, useEffect, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { finalizeOrder, releaseTableSession, validateAndConsumePortierPass } from '../../lib/database';
import { useStore, Order } from '../../store';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  RefreshCw,
  Clock,
  User,
  Utensils,
  ArrowLeft,
  LayoutGrid,
  Search,
  BellRing
} from 'lucide-react';

export default function PorterDashboard() {
  const [viewMode, setViewMode] = useState<'scanner' | 'tables'>('scanner');
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  const [config, setConfig] = useState<any>(null);
  const [activeSessions, setActiveSessions] = useState<Record<string, any>>({});
  const orders = useStore(state => state.orders);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'sessions'), (snap) => {
      const sessions: Record<string, any> = {};
      snap.docs.forEach(d => {
        sessions[d.id] = d.data();
      });
      setActiveSessions(sessions);
    });
  }, []);

  const tables = useMemo(() => {
    if (!config) return [];
    const count = config?.tablesCount || 10;
    return Array.from({ length: count }, (_, i) => ({
      id: (i + 1).toString(),
      label: `Mesa ${i + 1}`
    }));
  }, [config]);

  const activeOrdersByTable = useMemo(() => {
    const map: Record<string, Order[]> = {};
    orders.filter(o => o.status !== 'finalizado' && o.status !== 'cancelado').forEach(o => {
      if (o.tableNumber) {
        if (!map[o.tableNumber]) map[o.tableNumber] = [];
        map[o.tableNumber].push(o);
      }
    });
    return map;
  }, [orders]);

  // Modern Scanner Logic
  useEffect(() => {
    if (viewMode !== 'scanner' || !scanning || scanResult) return;

    const html5QrCode = new Html5Qrcode("reader");
    setScannerInstance(html5QrCode);

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            html5QrCode.stop().then(() => {
              setScanning(false);
              validatePass(decodedText);
            });
          },
          undefined
        );
      } catch (err) {
        console.error("Scanner start error", err);
      }
    };

    startScanner();

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(console.error);
      }
    };
  }, [viewMode, scanning, scanResult]);

  const handleTableClick = (tableId: string) => {
    setError(null);
    setScanning(false);
    
    const tableOrders = activeOrdersByTable[tableId] || [];
    const session = activeSessions[`table-${tableId}`];
    
    if (tableOrders.length === 0) {
      if (session?.activeVisitorSalt) {
        setScanResult({
          id: `VISITOR-${tableId}-${session.activeVisitorSalt}`,
          customerName: 'Visitante (Passe Aguardando)',
          tableNumber: tableId,
          total: 0,
          isValid: true,
          isVisitor: true,
          visitorSalt: session.activeVisitorSalt,
          warning: 'Este pass foi gerado pelo Garçom. Clique em Liberar para validar.'
        });
      } else {
        setScanResult({
          id: `VISITOR-${tableId}`,
          customerName: 'Acesso Visitante',
          tableNumber: tableId,
          total: 0,
          isValid: true,
          isVisitor: true,
          warning: 'Nenhuma comanda ou passe ativo. Liberar comanda em branco?'
        });
      }
      return;
    }

    // Process table status
    let unpaidCount = 0;
    let unpaidTotal = 0;
    let totalTableVal = 0;

    tableOrders.forEach(order => {
      totalTableVal += order.total;
      if (order.paymentStatus !== 'paid') {
        unpaidCount++;
        unpaidTotal += order.total;
      }
    });

    if (unpaidCount > 0) {
      setScanResult({
        id: `TABLE-${tableId}`,
        customerName: `Mesa ${tableId} (Agrupado)`,
        tableNumber: tableId,
        total: totalTableVal,
        isValid: false,
        error: 'EXISTEM PEDIDOS PENDENTES',
        warning: `${unpaidCount} pedido(s) pendentes (R$ ${unpaidTotal.toFixed(2)})`
      });
    } else {
      setScanResult({
        id: `TABLE-${tableId}`,
        customerName: `Mesa ${tableId} (Tudo Pago)`,
        tableNumber: tableId,
        total: totalTableVal,
        isValid: true,
        warning: 'A confirmação irá encerrar a mesa e liberar os clientes.'
      });
    }
  };

  const validatePass = async (text: string) => {
    setValidating(true);
    setError(null);
    setScanResult(null);

    const today = new Date().toISOString().split('T')[0];

    // Expected token: UP_PASS_{ORDER_ID}_{TIMESTAMP} or UP_PASS_TABLE_{TABLE_ID}_{TIMESTAMP}
    if (!text.startsWith('UP_PASS_')) {
      setError('Código Inválido: Formato não reconhecido.');
      setValidating(false);
      return;
    }

    const parts = text.split('_');
    
    // Check for Visitor Pass: UP_PASS_VISITOR_{TABLE_ID}_{DATE}_{SALT}
    if (text.startsWith('UP_PASS_VISITOR_')) {
      const tableId = parts[3];
      const datePart = parts[4];
      const saltPart = parts[5];
      
      if (datePart !== today) {
        setError('Código Expirado: Este passe de visitante é de outro dia.');
        setValidating(false);
        return;
      }

      try {
        const isValid = await validateAndConsumePortierPass(text, tableId);

        if (!isValid) {
          setError('Código Inválido: Este passe já foi utilizado ou é inválido.');
          setValidating(false);
          return;
        }

        setScanResult({
          id: `VISITOR-${tableId}-${saltPart}`,
          customerName: 'Visitante (Consumo Zero)',
          tableNumber: tableId,
          total: 0,
          isValid: true,
          isVisitor: true,
          visitorSalt: saltPart
        });
      } catch (e) {
        console.error(e);
        setError('Erro ao validar token de visitante.');
      } finally {
        setValidating(false);
      }
      return;
    }

    // Check for Full Table Pass: UP_PASS_TABLE_{TABLE_ID}_{TIMESTAMP}
    if (text.startsWith('UP_PASS_TABLE_')) {
      const tableId = parts[3];
      const datePart = parts[4];

      if (datePart !== today) {
         setError('Código Expirado: Este código é de outro dia.');
         setValidating(false);
         return;
      }

      try {
        // Query all active orders for this table
        const q = query(
          collection(db, 'orders'),
          where('tableNumber', '==', tableId),
          where('status', 'not-in', ['finalizado', 'cancelado'])
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
          setError(`Mesa ${tableId} não possui comandas ativas.`);
          setValidating(false);
          return;
        }

        // Check if ANY of the table's orders are pending payment
        let hasPending = false;
        let totalVal = 0;
        snap.forEach(d => {
          totalVal += d.data().total;
          if (d.data().paymentStatus !== 'paid') {
            hasPending = true;
          }
        });

        if (hasPending) {
          setError('Atenção: Existem pedidos PENDENTES DE PAGAMENTO nesta Mesa.');
          setScanResult({
            id: `TABLE-${tableId}`,
            customerName: `Mesa ${tableId} (Agrupado)`,
            tableNumber: tableId,
            total: totalVal,
            isValid: false,
            error: 'PENDENTE DE PAGAMENTO'
          });
        } else {
          // Apenas valida que está tudo pago, sem finalizar no banco.
          // O garçom decide se limpa ou deixa a mesa aberta para os clientes voltarem.
          setScanResult({
            id: `TABLE-${tableId}`,
            customerName: `Mesa ${tableId} (Pagamentos OK)`,
            tableNumber: tableId,
            total: totalVal,
            isValid: true,
            warning: 'Aviso: Esta validação não encerra a mesa definitivamente no sistema. Se os clientes foram embora permanentemente, o Garçom pode fechar a fatura.'
          });
        }
      } catch (e) {
        console.error(e);
        setError('Falha ao processar comandos da mesa.');
      } finally {
        setValidating(false);
      }
      return;
    }

    const orderId = parts[2];
    const datePart = parts[3];

    // Check expiration (only same day for simplicity)
    if (datePart !== today) {
       setError('Código Expirado: Este código é de outro dia.');
       setValidating(false);
       return;
    }

    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        setError('Erro: Comanda não encontrada no sistema.');
      } else {
        const orderData = orderDoc.data();
        
        // If it belongs to a table, we should check the whole table status
        if (orderData.tableNumber) {
          const tableQ = query(
            collection(db, 'orders'), 
            where('tableNumber', '==', orderData.tableNumber), 
            where('status', 'not-in', ['finalizado', 'cancelado'])
          );
          const tableSnap = await getDocs(tableQ);
          
          let unpaidCount = 0;
          let unpaidTotal = 0;
          let totalTableVal = 0;

          tableSnap.forEach(d => {
            totalTableVal += d.data().total;
            if (d.data().paymentStatus !== 'paid') {
              unpaidCount++;
              unpaidTotal += d.data().total;
            }
          });

          if (unpaidCount > 0) {
            setScanResult({
              id: `TABLE-${orderData.tableNumber}`,
              customerName: `Mesa ${orderData.tableNumber} (Agrupado)`,
              tableNumber: orderData.tableNumber,
              total: totalTableVal,
              isValid: false,
              error: 'EXISTEM PEDIDOS PENDENTES',
              warning: `${unpaidCount} pedido(s) pendentes (R$ ${unpaidTotal.toFixed(2)})`
            });
          } else {
            setScanResult({
              id: `TABLE-${orderData.tableNumber}`,
              customerName: `Mesa ${orderData.tableNumber} (Tudo Pago)`,
              tableNumber: orderData.tableNumber,
              total: totalTableVal,
              isValid: true,
              warning: 'A confirmação irá encerrar a mesa e liberar os clientes.'
            });
          }
          return;
        }

        if (orderData.paymentStatus === 'paid') {
          setScanResult({
            id: orderDoc.id,
            ...orderData,
            isValid: true
          });
        } else {
          setScanResult({
            id: orderDoc.id,
            ...orderData,
            isValid: false,
            error: 'PENDENTE DE PAGAMENTO'
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      setError('Falha na conexão com o banco de dados.');
    } finally {
      setValidating(false);
    }
  };

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    setScanning(true);
    setIsFinalizing(false);
  };

  const handleFinalizeRelease = async () => {
    if (!scanResult) return;
    setIsFinalizing(true);
    
    try {
      if (scanResult.id.startsWith('VISITOR-') && scanResult.visitorSalt) {
        const today = new Date().toISOString().split('T')[0];
        const tokenStr = `UP_PASS_VISITOR_${scanResult.tableNumber}_${today}_${scanResult.visitorSalt}`;
        await validateAndConsumePortierPass(tokenStr, scanResult.tableNumber);
      } else if (scanResult.id.startsWith('TABLE-')) {
        await releaseTableSession(scanResult.tableNumber);
      } else if (!scanResult.isVisitor) {
        await finalizeOrder(scanResult.id);
      }
      
      handleReset();
    } catch (e) {
      console.error(e);
      setError('Falha ao finalizar liberação.');
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="min-h-screen bg-oat p-4 md:p-8 font-sans">
      {/* Header / Top Bar */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-black/5 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-black/5">
             <ShieldCheck className="w-6 h-6 text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">Sistema Online</span>
            </div>
            <h1 className="text-3xl font-display font-black italic tracking-tighter uppercase leading-none text-ink">
              Painel da <span className="text-brand">Portaria</span>
            </h1>
          </div>
        </div>

        <nav className="flex bg-white p-1.5 rounded-[24px] border border-black/5 shadow-sm">
          <button 
            onClick={() => { setViewMode('scanner'); handleReset(); }}
            className={`px-8 py-3 rounded-2xl flex items-center gap-3 transition-all text-[11px] font-display font-black uppercase tracking-widest ${
              viewMode === 'scanner' ? 'bg-ink text-white shadow-lg' : 'text-ink-muted hover:bg-oat'
            }`}
          >
            <QrCode className="w-4 h-4" /> Scanner
          </button>
          <button 
            onClick={() => { setViewMode('tables'); handleReset(); }}
            className={`px-8 py-3 rounded-2xl flex items-center gap-3 transition-all text-[11px] font-display font-black uppercase tracking-widest ${
              viewMode === 'tables' ? 'bg-ink text-white shadow-lg' : 'text-ink-muted hover:bg-oat'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Gestão de Mesas
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-6 md:gap-8">
        {/* Intelligence / Results Sidebar - Moved to top on mobile for better UX */}
        <aside className="space-y-6 lg:order-2">
          <AnimatePresence mode="wait">
            {!scanResult && !error && !validating ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/50 border border-black/5 rounded-[32px] md:rounded-[40px] p-6 md:p-10 text-center flex flex-col items-center justify-center min-h-[160px] lg:min-h-[300px]"
              >
                 <div className="w-12 h-12 md:w-20 md:h-20 bg-oat rounded-full flex items-center justify-center mb-4 md:mb-6 shadow-inner">
                    <QrCode className="w-6 h-6 md:w-10 md:h-10 text-ink/10" />
                 </div>
                 <p className="text-[9px] md:text-[10px] font-black text-ink-muted uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">
                    Sistema Aguardando...<br/>Escaneie um código ou escolha uma mesa.
                 </p>
              </motion.div>
            ) : validating ? (
              <div className="bg-white rounded-[32px] md:rounded-[40px] p-8 md:p-12 text-center border border-black/5 shadow-sm">
                 <div className="w-10 h-10 md:w-12 md:h-12 border-2 border-brand/20 border-t-brand rounded-full animate-spin mx-auto mb-4 md:mb-6" />
                 <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-ink animate-pulse">Consultando Servidor...</span>
              </div>
            ) : error ? (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-red-50 border-2 border-red-100 rounded-[32px] md:rounded-[40px] p-6 md:p-10"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-red-100 text-red-600 rounded-[20px] md:rounded-[24px] flex items-center justify-center mb-4 md:mb-6 shadow-sm">
                  <ShieldAlert className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <h3 className="text-xl md:text-2xl font-display font-black italic tracking-tighter uppercase leading-none text-red-600 mb-2 md:mb-3">Erro de Acesso</h3>
                <p className="text-[9px] md:text-[10px] leading-relaxed text-red-500 font-black uppercase tracking-widest mb-6 md:mb-8 text-pretty">
                  {error}
                </p>
                <button 
                  onClick={handleReset}
                  className="w-full h-14 md:h-16 bg-red-600 text-white rounded-xl md:rounded-2xl font-display font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-red-700 transition-all shadow-xl shadow-red-500/10 active:scale-95"
                >
                  Tentar Novamente
                </button>
              </motion.div>
            ) : scanResult && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`rounded-[32px] md:rounded-[40px] p-6 md:p-10 border-2 shadow-2xl relative ${
                  scanResult.isValid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-black'
                }`}
              >
                <div className="flex items-start justify-between mb-6 md:mb-10">
                  <div className="w-14 h-14 md:w-20 md:h-20 bg-black/10 rounded-[20px] md:rounded-[28px] flex items-center justify-center shadow-inner">
                    {scanResult.isValid ? <ShieldCheck className="w-8 h-8 md:w-12 md:h-12" /> : <ShieldAlert className="w-8 h-8 md:w-12 md:h-12" />}
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60">Status</span>
                    <h4 className="text-lg md:text-2xl font-display font-black uppercase leading-none mt-1 tracking-tighter italic">
                      {scanResult.isValid ? 'LIBERADO' : 'BLOQUEADO'}
                    </h4>
                  </div>
                </div>

                <div className="space-y-6 md:space-y-8 mb-8 md:mb-12">
                   <div className="pb-4 md:pb-6 border-b border-black/10">
                      <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1 md:mb-2">Cliente / Local</span>
                      <p className="text-xl md:text-3xl font-display font-black tracking-tighter italic uppercase leading-tight sm:leading-none">{scanResult.customerName}</p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4 md:gap-6">
                      <div>
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1 md:mb-2">Total Consumo</span>
                        <p className="text-base md:text-xl font-display font-black tracking-tighter">R$ {scanResult.total?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-50 block mb-1 md:mb-2">Tipo Passe</span>
                        <p className="text-xs md:text-sm font-bold uppercase tracking-tight leading-none italic">
                          {scanResult.isVisitor ? 'Visitante' : 'Mesa'}
                        </p>
                      </div>
                   </div>

                   {scanResult.warning && (
                     <div className="bg-black/5 p-4 md:p-5 rounded-xl md:rounded-2xl border border-black/10">
                        <p className="text-[9px] md:text-[10px] font-black uppercase leading-relaxed italic opacity-80">{scanResult.warning}</p>
                     </div>
                   )}
                </div>

                <div className="flex flex-col gap-3 md:gap-4">
                  {scanResult.isValid && (
                    <button 
                      onClick={handleFinalizeRelease}
                      disabled={isFinalizing}
                      className="w-full h-14 md:h-18 bg-black text-white rounded-xl md:rounded-[24px] font-display font-black uppercase tracking-[0.2em] text-[10px] md:text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 md:gap-3"
                    >
                      {isFinalizing ? <RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />}
                      {isFinalizing ? 'Finalizando...' : 'LIBERAR SAÍDA'}
                    </button>
                  )}

                  <button 
                    onClick={handleReset}
                    className="w-full h-12 md:h-14 border-2 border-black/10 rounded-xl md:rounded-2xl font-display font-black uppercase tracking-widest text-[8px] md:text-[9px] hover:bg-black/5 transition-all"
                  >
                    Voltar / Cancelar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* System Telemetry - Logs Section - Hidden on very small screens to save space, or moved below */}
          <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-black/5 shadow-sm space-y-4 md:space-y-6 lg:block hidden">
             <div className="flex items-center justify-between">
                <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-ink-muted italic">Logs de Acesso</h3>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
             </div>
             <div className="space-y-4">
                {orders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-[10px] md:text-[11px] font-bold uppercase tracking-tight pb-4 border-b border-black/5 last:border-0 last:pb-0">
                    <div className="flex flex-col">
                       <span className="text-ink">#{o.id.slice(-4)}</span>
                       <span className="text-[8px] md:text-[9px] text-ink-muted">{o.tableNumber ? `MESA ${o.tableNumber}` : 'DELIVERY'}</span>
                    </div>
                    <span className={`px-2 py-0.5 md:py-1 rounded-lg text-[8px] md:text-[9px] font-black ${o.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                       {o.paymentStatus === 'paid' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </div>
                ))}
             </div>
          </div>
        </aside>

        {/* Primary View Area (Scanner/Tables) */}
        <section className="space-y-6 lg:order-1">
          <AnimatePresence mode="wait">
            {viewMode === 'scanner' ? (
              <motion.div 
                key="scanner-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative"
              >
                <div className="bg-white rounded-[32px] md:rounded-[40px] border border-black/5 overflow-hidden shadow-sm">
                  <div className="p-6 md:p-8 border-b border-black/5">
                    <h3 className="text-sm font-display font-black text-ink uppercase tracking-widest leading-none">Câmera de Leitura</h3>
                    <p className="text-[9px] md:text-[10px] text-ink-muted font-bold uppercase mt-2 tracking-widest leading-relaxed">Aguardando apresentação do QR Code</p>
                  </div>

                  <div className="relative aspect-square sm:aspect-video md:aspect-[16/10] bg-black group">
                    <div id="reader" className="w-full h-full object-cover opacity-90" />
                    
                    {/* Scanning Overlay Visuals */}
                    <AnimatePresence>
                      {scanning && !scanResult && (
                        <motion.div 
                          className="absolute inset-0 z-10 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="absolute inset-0 border-[20px] md:border-[30px] border-black/60" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-64 md:h-64">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-8 h-8 md:w-10 md:h-10 border-t-4 border-l-4 border-brand -translate-x-1 -translate-y-1 rounded-tl-lg md:rounded-tl-xl" />
                            <div className="absolute top-0 right-0 w-8 h-8 md:w-10 md:h-10 border-t-4 border-r-4 border-brand translate-x-1 -translate-y-1 rounded-tr-lg md:rounded-tr-xl" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 md:w-10 md:h-10 border-b-4 border-l-4 border-brand -translate-x-1 translate-y-1 rounded-bl-lg md:rounded-bl-xl" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 md:w-10 md:h-10 border-b-4 border-r-4 border-brand translate-x-1 translate-y-1 rounded-br-lg md:rounded-br-xl" />
                            
                            <motion.div 
                              className="w-full h-0.5 bg-brand/80 shadow-[0_0_15px_rgba(255,78,0,0.8)]"
                              animate={{ top: ['10%', '90%'] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!scanning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-md z-20">
                        <button 
                          onClick={handleReset}
                          className="px-8 py-4 md:px-10 md:py-5 bg-ink text-white rounded-xl md:rounded-2xl font-display font-black uppercase tracking-widest text-[10px] md:text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3"
                        >
                          <RefreshCw className="w-4 h-4" /> Reiniciar Scanner
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 md:p-8 grid md:grid-cols-2 gap-6 md:gap-8 bg-oat/20">
                    <div className="space-y-2 md:space-y-3">
                      <span className="text-[9px] md:text-[10px] font-black text-ink-muted uppercase tracking-widest block">Instruções</span>
                      <p className="text-[10px] md:text-xs leading-relaxed text-ink/70 font-medium italic">
                        Sistema valida apenas acessos gerados no dia de hoje.
                      </p>
                    </div>
                    <div className="flex flex-col justify-end items-start md:items-end gap-2 md:gap-3">
                       <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-emerald-100">
                          <ShieldCheck className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
                          <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-emerald-700 text-nowrap">Canal Seguro OK</span>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="tables-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[32px] md:rounded-[40px] border border-black/5 p-6 md:p-10 shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 md:mb-12 gap-6">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-brand/10 border border-brand/20 rounded-xl md:rounded-[20px] flex items-center justify-center">
                      <LayoutGrid className="w-6 h-6 md:w-7 md:h-7 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-display font-black italic tracking-tighter uppercase leading-none text-ink">Mapa de Mesas</h2>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                     {[
                       { label: 'Livre', color: 'bg-oat border-black/5' },
                       { label: 'Ocupada', color: 'bg-ink border-ink' },
                       { label: 'Pendente', color: 'bg-amber-500 border-amber-500' }
                     ].map(l => (
                       <div key={l.label} className="flex items-center gap-2">
                         <div className={`w-2.5 h-2.5 ${l.color} rounded-full border shadow-xs`} />
                         <span className="text-[8px] font-black uppercase text-ink-muted tracking-widest">{l.label}</span>
                       </div>
                     ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 md:gap-6">
                  {tables.map(table => {
                    const tableOrders = activeOrdersByTable[table.id] || [];
                    const session = activeSessions[`table-${table.id}`];
                    const isOccupied = tableOrders.length > 0;
                    const isVisitorActive = session?.activeVisitorSalt && !isOccupied;
                    const hasPending = tableOrders.some(o => o.paymentStatus !== 'paid');
                    const hasReady = tableOrders.some(o => o.status === 'pronto-entrega' || o.status === 'saiu-entrega');

                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table.id)}
                        className={`aspect-square rounded-[20px] md:rounded-[28px] border-2 transition-all group relative flex flex-col items-center justify-center gap-1 ${
                          hasReady 
                            ? 'bg-brand border-brand text-white shadow-lg animate-pulse'
                            : hasPending 
                              ? 'bg-amber-500 border-amber-500 text-black shadow-sm'
                              : isVisitorActive
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                                : isOccupied 
                                  ? 'bg-ink border-ink text-white shadow-md'
                                  : 'bg-oat/40 border-black/5 text-ink-muted hover:border-brand/30 hover:bg-white'
                        }`}
                      >
                        <span className="text-xl md:text-2xl font-display font-black italic">{table.id}</span>
                        
                        <div className="absolute top-1 right-1 flex flex-col items-end gap-0.5">
                           {hasReady && (
                             <div className="bg-white text-brand px-1.5 py-0.5 rounded-full text-[6px] font-black uppercase tracking-tighter flex items-center gap-0.5 shadow-sm">
                                <BellRing className="w-1.5 h-1.5 animate-bounce" />
                                PRONTO!
                             </div>
                           )}
                           {hasPending && !hasReady && (
                             <div className="bg-black text-white px-1.5 py-0.5 rounded-full text-[6px] font-black uppercase tracking-tighter shadow-sm">
                                PAG
                             </div>
                           )}
                        </div>

                        <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-current opacity-30 mt-1" />
                        
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-brand text-white text-[7px] font-black px-1.5 rounded-full pointer-events-none z-50">
                           {isOccupied ? (hasPending ? 'PAG' : 'OK') : (isVisitorActive ? 'VISIT' : 'L')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
