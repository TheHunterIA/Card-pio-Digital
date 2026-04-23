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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="thermal-print-container bg-white text-black p-0 font-mono text-[10pt] leading-tight w-full max-w-[80mm] mx-auto overflow-visible">
      {/* Header section - centered and high contrast */}
      <div className="text-center pt-2 pb-4 border-b-2 border-black">
        <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">{config?.restaurantName || 'URBAN PRIME'}</h1>
        <p className="text-[8pt] font-bold">{config?.address || ''}</p>
        <p className="text-[8pt]">Tel: {config?.whatsapp || ''}</p>
      </div>

      {/* Identifiers (Mesa, Pedido, Horário) */}
      <div className="py-4 text-center border-b border-dashed border-black">
        {!isVisitor && order?.type === 'delivery' ? (
          <>
            <p className="text-xl font-black">--- DELIVERY ---</p>
            <p className="text-[11pt] font-black mt-2 uppercase">CLIENTE: {order?.customerName}</p>
            {order?.whatsapp && <p className="text-[10pt]">WHATSAPP: {order?.whatsapp}</p>}
            <p className="text-[9pt] mt-1 italic">PEDIDO: #{order?.id?.substring(0,8)}</p>
          </>
        ) : (
          <>
            <p className="text-lg font-black uppercase">{isVisitor ? 'PASSE VISITANTE' : `COMANDA MESA ${order?.tableNumber || '-'}`}</p>
            <p className="text-[9pt] font-bold mt-1">
              {isVisitor ? `LOCAL: MESA ${tableNumber}` : `ID: #${order?.id?.substring(0,8)}`}
            </p>
            {!isVisitor && order?.customerName && (
               <p className="text-[10pt] font-black uppercase mt-1">CLIENTE: {order.customerName}</p>
            )}
          </>
        )}
        <p className="text-[8pt] mt-2 font-bold">{formatDate(new Date())}</p>
      </div>

      {/* Order items - formatted for thermal width */}
      {!isVisitor && order && (
        <div className="py-4">
          <div className="w-full mb-2 flex border-b border-black font-black text-[8pt]">
            <span className="flex-1">ITEM/PEDIDO</span>
            <span className="w-10 text-center">QTD</span>
            <span className="w-20 text-right">TOTAL</span>
          </div>
          
          <div className="space-y-4">
            {order.items.map((item: any, idx: number) => (
              <div key={idx} className="flex flex-col border-b border-black/5 pb-2">
                <div className="flex text-[10pt]">
                  <span className="flex-1 font-black leading-none">{item.item.name}</span>
                  <span className="w-10 text-center font-bold">x{item.quantity}</span>
                  <span className="w-20 text-right font-black">R$ {(item.item.price * item.quantity).toFixed(2)}</span>
                </div>
                {item.notes && (
                  <p className="text-[8pt] italic mt-1 bg-gray-100 p-1">OBS: {item.notes}</p>
                )}
                {item.selectedExtras?.length > 0 && (
                   <div className="pl-4 mt-1">
                      {item.selectedExtras.map((ex: any, i: number) => (
                         <div key={i} className="flex justify-between text-[8pt] font-bold">
                            <span className="flex-1">+ {ex.name}</span>
                            <span>R$ {ex.price.toFixed(2)}</span>
                         </div>
                      ))}
                   </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-2 border-t-2 border-black flex flex-col items-end gap-1">
            {order.deliveryFee > 0 && (
              <p className="text-[9pt] font-bold">TAXA ENTREGA: R$ {order.deliveryFee.toFixed(2)}</p>
            )}
            <div className="flex justify-between w-full items-baseline">
               <span className="text-lg font-black italic uppercase">Total Final:</span>
               <span className="text-xl font-black">R$ {order.total.toFixed(2)}</span>
            </div>
            <p className="text-[9pt] font-black bg-black text-white px-2 mt-2 uppercase tracking-widest">
               {order.paymentStatus === 'paid' ? 'PAGAMENTO OK' : 'PENDENTE'}
            </p>
          </div>
        </div>
      )}

      {/* QR Code section - high contrast, large enough for thermal reading */}
      {(isVisitor || order?.paymentStatus === 'paid') && (
        <div className="py-6 text-center border-t border-dashed border-black mt-4">
          <p className="text-[9pt] font-black uppercase mb-4 tracking-tighter">{'>>>'} PASSE DE SAÍDA LIBERADO {'<<<'}</p>
          <div className="inline-block bg-white p-4 border-2 border-black">
             <QRCodeSVG value={exitPassToken} size={150} level="H" />
          </div>
          <p className="text-[8pt] mt-4 font-black uppercase">Apresente este ticket na recepção</p>
          {isVisitor && <p className="text-[9pt] mt-1 font-black bg-black text-white px-4 py-1">VISITANTE / CONSUMO ZERO</p>}
        </div>
      )}

      <div className="mt-8 text-center border-t-2 border-black pt-4 pb-12">
        <p className="text-[9pt] font-black">URBAN PRIME - OBRIGADO!</p>
        <p className="text-[8pt]">Volte sempre e compartilhe sua experiência.</p>
      </div>
    </div>
  );
}
