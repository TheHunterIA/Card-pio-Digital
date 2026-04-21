import React, { useState, useRef } from 'react';
import { useStore, initialMenu, MenuItem, MenuItemExtra } from '../../store';
import { addMenuItem, toggleMenuItem, updateMenuPrice, deleteMenuItem, updateMenuItem } from '../../lib/database';
import { PlusCircle, Image as ImageIcon, Check, ListPlus, Trash2, X, Copy, Pencil, Plus, Upload, Camera, FileSpreadsheet, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../lib/AuthProvider';
import * as XLSX from 'xlsx';

export default function MenuSettings() {
  const menu = useStore(state => state.menu);
  const { isMasterAdmin } = useAuth();
  
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const [formItem, setFormItem] = useState({
    name: '',
    description: '',
    category: 'Lanches',
    price: 0,
    image: '',
    extras: [] as MenuItemExtra[]
  });

  const [newExtra, setNewExtra] = useState({ name: '', price: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "Nome do Produto": "Combo Smash 1",
        "Descriçao": "Smash Burger + Batata Frita Média + Refrigerante Lata.",
        "Preço": 45.90,
        "Categoria": "Combos",
        "URL da Imagem (Opcional)": "https://images.unsplash.com/photo-1594212600000-880436af392b?auto=format&fit=crop&q=80&w=800&h=600",
        "Extra 1: Nome": "Turbinar Batata",
        "Extra 1: Preço": 7.00,
        "Extra 2: Nome": "Maionese Artesanal",
        "Extra 2: Preço": 4.00,
        "Extra 3: Nome": "",
        "Extra 3: Preço": ""
      },
      {
        "Nome do Produto": "Cheeseburger Duplo",
        "Descriçao": "Pão brioche, duas carnes de 100g, muito queijo e molho especial.",
        "Preço": 35.90,
        "Categoria": "Lanches",
        "URL da Imagem (Opcional)": "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800&h=600",
        "Extra 1: Nome": "Bacon Extra",
        "Extra 1: Preço": 5.00,
        "Extra 2: Nome": "Batata Frita",
        "Extra 2: Preço": 8.50,
        "Extra 3: Nome": "",
        "Extra 3: Preço": ""
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cardapio");
    XLSX.writeFile(wb, "Modelo_Cardapio_Urban_Prime.xlsx");
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        let successCount = 0;
        for (const row of json) {
          if (!row["Nome do Produto"] || !row["Preço"]) continue;

          const extras: MenuItemExtra[] = [];
          for (let i = 1; i <= 3; i++) {
            const extraName = row[`Extra ${i}: Nome`];
            // eslint-disable-next-line
            const extraPrice = parseFloat(row[`Extra ${i}: Preço`]);
            if (extraName && !isNaN(extraPrice)) {
              extras.push({
                id: Math.random().toString(36).substr(2, 9),
                name: extraName,
                price: extraPrice
              });
            }
          }

          const defaultImage = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800&h=600';

          const rawCategory = row["Categoria"] ? String(row["Categoria"]).trim() : "Lanches";
          // Normalize to capitalized if it matches one of our main ones
          const categories = ["Combos", "Lanches", "Acompanhamentos", "Bebidas", "Sobremesas"];
          const category = categories.find(c => c.toLowerCase() === rawCategory.toLowerCase()) || rawCategory;

          await addMenuItem({
            name: String(row["Nome do Produto"]),
            description: row["Descriçao"] ? String(row["Descriçao"]) : "",
            price: parseFloat(row["Preço"]),
            category: category,
            image: row["URL da Imagem (Opcional)"] ? String(row["URL da Imagem (Opcional)"]) : defaultImage,
            extras: extras
          });
          successCount++;
        }
        
        alert(`${successCount} itens importados com sucesso!`);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar arquivo Excel. Certifique-se de usar o modelo correto.');
      } finally {
        if (excelInputRef.current) excelInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprime como JPEG com 70% de qualidade para reduzir espaço do Base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setFormItem({ ...formItem, image: dataUrl });
      };
    };
  };

  const handleCreateProduct = () => {
    if (!formItem.name || formItem.price <= 0) return;
    
    // Provide a fallback placeholder image if empty
    const finalImage = formItem.image.trim() !== '' 
      ? formItem.image 
      : 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=800&h=600';

    if (editingId) {
      updateMenuItem(editingId, { ...formItem, image: finalImage });
    } else {
      addMenuItem({ ...formItem, image: finalImage });
    }
    
    handleCloseForm();
  };

  const handleCloseForm = () => {
    setIsAddingMode(false);
    setEditingId(null);
    setFormItem({ name: '', description: '', category: 'Lanches', price: 0, image: '', extras: [] });
    setNewExtra({ name: '', price: 0 });
  };

  const handleEdit = (item: MenuItem) => {
    setEditingId(item.id);
    setFormItem({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      image: item.image,
      extras: item.extras || []
    });
    setIsAddingMode(true);
    // Scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddExtra = () => {
    if (!newExtra.name || newExtra.price < 0) return;
    const extra: MenuItemExtra = {
      id: Math.random().toString(36).substr(2, 9),
      name: newExtra.name,
      price: newExtra.price
    };
    setFormItem({ ...formItem, extras: [...formItem.extras, extra] });
    setNewExtra({ name: '', price: 0 });
  };

  const handleRemoveExtra = (id: string) => {
    setFormItem({ ...formItem, extras: formItem.extras.filter(e => e.id !== id) });
  };

  const handleDuplicate = (item: any) => {
    const duplicated = {
      name: `${item.name} (Cópia)`,
      description: item.description,
      category: item.category,
      price: item.price,
      image: item.image,
      extras: item.extras || []
    };
    addMenuItem(duplicated);
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      for (const item of initialMenu) {
        await addMenuItem({
           name: item.name,
           description: item.description,
           price: item.price,
           category: item.category,
           image: item.image,
           extras: item.extras || []
        });
      }
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto h-full overflow-y-auto pb-24 md:pb-8 w-full bg-oat">
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold text-ink mb-1 tracking-tight">Estoque & Menu</h2>
          <p className="text-ink-muted text-sm font-medium">Gerencie a disponibilidade e realize alterações de preço instantâneas.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          {isMasterAdmin && (
            <>
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-white text-ink border border-black/10 px-4 py-3.5 rounded-full font-display font-bold text-sm transition-all hover:bg-oat shadow-sm active:scale-95 tracking-wide"
                title="Baixar Modelo de Excel"
              >
                <Download className="w-5 h-5"/> Modelo
              </button>
              
              <input 
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                ref={excelInputRef}
                onChange={handleExcelUpload}
              />
              <button 
                onClick={() => excelInputRef.current?.click()}
                className="flex items-center gap-2 bg-[#107c41] text-white px-4 py-3.5 rounded-full font-display font-bold text-sm transition-all hover:bg-[#0c6130] shadow-sm active:scale-95 tracking-wide"
                title="Importar Cardápio de um arquivo Excel"
              >
                <FileSpreadsheet className="w-5 h-5"/> Importar Excel
              </button>
            </>
          )}

          <button 
            onClick={() => {
              if (isAddingMode) handleCloseForm();
              else setIsAddingMode(true);
            }}
            className="flex items-center gap-2 bg-brand text-white px-6 py-3.5 rounded-full font-display font-bold text-sm transition-all w-full sm:w-auto justify-center shadow-md active:scale-95 tracking-wide"
          >
            {isAddingMode ? <><X className="w-5 h-5"/> Cancelar</> : <><PlusCircle className="w-5 h-5" /> Novo Lanche</>}
          </button>
        </div>
      </div>

      {menu.length === 0 && (
        <div className="bg-brand/10 border border-brand/20 rounded-3xl p-8 mb-8 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-white text-brand rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-brand/20">
            <ListPlus className="w-8 h-8" strokeWidth={1.5} />
          </div>
          <h3 className="font-display font-bold text-ink text-xl mb-2">Seu menu está vazio</h3>
          <p className="text-sm text-ink-muted mb-6 max-w-md font-medium">Acelere o cadastro! Carregue nossos itens de exemplo para testar as funcionalidades.</p>
          <button 
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-6 py-3 bg-brand text-white rounded-full font-display font-bold tracking-wide hover:bg-brand-light transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_-6px_rgba(255,78,0,0.5)] active:scale-95"
          >
            {isSeeding ? 'Carregando banco...' : 'Carregar Itens de Exemplo'}
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {isAddingMode && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="mb-8"
          >
            <div className="bg-white border text-ink border-black/5 rounded-[32px] shadow-xl p-5 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-bold text-ink text-2xl tracking-tight">
                  {editingId ? 'Editar Item' : 'Criar Novo Lanche'}
                </h3>
                <button onClick={handleCloseForm} className="p-2 bg-oat rounded-full text-ink-muted hover:text-ink">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-display font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Nome do Produto *</label>
                    <input 
                      type="text" 
                      value={formItem.name}
                      onChange={(e) => setFormItem({...formItem, name: e.target.value})}
                      placeholder="Ex: Smash Duplo"
                      className="w-full bg-oat border-2 border-transparent rounded-xl p-3 text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 focus:bg-white font-medium placeholder-gray-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Preço Sugerido (R$) *</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand font-display font-bold text-sm">R$</span>
                      <input 
                        type="number" 
                        value={formItem.price || ''}
                        onChange={(e) => setFormItem({...formItem, price: parseFloat(e.target.value) || 0})}
                        placeholder="0.00"
                        className="w-full bg-oat border-2 border-transparent rounded-xl p-3 pl-9 text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 focus:bg-white font-mono font-bold transition-all"
                        step="0.10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-display font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Descrição detalhada</label>
                    <textarea 
                      value={formItem.description}
                      onChange={(e) => setFormItem({...formItem, description: e.target.value})}
                      placeholder="Descreva os ingredientes..."
                      rows={3}
                      className="w-full bg-oat border-2 border-transparent rounded-xl p-3 text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 focus:bg-white font-medium placeholder-gray-400 transition-all resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-display font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Categoria</label>
                      <select 
                        value={formItem.category}
                        onChange={(e) => setFormItem({...formItem, category: e.target.value})}
                        className="w-full bg-oat border-2 border-transparent rounded-xl p-3 text-sm focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 focus:bg-white font-display font-bold text-ink transition-all"
                      >
                        <option value="Combos">Combos</option>
                        <option value="Lanches">Lanches</option>
                        <option value="Acompanhamentos">Acompanhamentos</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Sobremesas">Sobremesas</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-display font-bold text-ink-muted mb-1.5 uppercase tracking-widest">Imagem do Produto</label>
                      <input 
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 bg-oat border-2 border-dashed border-black/10 hover:border-brand hover:bg-brand/5 text-ink-muted hover:text-brand rounded-xl p-3 text-sm font-medium transition-all flex items-center justify-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          {formItem.image ? 'Alterar Imagem' : 'Enviar Foto do Lanche'}
                        </button>
                      </div>
                      {formItem.image && (
                        <div className="mt-2 relative w-20 h-20 rounded-xl overflow-hidden border-2 border-brand shadow-sm">
                          <img src={formItem.image} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setFormItem({...formItem, image: ''})}
                            className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white rounded-full p-1 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-oat/50 rounded-3xl p-6 border border-black/5">
                  <h4 className="font-display font-bold text-ink mb-4 text-sm flex items-center gap-2">
                    <PlusCircle className="w-4 h-4 text-brand" /> Ingredientes Extras
                  </h4>
                  
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={newExtra.name}
                        onChange={(e) => setNewExtra({...newExtra, name: e.target.value})}
                        placeholder="Nome (ex: Bacon)"
                        className="w-full bg-white border border-black/5 rounded-lg p-2 text-xs font-medium"
                      />
                    </div>
                    <div className="w-24">
                      <input 
                        type="number" 
                        value={newExtra.price || ''}
                        onChange={(e) => setNewExtra({...newExtra, price: parseFloat(e.target.value) || 0})}
                        placeholder="R$ 0,00"
                        className="w-full bg-white border border-black/5 rounded-lg p-2 text-xs font-mono font-bold"
                      />
                    </div>
                    <button 
                      onClick={handleAddExtra}
                      className="bg-brand text-white p-2 rounded-lg hover:bg-brand-dark transition-all"
                    >
                      <Plus className="w-4 h-4" strokeWidth={3} />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {formItem.extras.length === 0 ? (
                      <p className="text-[10px] text-ink-muted text-center py-4 italic">Nenhum extra cadastrado.</p>
                    ) : (
                      formItem.extras.map(extra => (
                        <div key={extra.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-black/5 shadow-sm">
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-ink">{extra.name}</span>
                             <span className="text-[10px] text-brand font-mono font-bold">+ R$ {extra.price.toFixed(2)}</span>
                           </div>
                           <button onClick={() => handleRemoveExtra(extra.id)} className="text-ink-muted hover:text-red-500 transition-colors">
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-black/5 flex justify-end gap-3">
                <button onClick={handleCloseForm} className="px-6 py-3 font-display font-bold text-xs uppercase tracking-widest text-ink-muted hover:text-ink">
                  Descartar
                </button>
                <button 
                  onClick={handleCreateProduct}
                  disabled={!formItem.name || formItem.price <= 0}
                  className="flex items-center gap-2 bg-ink text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed px-8 py-3.5 rounded-2xl font-display font-bold text-xs transition-all shadow-lg active:scale-95 uppercase tracking-widest"
                >
                  <Check className="w-4 h-4" strokeWidth={3} />
                  {editingId ? 'Salvar Alterações' : 'Adicionar ao Menu'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white border border-black/5 rounded-[32px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full hide-scrollbar">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-oat border-b border-black/5">
              <tr>
                <th className="p-5 font-display font-bold text-ink-muted text-[11px] uppercase tracking-widest text-center w-20">Foto</th>
                <th className="p-5 font-display font-bold text-ink-muted text-[11px] uppercase tracking-widest">Detalhes do Produto</th>
                <th className="p-5 font-display font-bold text-ink-muted text-[11px] uppercase tracking-widest">Extras</th>
                <th className="p-5 font-display font-bold text-ink-muted text-[11px] uppercase tracking-widest w-40">Preço Base</th>
                <th className="p-5 font-display font-bold text-ink-muted text-[11px] uppercase tracking-widest text-right w-48">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {[...menu].sort((a, b) => {
                const order = ['Combos', 'Lanches', 'Acompanhamentos', 'Bebidas', 'Sobremesas'];
                const indexA = order.indexOf(a.category);
                const indexB = order.indexOf(b.category);
                
                if (indexA !== -1 && indexB !== -1 && indexA !== indexB) return indexA - indexB;
                if (indexA !== -1 && indexB === -1) return -1;
                if (indexA === -1 && indexB !== -1) return 1;
                
                return a.name.localeCompare(b.name);
              }).map(item => (
                <tr key={item.id} className="hover:bg-oat/50 transition-colors group">
                  <td className="p-5">
                    <img src={item.image} alt={item.name} className="w-14 h-14 rounded-2xl object-cover bg-oat border border-black/5 shadow-sm" />
                  </td>
                  <td className="p-5">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-display font-bold text-ink text-sm">{item.name}</p>
                        <span className="px-2 py-0.5 bg-oat text-[9px] text-ink-muted rounded-full font-bold uppercase tracking-tighter border border-black/5">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-muted w-32 sm:w-64 truncate font-medium">{item.description}</p>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex -space-x-2">
                       {(item.extras || []).length > 0 ? (
                         item.extras?.slice(0, 3).map((e, idx) => (
                           <div key={e.id} className="w-6 h-6 rounded-full bg-brand/10 border border-white text-brand flex items-center justify-center text-[8px] font-black" title={e.name}>
                             {e.name.charAt(0).toUpperCase()}
                           </div>
                         ))
                       ) : (
                         <span className="text-[10px] text-ink-muted">Nenhum</span>
                       )}
                       {(item.extras || []).length > 3 && (
                         <div className="w-6 h-6 rounded-full bg-oat border border-white text-ink-muted flex items-center justify-center text-[8px] font-black">
                           +{(item.extras?.length || 0) - 3}
                         </div>
                       )}
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand font-display font-bold text-xs">R$</span>
                      <input 
                        type="number" 
                        value={item.price.toFixed(2)}
                        onChange={(e) => updateMenuPrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-black/10 rounded-xl py-2 pl-8 pr-3 text-ink focus:outline-none focus:border-brand font-mono text-sm font-bold shadow-sm transition-all"
                        step="0.10"
                      />
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleEdit(item)}
                        className="p-2.5 text-brand bg-brand/5 hover:bg-brand hover:text-white rounded-xl transition-all shadow-sm" 
                        title="Editar completo"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={2.5} />
                      </button>

                      <button 
                        onClick={() => handleDuplicate(item)}
                        className="p-2.5 text-ink-muted hover:text-ink hover:bg-oat rounded-xl transition-all" 
                        title="Duplicar"
                      >
                        <Copy className="w-4 h-4" strokeWidth={2.5} />
                      </button>

                      <button 
                        onClick={() => toggleMenuItem(item.id, item.isActive)}
                        className={`p-2.5 rounded-xl transition-all border ${
                          item.isActive 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                            : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                        }`}
                        title={item.isActive ? 'Pausar Vendas' : 'Ativar Vendas'}
                      >
                         <Check className={`w-4 h-4 ${!item.isActive && 'opacity-20'}`} strokeWidth={3} />
                      </button>
                      
                      {deletingId === item.id ? (
                        <div className="flex items-center gap-1.5 ml-2">
                          <button 
                            onClick={async () => {
                              await deleteMenuItem(item.id);
                              setDeletingId(null);
                            }} 
                            className="bg-red-600 text-white p-2 rounded-lg shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setDeletingId(item.id)} 
                          className="p-2.5 text-ink-muted/30 hover:text-red-500 rounded-xl transition-all" 
                          title="Excluir"
                        >
                          <X className="w-4 h-4" strokeWidth={3} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
