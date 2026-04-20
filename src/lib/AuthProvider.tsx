import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInAnonymously, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDocFromServer, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useStore } from '../store';

import { subscribeToMenu, subscribeToOrders } from './database';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isDriver: boolean;
  isWaiter: boolean;
  isPorteiro: boolean;
  loading: boolean;
  signInAsAdmin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [isWaiter, setIsWaiter] = useState(false);
  const [isPorteiro, setIsPorteiro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Start data subscriptions
    const unsubMenu = subscribeToMenu();
    let unsubOrders: (() => void) | undefined;

    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Clear previous global orders listener if permissions are changing
      if (unsubOrders) {
        unsubOrders();
        unsubOrders = undefined;
      }

      if (currentUser) {
        setUser(currentUser);
        // Check if user is admin or driver
        try {
          const isMasterAdmin = currentUser.email === 'cleitonprado2026@gmail.com';
          let isAdm = isMasterAdmin;
          let isDr = false;
          let isWt = false;
          let isPt = false;
          
          if (!isMasterAdmin) {
            try {
              const adminDoc = await getDocFromServer(doc(db, 'admins', currentUser.uid));
              isAdm = adminDoc.exists();
            } catch (admErr) {
              console.error("Error reading admin doc:", admErr);
            }

            if (!isAdm && currentUser.email) {
              const safeEmail = currentUser.email.toLowerCase().trim();
              try {
                // Checa motorista
                const driverDoc = await getDocFromServer(doc(db, 'authorized_drivers', safeEmail));
                isDr = driverDoc.exists();
                
                // Checa garçom
                const waiterDoc = await getDocFromServer(doc(db, 'authorized_waiters', safeEmail));
                isWt = waiterDoc.exists();

                // Checa porteiro
                const porterDoc = await getDocFromServer(doc(db, 'authorized_porters', safeEmail));
                isPt = porterDoc.exists();
              } catch (staffErr) {
                console.error("Error querying staff collection:", staffErr);
              }
            }
          } else {
            // Master admin acts as staff for testing
            isDr = true;
            isWt = true;
            isPt = true;
            try {
              await setDoc(doc(db, 'admins', currentUser.uid), { email: currentUser.email }, { merge: true });
            } catch (e) {
               console.error("Failed to bootstrap admin record", e);
            }
          }
          
          setIsAdmin(isAdm);
          setIsDriver(isDr);
          setIsWaiter(isWt);
          setIsPorteiro(isPt);
          
          if ((isAdm || isDr || isWt || isPt) && !unsubOrders) {
            unsubOrders = subscribeToOrders();
          }
        } catch (e) {
          setIsAdmin(false);
          setIsDriver(false);
          setIsWaiter(false);
          setIsPorteiro(false);
        }
      } else {
        // Silently sign in anonymously for customers if not already in transition
        setUser(null);
        setIsAdmin(false);
        setIsDriver(false);
        setIsWaiter(false);
        setIsPorteiro(false);
        useStore.getState().setOrders([]);
        
        try {
          // Only attempt if NO current user at all (prevents admin log out issues)
          if (!auth.currentUser) {
            await signInAnonymously(auth);
          }
        } catch (e) {
          // Log only if it's not a restricted operation error (common in dev/admin environments)
          if (e instanceof Error && !e.message.includes('auth/admin-restricted-operation')) {
            console.error("Failed silent anonymous sign in", e);
          }
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      unsubMenu();
      if (unsubOrders) unsubOrders();
    };
  }, []);

  const signInAsAdmin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isDriver, isWaiter, isPorteiro, loading, signInAsAdmin, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
