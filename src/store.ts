import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OrderType = 'dine-in' | 'delivery';
export type OrderStatus = 'na-fila' | 'preparando' | 'saiu-entrega' | 'finalizado' | 'cancelado' | 'pronto-entrega' | 'em-rota' | 'servido';
export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'na-entrega';

export interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface MenuItemExtra {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isActive: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  extras?: MenuItemExtra[];
}

export interface CartItem {
  id: string;
  menuItemId: string;
  quantity: number;
  notes?: string;
  item: MenuItem;
  selectedExtras?: MenuItemExtra[];
}

export interface Order {
  id: string;
  userId: string;
  whatsapp: string;
  customerName: string;
  type: OrderType;
  tableNumber?: string;
  waiterName?: string;
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  deliveryFee?: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus: 'pending' | 'paid';
  rating?: number;
  billRequested?: boolean;
  createdAt: string;
  deliveryCode?: string;
  deviceId?: string;
  sessionId?: string;
  driverId?: string;
  driverName?: string;
  driverLocation?: DriverLocation;
  customerLocation?: { lat: number; lng: number };
}

export interface DeliveryRadius {
  id: string;
  maxDistance: number; // km
  feePerKm: number;
}

export interface PeakHourRule {
  id: string;
  dayOfWeek: number; // 0-6
  startHour: string; // HH:mm
  endHour: string; // HH:mm
  feeMultiplier: number;
}

export interface DeliveryConfig {
  radii: DeliveryRadius[];
  peakHours: PeakHourRule[];
  baseLocation: { lat: number; lng: number };
  freeDeliveryThreshold?: number;
}

interface AppState {
  deviceId: string;
  // Menu
  menu: MenuItem[];
  setMenu: (menu: MenuItem[]) => void;
  
  // Delivery Settings
  deliveryConfig: DeliveryConfig | null;
  setDeliveryConfig: (config: DeliveryConfig) => void;
  
  // Cart & Customer Session
  customerName: string;
  setCustomerName: (name: string) => void;
  whatsapp: string;
  setWhatsapp: (whatsapp: string) => void;
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  tableNumber: string;
  setTableNumber: (table: string) => void;
  address: string;
  setAddress: (address: string) => void;
  addressNumber: string;
  setAddressNumber: (num: string) => void;
  addressComplement: string;
  setAddressComplement: (comp: string) => void;
  cep: string;
  setCep: (cep: string) => void;
  customerLocation: { lat: number; lng: number } | null;
  setCustomerLocation: (loc: { lat: number; lng: number } | null) => void;
  
  requireUpfrontPayment: boolean;
  setRequireUpfrontPayment: (val: boolean) => void;
  
  waiterName: string;
  setWaiterName: (name: string) => void;
  
  cart: CartItem[];
  addToCart: (item: MenuItem, notes?: string, quantity?: number, selectedExtras?: MenuItemExtra[]) => void;
  updateCartItem: (cartItemId: string, item: MenuItem, notes?: string, quantity?: number, selectedExtras?: MenuItemExtra[]) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  
  // Orders (KDS)
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  currentOrderId: string | null;
  setCurrentOrderId: (id: string | null) => void;

  // Driver
  isDriver: boolean;
  setIsDriver: (is: boolean) => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  couponDiscount: number;
  setCouponDiscount: (discount: number) => void;
  isFreeDeliveryCoupon: boolean;
  setIsFreeDeliveryCoupon: (val: boolean) => void;

  // Sessions & Real-time Sharing
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  sessionItems: CartItem[];
  setSessionItems: (items: CartItem[]) => void;
}

export const initialMenu: MenuItem[] = [
  {
    id: '1',
    name: 'Smash Burger Duplo',
    description: 'Pão brioche, 2x blend 90g, muito cheddar, bacon crocante e molho da casa.',
    price: 34.90,
    category: 'Lanches',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800&h=600',
    isActive: true
  },
  {
    id: '2',
    name: 'Classic Burger',
    description: 'Pão gergelim, blend 160g, alface, tomate, queijo prato e maionese verde.',
    price: 28.90,
    category: 'Lanches',
    image: 'https://images.unsplash.com/photo-1594212202875-5eb19e98e294?auto=format&fit=crop&q=80&w=800&h=600',
    isActive: true
  },
  {
    id: '3',
    name: 'Batata Frita Rústica',
    description: 'Porção de 300g de batata rústica com páprica.',
    price: 18.00,
    category: 'Acompanhamentos',
    image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&q=80&w=800&h=600',
    isActive: true
  },
  {
    id: '4',
    name: 'Coca-Cola Lata 350ml',
    description: 'Refrigerante gelado.',
    price: 6.50,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=800&h=600',
    isActive: true
  },
  {
    id: '5',
    name: 'Suco de Laranja Natural',
    description: '400ml de suco natural da fruta, sem açúcar.',
    price: 9.00,
    category: 'Bebidas',
    image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&q=80&w=800&h=600',
    isActive: true
  }
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
  deviceId: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
  menu: [],
  setMenu: (menu) => set({ menu }),

  customerName: '',
  setCustomerName: (name) => set({ customerName: name }),
  whatsapp: '',
  setWhatsapp: (whatsapp) => set({ whatsapp }),
  orderType: 'delivery',
  setOrderType: (type) => set({ orderType: type }),
  tableNumber: '',
  setTableNumber: (table) => set({ tableNumber: table }),
  waiterName: '',
  setWaiterName: (name) => set({ waiterName: name }),
  requireUpfrontPayment: false,
  setRequireUpfrontPayment: (val) => set({ requireUpfrontPayment: val }),
  address: '',
  setAddress: (address) => set({ address: address }),
  addressNumber: '',
  setAddressNumber: (addressNumber) => set({ addressNumber }),
  addressComplement: '',
  setAddressComplement: (addressComplement) => set({ addressComplement }),
  cep: '',
  setCep: (cep) => set({ cep }),
  customerLocation: null,
  setCustomerLocation: (loc) => set({ customerLocation: loc }),
  
  cart: [],
  addToCart: (item, notes, quantity = 1, selectedExtras = []) => set((state) => {
    // If exact item + notes + extras exists, increase qty
    const extrasKey = selectedExtras.map(e => e.id).sort().join(',');
    const existing = state.cart.find(c => {
      const cExtrasKey = (c.selectedExtras || []).map(e => e.id).sort().join(',');
      return c.menuItemId === item.id && c.notes === (notes || '') && cExtrasKey === extrasKey;
    });

    if (existing) {
      return {
        cart: state.cart.map(c => c.id === existing.id ? { ...c, quantity: c.quantity + quantity } : c)
      };
    }
    return {
      cart: [...state.cart, { 
        id: Math.random().toString(36).substr(2, 9), 
        menuItemId: item.id, 
        quantity, 
        notes: notes || '', 
        item,
        selectedExtras
      }]
    };
  }),
  removeFromCart: (cartItemId) => set((state) => ({
    cart: state.cart.filter(c => c.id !== cartItemId)
  })),
  updateCartItem: (cartItemId, item, notes, quantity, selectedExtras = []) => set((state) => ({
    cart: state.cart.map(c => c.id === cartItemId ? {
      ...c,
      item,
      notes: notes || '',
      quantity,
      selectedExtras
    } : c)
  })),
  clearCart: () => set({ cart: [], couponCode: '', couponDiscount: 0, isFreeDeliveryCoupon: false }),
  
  orders: [],
  setOrders: (orders) => set({ orders }),
  currentOrderId: null,
  setCurrentOrderId: (id) => set({ currentOrderId: id }),

  isDriver: false,
  setIsDriver: (is) => set({ isDriver: is }),
  couponCode: '',
  setCouponCode: (code) => set({ couponCode: code }),
  couponDiscount: 0,
  setCouponDiscount: (discount) => set({ couponDiscount: discount }),
  isFreeDeliveryCoupon: false,
  setIsFreeDeliveryCoupon: (val) => set({ isFreeDeliveryCoupon: val }),

  deliveryConfig: null,
  setDeliveryConfig: (deliveryConfig) => set({ deliveryConfig }),

  currentSessionId: null,
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  sessionItems: [],
  setSessionItems: (items) => set({ sessionItems: items }),
    }),
    {
      name: 'digital-menu-cart',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // If the state is from the old version (unversioned), clear cart and related info
          // to prevent the reported white screen crashes
          return {
            ...persistedState,
            cart: [],
            couponCode: '',
            couponDiscount: 0,
            isFreeDeliveryCoupon: false,
            currentOrderId: null,
            currentSessionId: null
          };
        }
        return persistedState;
      },
      partialize: (state) => ({
        deviceId: state.deviceId,
        cart: state.cart,
        customerName: state.customerName,
        whatsapp: state.whatsapp,
        address: state.address,
        cep: state.cep,
        tableNumber: state.tableNumber,
        waiterName: state.waiterName,
        orderType: state.orderType,
        currentOrderId: state.currentOrderId,
        couponCode: state.couponCode,
        couponDiscount: state.couponDiscount,
        isFreeDeliveryCoupon: state.isFreeDeliveryCoupon,
        currentSessionId: state.currentSessionId,
      })
    }
  )
);
