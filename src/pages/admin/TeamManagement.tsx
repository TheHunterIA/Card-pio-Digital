import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { ShieldCheck, Trash2, UserPlus, Mail, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../lib/AuthProvider';

interface StaffMember {
  email: string;
  name: string;
  role: 'waiter' | 'driver' | 'porter' | 'admin' | 'kitchen';
}

export default function TeamManagement() {
  const { isMasterAdmin } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'waiter' | 'driver' | 'porter' | 'admin' | 'kitchen'>('waiter');

  useEffect(() => {
    console.log("TeamManagement: Setting up snapshot listener for authorized_staff");
    const unsub = onSnapshot(collection(db, 'authorized_staff'), (snapshot) => {
      console.log("TeamManagement: Loaded staff with count:", snapshot.size);
      setStaff(snapshot.docs.map(doc => doc.data() as StaffMember));
    }, (error) => {
      console.error("TeamManagement: Snapshot error code:", error.code, "message:", error.message);
      if (error.code === 'permission-denied') {
         // Check if user is authenticated at all
         console.error("TeamManagement: User UID:", auth.currentUser?.uid || "Not logged in");
      }                
    });
    return unsub;
  }, []);

  const addStaff = async () => {
    if (!email || !name) return;
    const safeEmail = email.toLowerCase().trim();
    
    // Escreve na coleção principal para a lista da UI
    await setDoc(doc(db, 'authorized_staff', safeEmail), { email: safeEmail, name, role, createdAt: new Date().toISOString() });
    
    // Escreve na coleção específica de regra para o firebase.rules aprovar o backend
    if (role === 'admin' && isMasterAdmin) {
      await setDoc(doc(db, 'authorized_admins', safeEmail), { email: safeEmail, name, addedAt: new Date().toISOString() });
    } else if (role === 'driver') {
      await setDoc(doc(db, 'authorized_drivers', safeEmail), { email: safeEmail, name, addedAt: new Date().toISOString() });
    } else if (role === 'waiter') {
      await setDoc(doc(db, 'authorized_waiters', safeEmail), { email: safeEmail, name, addedAt: new Date().toISOString() });
    } else if (role === 'porter') {
      await setDoc(doc(db, 'authorized_porters', safeEmail), { email: safeEmail, name, addedAt: new Date().toISOString() });
    } else if (role === 'kitchen') {
      await setDoc(doc(db, 'authorized_kitchen', safeEmail), { email: safeEmail, name, addedAt: new Date().toISOString() });
    }
    
    setEmail('');
    setName('');
  };

  const removeStaff = async (member: StaffMember) => {
    const safeEmail = member.email.toLowerCase().trim();
    await deleteDoc(doc(db, 'authorized_staff', safeEmail));
    
    if (member.role === 'admin' && isMasterAdmin) {
      await deleteDoc(doc(db, 'authorized_admins', safeEmail));
    } else if (member.role === 'driver') {
      await deleteDoc(doc(db, 'authorized_drivers', safeEmail));
    } else if (member.role === 'waiter') {
      await deleteDoc(doc(db, 'authorized_waiters', safeEmail));
    } else if (member.role === 'porter') {
      await deleteDoc(doc(db, 'authorized_porters', safeEmail));
    } else if (member.role === 'kitchen') {
      await deleteDoc(doc(db, 'authorized_kitchen', safeEmail));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck /> Gestão de Equipe</h1>
        {isMasterAdmin && (
          <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Conta Super Admin
          </div>
        )}
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
        <h2 className="font-bold mb-4">Adicionar Membro</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="border p-2 rounded" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
          <select className="border p-2 rounded" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="waiter">Garçom</option>
            <option value="driver">Entregador</option>
            <option value="porter">Porteiro</option>
            <option value="kitchen">Cozinha</option>
            {isMasterAdmin && <option value="admin">Admin do Sistema</option>}
          </select>
          <button className="bg-brand text-white p-2 rounded flex justify-center items-center" onClick={addStaff}>
            <UserPlus />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="font-bold mb-4">Equipe Autorizada {isMasterAdmin && '& Administradores'}</h2>
        {staff.map(member => (
          <div key={member.email} className="flex justify-between items-center border-b border-black/5 py-4 last:border-0 border-[0.5px]">
            <div className="flex flex-col">
              <span className="font-bold text-ink">{member.name}</span>
              <span className="text-sm text-ink-muted">{member.email}</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md ${
                member.role === 'admin' ? 'bg-amber-100 text-amber-800' :
                member.role === 'driver' ? 'bg-blue-100 text-blue-800' :
                member.role === 'waiter' ? 'bg-green-100 text-green-800' :
                member.role === 'kitchen' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {member.role === 'kitchen' ? 'Cozinha' : member.role}
              </span>
              {(isMasterAdmin || member.role !== 'admin') && (
                <button className="text-ink-muted hover:text-red-500 transition-colors bg-oat hover:bg-red-50 p-2 rounded-xl" onClick={() => removeStaff(member)}>
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
