import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/AuthProvider';
import CustomerLayout from './pages/customer/CustomerLayout';
import Welcome from './pages/customer/Welcome';
import Menu from './pages/customer/Menu';
import ScrollToTop from './components/ScrollToTop';
import ProductDetails from './pages/customer/ProductDetails';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import OrderStatus from './pages/customer/OrderStatus';
import Orders from './pages/customer/Orders';

import AdminLayout from './pages/admin/AdminLayout';
import MenuSettings from './pages/admin/MenuSettings';
import FleetMap from './pages/admin/FleetMap';
import TeamManagement from './pages/admin/TeamManagement';
import LogisticsSettings from './pages/admin/LogisticsSettings';
import QRCodes from './pages/admin/QRCodes';
import Customers from './pages/admin/Customers';
import Settings from './pages/admin/Settings';
import Financial from './pages/admin/Financial';
import AdminLogin from './pages/admin/AdminLogin';

import KitchenLayout from './pages/kitchen/KitchenLayout';
import KitchenDashboard from './pages/kitchen/KitchenDashboard';
import KitchenLogin from './pages/kitchen/KitchenLogin';

import DriverLayout from './pages/driver/DriverLayout';
import DriverDashboard from './pages/driver/DriverDashboard';
import DriverLogin from './pages/driver/DriverLogin';

import WaiterLayout from './pages/waiter/WaiterLayout';
import WaiterDashboard from './pages/waiter/WaiterDashboard';
import WaiterOrder from './pages/waiter/WaiterOrder';
import WaiterBill from './pages/waiter/WaiterBill';                
import WaiterLogin from './pages/waiter/WaiterLogin';

import PorterLayout from './pages/porter/PorterLayout';
import PorterDashboard from './pages/porter/PorterDashboard';
import PorterLogin from './pages/porter/PorterLogin';

export default function App() {
  React.useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Customer PWA Routes */}
          <Route path="/" element={<CustomerLayout />}>
            <Route index element={<Welcome />} />
            <Route path="cardapio" element={<Menu />} />
            <Route path="produto/:id" element={<ProductDetails />} />
            <Route path="carrinho" element={<Cart />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="status" element={<OrderStatus />} />
            <Route path="pedidos" element={<Orders />} />
            <Route path="historico" element={<Navigate to="/pedidos" replace />} />
          </Route>
          
          {/* Lojista / KDS Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/cardapio" replace />} />
            <Route path="cardapio" element={<MenuSettings />} />
            <Route path="logistica" element={<LogisticsSettings />} />
            <Route path="frota" element={<FleetMap />} />
            <Route path="equipe" element={<TeamManagement />} />
            <Route path="entregadores" element={<Navigate to="/admin/equipe" replace />} />
            <Route path="clientes" element={<Customers />} />
            <Route path="financeiro" element={<Financial />} />
            <Route path="qrcode" element={<QRCodes />} />
            <Route path="config" element={<Settings />} />
          </Route>

          {/* Cozinha Routes */}
          <Route path="/cozinha/login" element={<KitchenLogin />} />
          <Route path="/cozinha" element={<KitchenLayout />}>
            <Route index element={<KitchenDashboard />} />
          </Route>

          {/* Entregador Routes */}
          <Route path="/entregador/login" element={<DriverLogin />} />
          <Route path="/entregador" element={<DriverLayout />}>
            <Route index element={<DriverDashboard />} />
          </Route>

          {/* Garçom Routes */}
          <Route path="/garcom/login" element={<WaiterLogin />} />
          <Route path="/garcom" element={<WaiterLayout />}>
            <Route index element={<WaiterDashboard />} />
            <Route path="mesa/:tableId" element={<WaiterOrder />} />
            <Route path="comanda/:tableId" element={<WaiterBill />} />
          </Route>

          {/* Porteiro Routes */}
          <Route path="/portaria/login" element={<PorterLogin />} />
          <Route path="/portaria" element={<PorterLayout />}>
            <Route index element={<PorterDashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
