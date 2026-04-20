import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { ShieldCheck, Trash2, UserPlus, Mail } from 'lucide-react';

interface StaffMember {
  email: string;
  name: string;
  role: 'waiter' | 'driver' | 'porter' | 'admin';
}

export default function TeamManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'waiter' | 'driver' | 'porter' | 'admin'>('waiter');

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
    await setDoc(doc(db, 'authorized_staff', email), { email, name, role, createdAt: new Date().toISOString() });
    setEmail('');
    setName('');
  };

  const removeStaff = async (email: string) => {
    await deleteDoc(doc(db, 'authorized_staff', email));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><ShieldCheck /> Gestão de Equipe</h1>
      
      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">
        <h2 className="font-bold mb-4">Adicionar Membro</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input className="border p-2 rounded" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="border p-2 rounded" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
          <select className="border p-2 rounded" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="waiter">Garçom</option>
            <option value="driver">Entregador</option>
            <option value="porter">Porteiro</option>
            <option value="admin">Admin</option>
          </select>
          <button className="bg-brand text-white p-2 rounded" onClick={addStaff}><UserPlus /></button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="font-bold mb-4">Equipe Autorizada</h2>
        {staff.map(member => (
          <div key={member.email} className="flex justify-between items-center border-b py-3">
            <div>
              <p className="font-bold">{member.name}</p>
              <p className="text-sm text-gray-500">{member.email} • {member.role}</p>
            </div>
            <button className="text-red-500" onClick={() => removeStaff(member.email)}><Trash2 size={18} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
