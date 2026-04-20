import { useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useStore } from '../../store';

export default function WaiterOrderListener() {
  const setOrders = useStore(state => state.setOrders);

  useEffect(() => {
    console.log("Debug: WaiterOrderListener initializing...");
    const q = query(collection(db, 'orders'));
    const unsub = onSnapshot(q, (snapshot) => {
      console.log("Debug: WaiterOrderListener received snapshot with doc count:", snapshot.size);
      const ordersData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setOrders(ordersData);
    }, (error) => {
      console.error("Debug: WaiterOrderListener failed with code:", error.code, "message:", error.message);
      if (error.code === 'permission-denied') {
        console.error("User Auth State: ", auth.currentUser ? `Signed in as ${auth.currentUser.email}` : "Not signed in");
      }
    });
    return () => unsub();
  }, [setOrders]);

  return null;
}
