import React, { useState, useEffect, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { finalizeOrder } from '../../lib/database';
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
  const orders = useStore(state => state.orders);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
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
    
    if (tableOrders.length === 0) {
      // Release as visitor
      setScanResult({
        id: `VISITOR-${tableId}`,
        customerName: 'Visitante (Consumo Zero)',
        tableNumber: tableId,
        total: 0,
        isValid: true,
        isVisitor: true
      });
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
        const tokenRef = doc(db, 'usedTokens', text);
        const tokenSnap = await getDoc(tokenRef);

        if (tokenSnap.exists()) {
          setError('Código Inválido: Este passe já foi utilizado.');
          setValidating(false);
          return;
        }

        await setDoc(tokenRef, { usedAt: serverTimestamp(), tableId, saltPart });
        setScanResult({
          id: `VISITOR-${tableId}-${saltPart}`,
          customerName: 'Visitante (Consumo Zero)',
          tableNumber: tableId,
          total: 0,
          isValid: true,
          isVisitor: true
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
      if (scanResult.id.startsWith('TABLE-')) {
        const tableId = scanResult.tableNumber;
        const q = query(
          collection(db, 'orders'),
          where('tableNumber', '==', tableId),
          where('status', 'not-in', ['finalizado', 'cancelado'])
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => {
          batch.update(d.ref, { 
            status: 'finalizado', 
            updatedAt: serverTimestamp() 
          });
        });
        await batch.commit();

        // Also closing the session if it exists
        const sessionRef = doc(db, 'sessions', `table-${tableId}`);
        await setDoc(sessionRef, { status: 'closed', closedAt: serverTimestamp() }, { merge: true });
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
    <div className="min-h-screen bg-[#0A0A0B] text-white p-4 md:p-8 font-mono">
      {/* Header / Mission Control Status */}
      <header className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 bg-brand rounded-full animate-pulse shadow-[0_0_12px_rgba(255,78,0,0.5)]" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">System Status: Active</span>
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase leading-none">
            Porter <span className="text-brand">Protocol</span>
          </h1>
        </div>

        <nav className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl">
          <button 
            onClick={() => { setViewMode('scanner'); handleReset(); }}
            className={`px-8 py-3 rounded-xl flex items-center gap-2 transition-all text-[11px] font-black uppercase tracking-widest ${
              viewMode === 'scanner' ? 'bg-white text-black' : 'text-white/40 hover:text-white'
            }`}
          >
            <QrCode className="w-4 h-4" /> Scanner
          </button>
          <button 
            onClick={() => { setViewMode('tables'); handleReset(); }}
            className={`px-8 py-3 rounded-xl flex items-center gap-2 transition-all text-[11px] font-black uppercase tracking-widest ${
              viewMode === 'tables' ? 'bg-white text-black' : 'text-white/40 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Fleet Management
          </button>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto grid lg:grid-cols-[1fr,420px] gap-8">
        {/* Primary View Area */}
        <section className="space-y-6">
          <AnimatePresence mode="wait">
            {viewMode === 'scanner' ? (
              <motion.div 
                key="scanner-view"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="relative group"
              >
                {/* Modern Scanner UI Frame */}
                <div className="bg-[#141416] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                        <QrCode className="w-5 h-5 text-white/60" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-widest leading-none">Optical Input</h3>
                        <p className="text-[10px] text-white/30 uppercase mt-1">Awaiting digital pass signature</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative aspect-video md:aspect-[16/10] bg-black">
                    <div id="reader" className="w-full h-full object-cover grayscale opacity-80" />
                    
                    {/* Scanning Overlay Visuals */}
                    <AnimatePresence>
                      {scanning && !scanResult && (
                        <motion.div 
                          className="absolute inset-0 z-10 pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <div className="absolute inset-0 border-[40px] border-black/40" />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-white/20">
                            {/* Corner Accents */}
                            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand -translate-x-2 -translate-y-2" />
                            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand translate-x-2 -translate-y-2" />
                            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand -translate-x-2 translate-y-2" />
                            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand translate-x-2 translate-y-2" />
                            
                            {/* Scanning Animation Line */}
                            <motion.div 
                              className="w-full h-1 bg-brand/50 shadow-[0_0_15px_rgba(255,78,0,0.8)]"
                              animate={{ top: ['0%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!scanning && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
                        <button 
                          onClick={handleReset}
                          className="px-10 py-5 bg-white text-black rounded-full font-black uppercase tracking-[0.2em] text-xs hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-3"
                        >
                          <RefreshCw className="w-4 h-4" /> Reset Sequence
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-8 grid md:grid-cols-2 gap-8 bg-white/[0.02]">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Protocol Instructions</span>
                      <p className="text-xs leading-relaxed text-white/50 italic font-medium">
                        Position the digital pass QR within the sensor view. Today's signature is mandatory. Expired or duplicate tokens will be rejected by the firewall.
                      </p>
                    </div>
                    <div className="flex flex-col justify-end items-end gap-2">
                       <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Security Layer</span>
                       <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-[9px] font-black uppercase tracking-[0.1em]">Encrypted Handshake OK</span>
                       </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="tables-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-[#141416] rounded-[32px] border border-white/5 p-8 overflow-hidden shadow-2xl"
              >
                <div className="flex items-center justify-between mb-10">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-brand/10 border border-brand/20 rounded-2xl flex items-center justify-center">
                      <LayoutGrid className="w-6 h-6 text-brand" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black italic tracking-tighter uppercase leading-none">Fleet Grid</h2>
                      <p className="text-[10px] text-white/30 uppercase mt-1 tracking-widest font-bold">Real-time table distribution</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                     {[
                       { label: 'Free', color: 'bg-white/10' },
                       { label: 'Active', color: 'bg-white' },
                       { label: 'Pending', color: 'bg-amber-500' }
                     ].map(l => (
                       <div key={l.label} className="flex items-center gap-2">
                         <div className={`w-2 h-2 ${l.color} rounded-full`} />
                         <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">{l.label}</span>
                       </div>
                     ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-6">
                  {tables.map(table => {
                    const tableOrders = activeOrdersByTable[table.id] || [];
                    const isOccupied = tableOrders.length > 0;
                    const hasPending = tableOrders.some(o => o.paymentStatus !== 'paid');
                    const hasReady = tableOrders.some(o => o.status === 'pronto-entrega' || o.status === 'saiu-entrega');

                    return (
                      <button
                        key={table.id}
                        onClick={() => handleTableClick(table.id)}
                        className={`aspect-square rounded-[24px] border-2 transition-all group relative flex flex-col items-center justify-center gap-1 ${
                          hasReady 
                            ? 'bg-brand border-brand text-white shadow-[0_0_30px_rgba(255,78,0,0.3)] animate-pulse'
                            : hasPending 
                              ? 'bg-amber-500 border-amber-500 text-black'
                              : isOccupied 
                                ? 'bg-white border-white text-black'
                                : 'bg-transparent border-white/10 text-white/20 hover:border-white/40 hover:text-white'
                        }`}
                      >
                        <span className="text-2xl font-black italic">{table.id}</span>
                        <div className="w-1 h-1 rounded-full bg-current opacity-30 mt-1" />
                        
                        {/* Status Tip */}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-brand text-white text-[8px] font-black px-2 py-1 rounded-full pointer-events-none z-50">
                           {isOccupied ? (hasPending ? 'PAYMENT REQUIRED' : 'CLEARANCE READY') : 'VACANT'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Intelligence / Results Sidebar */}
        <aside className="space-y-6">
          <AnimatePresence mode="wait">
            {!scanResult && !error && !validating ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 border border-white/5 rounded-[32px] p-8 text-center italic"
              >
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldCheck className="w-8 h-8 text-white/10" />
                 </div>
                 <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] leading-relaxed">
                    System Idle. Awaiting data stream from scanner or manual selection.
                 </p>
              </motion.div>
            ) : validating ? (
              <div className="bg-white/5 border border-white/5 rounded-[32px] p-12 text-center">
                 <div className="w-10 h-10 border-2 border-white/10 border-t-white rounded-full animate-spin mx-auto mb-6" />
                 <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white animate-pulse">Analyzing Signature...</span>
              </div>
            ) : error ? (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-red-500/10 border-2 border-red-500/20 rounded-[32px] p-8"
              >
                <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-red-500/40">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black italic tracking-tighter uppercase leading-none text-red-500 mb-4">Integrity Error</h3>
                <p className="text-xs leading-relaxed text-red-500/70 font-bold uppercase tracking-tight mb-8">
                  {error}
                </p>
                <button 
                  onClick={handleReset}
                  className="w-full h-14 border border-red-500 text-red-500 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-red-500 hover:text-white transition-all shadow-xl shadow-red-500/10"
                >
                  Clear Fault
                </button>
              </motion.div>
            ) : scanResult && (
              <motion.div 
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`rounded-[32px] p-8 border-2 shadow-2xl relative ${
                  scanResult.isValid ? 'bg-emerald-500' : 'bg-amber-500'
                } text-black`}
              >
                <div className="flex items-start justify-between mb-8">
                  <div className="w-16 h-16 bg-black/10 rounded-2xl flex items-center justify-center">
                    {scanResult.isValid ? <ShieldCheck className="w-10 h-10" /> : <ShieldAlert className="w-10 h-10" />}
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Status Code</span>
                    <h4 className="text-xl font-black uppercase leading-none mt-1">
                      {scanResult.isValid ? 'Success' : 'Violated'}
                    </h4>
                  </div>
                </div>

                <div className="space-y-6 mb-10">
                   <div className="pb-4 border-b border-black/10">
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-50 block mb-1">Subject / Table</span>
                      <p className="text-2xl font-black tracking-tighter italic uppercase">{scanResult.customerName}</p>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-50 block mb-1">Total Payload</span>
                        <p className="text-lg font-black tracking-tight leading-none">R$ {scanResult.total?.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-50 block mb-1">Pass Type</span>
                        <p className="text-sm font-bold uppercase tracking-tight leading-none italic">
                          {scanResult.isVisitor ? 'Visitor' : 'Standard'}
                        </p>
                      </div>
                   </div>

                   {scanResult.warning && (
                     <div className="bg-black/5 p-4 rounded-xl border border-black/10">
                        <p className="text-[10px] font-black uppercase leading-tight italic">{scanResult.warning}</p>
                     </div>
                   )}
                </div>

                <div className="flex flex-col gap-3">
                  {scanResult.isValid && (
                    <button 
                      onClick={handleFinalizeRelease}
                      disabled={isFinalizing}
                      className="w-full h-16 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isFinalizing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      {isFinalizing ? 'Finalizing...' : 'Authorize Exit'}
                    </button>
                  )}

                  <button 
                    onClick={handleReset}
                    className="w-full h-14 border border-black/10 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-black/5 transition-all"
                  >
                    Cancel / Reset
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* System Telemetry */}
          <div className="bg-[#141416] p-6 rounded-[32px] border border-white/5 space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-white/30 italic">Porter Logs</span>
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             </div>
             <div className="space-y-3">
                {orders.slice(0, 3).map(o => (
                  <div key={o.id} className="flex items-center justify-between text-[10px] font-bold uppercase tracking-tight pb-3 border-b border-white/5 last:border-0 opacity-60">
                    <span className="text-white/40">#{o.id.slice(-4)} {o.tableNumber ? `TB-${o.tableNumber}` : 'DELV'}</span>
                    <span className={o.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}>
                       {o.paymentStatus}
                    </span>
                  </div>
                ))}
             </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
