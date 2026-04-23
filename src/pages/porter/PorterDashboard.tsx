import React, { useState, useEffect, useMemo } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
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

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  const tables = useMemo(() => {
    if (!config) return [];
    const count = config?.tablesCount || 10; // Default to 10 if not set
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

  useEffect(() => {
    if (!scanning || viewMode !== 'scanner') return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    const onScanSuccess = async (decodedText: string) => {
      scanner.clear();
      setScanning(false);
      validatePass(decodedText);
    };

    scanner.render(onScanSuccess, (err) => {
      // Ignore phantom errors
    });

    return () => {
      scanner.clear().catch(e => console.error("Scanner clear error", e));
    };
  }, [scanning]);

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
    <div className="space-y-6">
      {/* Porter Navigation */}
      <div className="max-w-4xl mx-auto px-6 pt-4">
        <div className="bg-white rounded-3xl p-2 shadow-sm border border-black/5 flex gap-2">
          <button 
            onClick={() => { setViewMode('scanner'); handleReset(); }}
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-display font-black uppercase tracking-widest text-[10px] transition-all ${
              viewMode === 'scanner' ? 'bg-ink text-white shadow-lg' : 'bg-transparent text-ink-muted hover:bg-oat'
            }`}
          >
            <QrCode className="w-5 h-5" /> Scanner
          </button>
          <button 
            onClick={() => { setViewMode('tables'); handleReset(); }}
            className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-display font-black uppercase tracking-widest text-[10px] transition-all ${
              viewMode === 'tables' ? 'bg-ink text-white shadow-lg' : 'bg-transparent text-ink-muted hover:bg-oat'
            }`}
          >
            <LayoutGrid className="w-5 h-5" /> Gestão de Mesas
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-start p-6 max-w-4xl mx-auto space-y-8">
        
        {/* Left Side: Scanner or Tables Grid */}
        <div className="space-y-6">
          {viewMode === 'scanner' ? (
            <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-xl overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display font-bold text-ink flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-blue-600" /> Scanner de Saída
                </h2>
                {scanning && (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Ativo</span>
                  </div>
                )}
              </div>

              <div id="reader" className={`${!scanning ? 'hidden' : ''} rounded-3xl overflow-hidden border-2 border-dashed border-black/10`} />
              
              {!scanning && (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                   <button 
                    onClick={handleReset}
                    className="bg-ink text-white px-8 py-4 rounded-2xl font-display font-bold uppercase tracking-widest text-xs flex items-center gap-3 active:scale-95 transition-all shadow-xl"
                   >
                     <RefreshCw className="w-4 h-4" /> Novo Escaneamento
                   </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-[40px] p-8 border border-black/5 shadow-xl overflow-hidden relative min-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display font-bold text-ink flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-brand" /> Gestão de Mesas
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {tables.map(table => {
                   const tableOrders = activeOrdersByTable[table.id] || [];
                   const isOccupied = tableOrders.length > 0;
                   const hasPending = tableOrders.some(o => o.paymentStatus !== 'paid');
                   const hasReady = tableOrders.some(o => o.status === 'pronto-entrega' || o.status === 'saiu-entrega');

                   return (
                     <motion.button
                       key={table.id}
                       whileHover={{ scale: 1.05 }}
                       whileTap={{ scale: 0.95 }}
                       onClick={() => handleTableClick(table.id)}
                       className={`aspect-square rounded-3xl border-2 flex flex-col items-center justify-center gap-1 transition-all relative ${
                         hasReady 
                           ? 'bg-brand border-brand text-white shadow-lg animate-pulse'
                           : hasPending 
                             ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm'
                             : isOccupied 
                               ? 'bg-ink border-ink text-white shadow-md'
                               : 'bg-oat/50 border-black/5 text-ink-muted hover:border-brand/30'
                       }`}
                     >
                        <span className="font-display font-black text-2xl">{table.id}</span>
                        <div className="flex gap-1">
                          {hasPending && <ShieldAlert className="w-3 h-3" />}
                          {isOccupied && !hasPending && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className="text-[7px] font-black uppercase tracking-widest mt-1 opacity-60">
                           {hasReady ? 'Pronto' : hasPending ? 'Pendente' : isOccupied ? 'Ativa' : 'Livre'}
                        </span>
                     </motion.button>
                   );
                })}
              </div>
            </div>
          )}

          <div className="bg-white/50 border border-black/5 rounded-[32px] p-6 text-[11px] font-medium text-ink-muted leading-relaxed">
            <ShieldCheck className="w-4 h-4 mb-2 opacity-50" />
            <p>Este terminal valida apenas tokens <strong>Urban Prime</strong> gerados no dia corrente. Se o cliente apresentar um print antigo, o sistema acusará expiração automaticamente.</p>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {validating ? (
              <motion.div 
                key="validating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-[40px] p-12 text-center border border-black/5 shadow-xl"
              >
                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-6" />
                <p className="font-display font-bold text-ink uppercase tracking-widest text-sm">Validando Token...</p>
              </motion.div>
            ) : error ? (
              <motion.div 
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 rounded-[40px] p-10 border border-red-100 text-center shadow-xl shadow-red-500/5"
              >
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[32px] flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-display font-black text-red-600 mb-2 tracking-tight italic uppercase">ACESSO NEGADO</h3>
                <p className="text-red-500 font-bold mb-8">{error}</p>
                <button 
                  onClick={handleReset}
                  className="w-full bg-red-600 text-white h-14 rounded-2xl font-display font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all"
                >
                  Tentar Novamente
                </button>
              </motion.div>
            ) : scanResult ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-[40px] p-10 border text-center shadow-2xl relative overflow-hidden ${
                  scanResult.isValid ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
                }`}
              >
                {/* Header Decoration */}
                <div className={`absolute top-0 left-0 w-full h-2 ${scanResult.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`} />

                <div className={`w-24 h-24 rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-inner ${
                  scanResult.isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {scanResult.isValid ? <CheckCircle2 className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
                </div>

                <h3 className={`text-4xl font-display font-black mb-1 tracking-tighter italic ${
                  scanResult.isValid ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {scanResult.isValid ? 'LIBERADO' : 'BLOQUEADO'}
                </h3>
                <p className={`font-display font-bold text-xs uppercase tracking-[0.2em] mb-8 ${
                  scanResult.isValid ? 'text-emerald-600' : 'text-amber-600'
                }`}>
                  {scanResult.isVisitor ? 'VISITANTE - CONSUMO ZERO' : (scanResult.isValid ? 'SAÍDA AUTORIZADA' : scanResult.error)}
                </p>

                {scanResult.warning && (
                  <div className="bg-amber-100/50 border border-amber-200 text-amber-800 p-4 rounded-2xl mb-6 text-xs font-bold uppercase tracking-widest text-left flex gap-3">
                    <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                    <span>{scanResult.warning}</span>
                  </div>
                )}

                {/* Details Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5 text-left space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center text-ink-muted">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Cliente</p>
                      <p className="font-display font-bold text-ink">{scanResult.customerName}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center text-ink-muted">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Local</p>
                      <p className="font-display font-bold text-ink">Mesa {scanResult.tableNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-black/5">
                    <div className="w-10 h-10 bg-oat rounded-xl flex items-center justify-center text-ink-muted">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">Valor do Pedido</p>
                      <p className="font-display font-bold text-ink">R$ {scanResult.total?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-10">
                  {scanResult.isValid && (
                    <button 
                      onClick={handleFinalizeRelease}
                      disabled={isFinalizing}
                      className="w-full h-16 bg-emerald-600 text-white rounded-2xl font-display font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isFinalizing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                      {isFinalizing ? 'FINALIZANDO...' : 'CONFIRMAR LIBERAÇÃO'}
                    </button>
                  )}

                  <button 
                    onClick={handleReset}
                    className={`w-full h-14 rounded-2xl font-display font-bold uppercase tracking-widest text-[10px] active:scale-95 transition-all border-2 ${
                      scanResult.isValid 
                        ? 'border-emerald-600/20 text-emerald-700 bg-white' 
                        : 'bg-amber-600 text-white shadow-lg'
                    }`}
                  >
                    {scanResult.isValid ? 'VOLTAR AO SCANNER' : 'OK - PRÓXIMO CLIENTE'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-oat/50 border-2 border-dashed border-black/5 rounded-[40px] p-20 text-center"
              >
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                   <QrCode className="w-8 h-8 text-ink-muted/30" />
                </div>
                <h3 className="font-display font-bold text-ink-muted text-sm uppercase tracking-widest">Aguardando Leitura...</h3>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
