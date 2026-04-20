import { collection, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { handleFirestoreError } from './firebaseError';
import { MenuItem, Order, OrderStatus, PaymentMethod, useStore, CartItem } from '../store';

// Set up listeners that directly sync into the Zustand store
export function subscribeToMenu() {
  const q = query(collection(db, 'menu'));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
    useStore.getState().setMenu(items);
  }, (error) => {
    console.error("Menu sync error:", error);
  });
}

export function subscribeToOrders() {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  let isInitialRender = true;

  return onSnapshot(q, (snapshot) => {
    // Alerta sonoro de painel estilo "Ring" quando novo pedido entra
    if (!isInitialRender) {
      const hasNewOrders = snapshot.docChanges().some(change => change.type === 'added');
      if (hasNewOrders) {
        // Sino de balcão clássico
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio autoplay blocked by browser', e));
      }
    }
    isInitialRender = false;

    const orders = snapshot.docs.map(d => {
      const data = d.data();
      return { 
        id: d.id, 
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()
      } as Order;
    });
    useStore.getState().setOrders(orders);
  }, (error) => {
    console.error("Orders sync error:", error);
  });
}

// Menu Actions
export async function addMenuItem(item: Omit<MenuItem, 'id' | 'isActive'>) {
  const newRef = doc(collection(db, 'menu'));
  try {
    await setDoc(newRef, { ...item, isActive: true });
  } catch (error) {
    handleFirestoreError(error, 'create', `menu/${newRef.id}`, auth.currentUser);
  }
}

export async function toggleMenuItem(id: string, currentStatus: boolean) {
  try {
    const ref = doc(db, 'menu', id);
    await updateDoc(ref, { isActive: !currentStatus });
  } catch (error) {
    handleFirestoreError(error, 'update', `menu/${id}`, auth.currentUser);
  }
}

export async function deleteMenuItem(id: string) {
  try {
    const ref = doc(db, 'menu', id);
    await deleteDoc(ref);
  } catch (error) {
    handleFirestoreError(error, 'delete', `menu/${id}`, auth.currentUser);
  }
}

export async function updateMenuPrice(id: string, newPrice: number) {
  try {
    const ref = doc(db, 'menu', id);
    await updateDoc(ref, { price: newPrice });
  } catch (error) {
    handleFirestoreError(error, 'update', `menu/${id}`, auth.currentUser);
  }
}

export async function updateMenuItem(id: string, item: Partial<MenuItem>) {
  try {
    const ref = doc(db, 'menu', id);
    const { id: _, ...data } = item as any;
    await updateDoc(ref, data);
  } catch (error) {
    handleFirestoreError(error, 'update', `menu/${id}`, auth.currentUser);
  }
}

// Client Actions
export async function syncClientProfile() {
  const state = useStore.getState();
  const user = auth.currentUser;
  if (!user || !state.whatsapp) return;

  const clientRef = doc(db, 'clientes', state.whatsapp);
  try {
    await setDoc(clientRef, {
      name: state.customerName,
      whatsapp: state.whatsapp,
      uid: user.uid,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Failed to sync client profile", error);
  }
}

export function subscribeToSession(sessionId: string) {
  const q = query(collection(db, 'sessions', sessionId, 'orders'));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    // Flatten all items from orders in this session
    const allItems: CartItem[] = [];
    orders.forEach(o => {
      o.items.forEach(item => {
        allItems.push(item);
      });
    });
    useStore.getState().setSessionItems(allItems);
  }, (error) => {
    console.error("Session sync error:", error);
  });
}

// Order Actions
export async function placeOrder(paymentMethod: PaymentMethod): Promise<string> {
  const state = useStore.getState();
  const user = auth.currentUser;
  const orderId = Math.random().toString(36).substr(2, 9).toUpperCase();
  const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
  const subtotal = state.cart.reduce((sum, c) => {
    const extrasPrice = (c.selectedExtras || []).reduce((acc, e) => acc + e.price, 0);
    return sum + ((c.item.price + extrasPrice) * c.quantity);
  }, 0);
  const discount = subtotal * (state.couponDiscount / 100);
  const total = subtotal - discount;
  
  // Sync profile before order
  await syncClientProfile();

  // Increment coupon usage if exists
  if (state.couponCode && user) {
    const usageId = `${user.uid}_${state.couponCode}`;
    const usageRef = doc(db, 'couponUsage', usageId);
    const usageSnap = await getDoc(usageRef);
    if (usageSnap.exists()) {
      await updateDoc(usageRef, {
          count: usageSnap.data().count + 1,
          updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(usageRef, {
          uid: user.uid,
          code: state.couponCode,
          count: 1,
          updatedAt: serverTimestamp()
      });
    }
  }

  const deviceId = state.deviceId || 'anonymous-device';
  const sessionId = state.currentSessionId || (state.orderType === 'dine-in' && state.tableNumber ? `table-${state.tableNumber}` : null);

  const newOrder = {
    userId: user?.uid || deviceId,
    deviceId: deviceId, // Explicit device lock
    ...(state.whatsapp && state.whatsapp.length >= 8 ? { whatsapp: state.whatsapp } : {}),
    customerName: state.customerName || 'Cliente',
    type: state.orderType,
    ...(state.tableNumber ? { tableNumber: state.tableNumber } : {}),
    ...(state.waiterName ? { waiterName: state.waiterName } : {}),
    ...(state.address ? { address: state.address } : {}),
    ...(state.addressNumber ? { addressNumber: state.addressNumber } : {}),
    ...(state.addressComplement ? { addressComplement: state.addressComplement } : {}),
    ...(state.customerLocation ? { customerLocation: state.customerLocation } : {}),
    items: state.cart,
    subtotal,
    discount,
    couponCode: state.couponCode || null,
    total,
    status: 'na-fila',
    paymentMethod,
    paymentStatus: paymentMethod === 'na-entrega' ? 'pending' : (['pix', 'credit', 'debit'].includes(paymentMethod) ? 'pending' : 'paid'),
    createdAt: serverTimestamp(),
    deliveryCode,
    sessionId: sessionId
  };

  try {
    // If it's a table order, we also track it in the session
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      await setDoc(sessionRef, {
        tableNumber: state.tableNumber,
        status: 'open',
        lastActivity: serverTimestamp(),
        // Tie original device to session for lock
        ownerDeviceId: state.deviceId
      }, { merge: true });

      // Add to session subcollection for real-time sync
      await setDoc(doc(db, 'sessions', sessionId, 'orders', orderId), newOrder);
      
      // Also update store to track session
      state.setCurrentSessionId(sessionId);
    }

    await setDoc(doc(db, 'orders', orderId), newOrder);
    
    // Clear cart locally
    useStore.getState().clearCart();
    useStore.getState().setCurrentOrderId(orderId);
    
    // Simulate real-time Payment Gateway drop for demo purposes
    if (['pix', 'credit', 'debit'].includes(paymentMethod)) {
      setTimeout(async () => {
        try {
          await confirmPayment(orderId);
        } catch (e) {
          // ignore automated confirm error if already updated by admin
        }
      }, 5000);
    }
    
    return orderId;
  } catch (error) {
    handleFirestoreError(error, 'create', `orders/${orderId}`, auth.currentUser);
    return '';
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { 
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

export async function confirmPayment(orderId: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { 
      paymentStatus: 'paid',
      updatedAt: serverTimestamp() 
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

// Logistics Actions
export async function acceptDelivery(orderId: string, driverId: string, driverName: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'em-rota',
      driverId,
      driverName,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

export async function updateDriverLocation(orderId: string, lat: number, lng: number) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      driverLocation: {
        lat,
        lng,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

export async function completeDelivery(orderId: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'finalizado',
      paymentStatus: 'paid', // Assume paid on completion
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

export async function finalizeOrder(orderId: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status: 'finalizado',
      paymentStatus: 'paid',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}

export async function markManualPayment(orderId: string) {
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentStatus: 'paid',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `orders/${orderId}`, auth.currentUser);
  }
}
