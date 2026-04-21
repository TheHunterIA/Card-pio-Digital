import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PrintTicketProps {
  order?: any;
  config?: any;
  isVisitor?: boolean;
  tableNumber?: string;
  visitorId?: string;
}

export default function PrintTicket({ order, config, isVisitor, tableNumber, visitorId }: PrintTicketProps) {
  const today = new Date().toISOString().split('T')[0];
  const exitPassToken = isVisitor 
    ? `UP_PASS_VISITOR_${tableNumber}_${today}_${visitorId || ''}` 
    : `UP_PASS_${order?.id}_${today}`;

  return (
    <div className="print-only bg-white text-black p-4 font-mono text-[12px] w-[80mm] mx-auto border border-dashed border-gray-300">
      <div className="text-center mb-4 border-b border-dashed border-black pb-4">
        <h1 className="text-xl font-bold uppercase tracking-tight">{config?.restaurantName || 'URBAN PRIME'}</h1>
        <p className="text-[10px]">{config?.address || ''}</p>
        <p className="text-[10px]">WhatsApp: {config?.whatsapp || ''}</p>
      </div>

      <div className="mb-4 text-center">
        {!isVisitor && order?.type === 'delivery' ? (
          <>
            <p className="text-lg font-bold">DELIVERY</p>
            <p className="text-[10px] font-bold">Cliente: {order?.customerName}</p>
            {order?.whatsapp && <p className="text-[10px]">WhatsApp: {order?.whatsapp}</p>}
            {order?.address && <p className="text-[10px]">End: {order?.address}, {order?.addressNumber} {order?.addressComplement ? ` - ${order?.addressComplement}` : ''}</p>}
            <p className="text-[10px] mt-1">Pedido: #{order?.id?.substring(0,6)}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold">{isVisitor ? 'PASSE DE VISITANTE' : `COMANDA MESA ${order?.tableNumber || '-'}`}</p>
            <p className="text-[10px]">{isVisitor ? `MESA ${tableNumber}` : `Pedido: #${order?.id?.substring(0,6)}`}</p>
            {!isVisitor && order?.customerName && <p className="text-[10px]">Cliente: {order.customerName}</p>}
          </>
        )}
        <p className="text-[10px] mt-1">{new Date().toLocaleString('pt-BR')}</p>
      </div>

      {!isVisitor && order && (
        <>
          <div className="border-b border-dashed border-black mb-4">
            <table className="w-full mb-4">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1">Item</th>
                  <th className="py-1 text-center">Qtd</th>
                  <th className="py-1 text-right">Preço</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item: any, idx: number) => (
                  <tr key={idx} className="border-b border-gray-100 last:border-0">
                    <td className="py-2">{item.item.name}</td>
                    <td className="py-2 text-center">{item.quantity}</td>
                    <td className="py-2 text-right">R$ {(item.item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-right mb-6">
            {order.deliveryFee > 0 && (
              <p className="text-[10px]">Taxa de Entrega: R$ {order.deliveryFee.toFixed(2)}</p>
            )}
            <p className="text-base font-bold uppercase">Total: R$ {order.total.toFixed(2)}</p>
            <p className="text-[10px]">{order.paymentStatus === 'paid' ? 'PAGAMENTO CONFIRMADO' : 'PENDENTE DE PAGAMENTO'}</p>
          </div>
        </>
      )}

      {(isVisitor || order?.paymentStatus === 'paid') && (
        <div className="text-center border-t border-dashed border-black pt-6">
          <p className="text-[10px] font-bold uppercase mb-2">Passe de Saída Liberado</p>
          <div className="inline-block bg-white p-2 border border-black rounded">
             <QRCodeSVG value={exitPassToken} size={100} />
          </div>
          <p className="text-[9px] mt-2 italic">Apresente este Ticket na recepção para liberar sua saída.</p>
          {isVisitor && <p className="text-[8px] mt-1 text-gray-500 font-bold uppercase">Consumo Zero / Visitante</p>}
        </div>
      )}

      <div className="mt-8 text-center text-[10px]">
        <p>Agradecemos pela preferência!</p>
        <p>Volte Sempre ao Urban Prime.</p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .print-only { display: none; }
        }
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100% !important; margin: 0 !important; padding: 10mm !important; }
          @page { margin: 0; }
          body { background: white !important; }
        }
      `}} />
    </div>
  );
}
