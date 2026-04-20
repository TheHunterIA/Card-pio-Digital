import React from 'react';
import { Outlet, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/AuthProvider';
import { useStore } from '../../store';
import { LogOut, Coffee, ArrowLeft } from 'lucide-react';
import WaiterOrderListener from '../../components/waiter/WaiterOrderListener';

export default function WaiterLayout() {
  const { user, isWaiter, isAdmin, logout, loading } = useAuth();
  const setWaiterName = useStore(state => state.setWaiterName);
  const navigate = useNavigate();
  const location = useLocation();

  // If still loading auth state, show nothing or a spinner
  if (loading) return null;

  // If not authenticated as waiter/admin, redirect to login
  if (!user || (!isWaiter && !isAdmin)) {
    return <Navigate to="/garcom/login" replace />;
  }

  const displayName = user.displayName || user.email?.split('@')[0] || 'Garçom';

  // Ensure waiterName is synced in the store for order identification
  // This is a side effect, but simplifies existing placeOrder logic
  React.useEffect(() => {
    setWaiterName(displayName);
  }, [displayName, setWaiterName]);

  return (
    <div className="min-h-screen bg-oat flex flex-col">
      <header className="bg-white h-20 border-b border-black/5 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 bg-oat rounded-xl text-ink-muted hover:bg-black/5 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-brand text-white rounded-xl flex items-center justify-center font-display font-black text-lg">
            {displayName.charAt(0)}
          </div>
          <div>
            <h1 className="font-display font-bold text-ink text-sm leading-tight uppercase tracking-tight">{displayName}</h1>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Equipe Urban Prime</p>
          </div>
        </div>
        
        <button 
          onClick={async () => {
            await logout();
            setWaiterName('');
            navigate('/garcom/login');
          }}
          className="p-3 bg-oat rounded-xl text-ink-muted hover:text-red-500 transition-colors border border-black/5"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 pb-24">
        <WaiterOrderListener />
        <Outlet />
      </main>
    </div>
  );
}
