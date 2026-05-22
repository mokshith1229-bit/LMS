import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Layers, Plus, Trash2, Search, Loader } from 'lucide-react';

export default function CategoryManagement() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // New Category Form
  const [showAdd, setShowAdd] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch (err) {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      toast.error('Category name is required');
      return;
    }
    setAdding(true);
    try {
      const { data } = await api.post('/categories', { name: newCatName, description: newCatDesc });
      toast.success('Category created successfully');
      setCategories(prev => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCatName('');
      setNewCatDesc('');
      setShowAdd(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create category');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the category "${name}"?\nThis will not delete existing questions, but will remove it from the dropdown options.`)) {
      return;
    }
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      setCategories(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Categories & Sections</h1>
            <p>Manage the global list of sections/categories for assessments.</p>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f59e0b', borderColor: '#f59e0b' }}
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus size={18} /> {showAdd ? 'Close Form' : 'Add New Category'}
          </button>
        </div>

        {showAdd && (
          <div className="card" style={{ marginBottom: 24, border: '2px solid #f59e0b', background: '#fffbeb' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#b45309' }}>Create New Category</h3>
            <form onSubmit={handleAddCategory} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <label className="form-label" style={{ color: '#92400e' }}>Name *</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. Highways"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label" style={{ color: '#92400e' }}>Description (Optional)</label>
                <input 
                  className="form-input" 
                  placeholder="Brief description"
                  value={newCatDesc}
                  onChange={e => setNewCatDesc(e.target.value)}
                />
              </div>
              <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
                <button type="submit" className="btn btn-primary" style={{ background: '#d97706', borderColor: '#d97706' }} disabled={adding}>
                  {adding ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={20} color="#8DC63F" />
              Global Section Dictionary
            </h2>
            <div style={{ position: 'relative', width: 280 }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                className="form-input" 
                placeholder="Search categories..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, margin: 0 }}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
              <Loader className="spin" size={24} style={{ marginBottom: 12 }} />
              <div>Loading categories...</div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
              <Layers size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div>No categories found. Create one to get started.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 700, width: '30%' }}>Category Name</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700 }}>Description</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, width: '150px' }}>Created</th>
                    <th style={{ padding: '12px 16px', fontWeight: 700, width: '80px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map(cat => (
                    <tr key={cat._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                        {cat.name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {cat.description || <span style={{ opacity: 0.5 }}>-</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                        {new Date(cat.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleDelete(cat._id, cat.name)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, borderRadius: 4 }}
                          title="Delete Category"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </main>
    </div>
  );
}
