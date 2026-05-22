import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Database, Search, Loader, CheckSquare, Square, Save, Filter, BookOpen } from 'lucide-react';

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [questionsRes, catRes] = await Promise.all([
        api.get('/admin/questions'),
        api.get('/categories')
      ]);
      setQuestions(questionsRes.data.questions || []);
      setCategories(catRes.data || []);
    } catch (err) {
      toast.error('Failed to load Question Bank data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredQuestions.map(q => q._id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) {
      toast.error('No questions selected');
      return;
    }
    
    // We allow clearing the category by passing an empty string
    
    setUpdating(true);
    try {
      const response = await api.patch('/admin/questions/bulk-category', {
        questionIds: Array.from(selectedIds),
        category: bulkCategory
      });
      
      toast.success(response.data.message || 'Categories updated successfully');
      
      // Optimistically update the UI
      setQuestions(prev => prev.map(q => {
        if (selectedIds.has(q._id)) {
          return { ...q, section: bulkCategory };
        }
        return q;
      }));
      
      setSelectedIds(new Set());
      setBulkCategory('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update categories');
    } finally {
      setUpdating(false);
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    (q.section && q.section.toLowerCase().includes(search.toLowerCase())) ||
    q.quizTitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Question Bank</h1>
            <p>Manage all questions across all assessments and bulk-assign categories.</p>
          </div>
          <div style={{ position: 'relative', width: 300 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              className="form-input" 
              placeholder="Search questions, categories, quizzes..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, margin: 0 }}
            />
          </div>
        </div>

        {/* Bulk Action Bar - Appears when items are selected */}
        {selectedIds.size > 0 && (
          <div className="bulk-action-bar slide-down" style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            padding: '12px 20px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ background: '#3b82f6', color: 'white', fontWeight: 600, padding: '2px 8px', borderRadius: 12, fontSize: '0.85rem' }}>
                {selectedIds.size}
              </span>
              <span style={{ color: '#1e3a8a', fontWeight: 500 }}>Questions Selected</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={16} color="#3b82f6" />
                <select 
                  className="form-input" 
                  style={{ margin: 0, padding: '6px 12px', minWidth: 200, borderColor: '#bfdbfe' }}
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                >
                  <option value="">-- Remove Category / None --</option>
                  {categories.map(c => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleBulkUpdate}
                disabled={updating}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 16px' }}
              >
                {updating ? <Loader size={16} className="spin" /> : <Save size={16} />}
                {updating ? 'Updating...' : 'Assign Category'}
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
              <Loader className="spin" size={32} style={{ margin: '0 auto 16px', display: 'block' }} />
              <div>Loading Question Bank...</div>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#94a3b8', background: '#f8fafc' }}>
              <Database size={40} style={{ margin: '0 auto 16px', opacity: 0.5, display: 'block' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 500 }}>No questions found.</div>
              <p style={{ marginTop: 8 }}>Create some quizzes with questions to populate the bank.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px', width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                      />
                    </th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '45%' }}>Question</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '20%' }}>Category / Section</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '20%' }}>Source Quiz</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '15%' }}>Options</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map(q => {
                    const isSelected = selectedIds.has(q._id);
                    return (
                      <tr 
                        key={q._id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9', 
                          transition: 'all 0.2s',
                          background: isSelected ? '#f0f9ff' : 'white',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleSelectRow(q._id)}
                      >
                        <td style={{ padding: '12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleSelectRow(q._id)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                          <div style={{ fontWeight: 500, marginBottom: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {q.question}
                          </div>
                          {q.imageUrl && (
                            <span style={{ fontSize: '0.75rem', color: '#3b82f6', background: '#eff6ff', padding: '2px 6px', borderRadius: 4 }}>
                              Contains Image
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {q.section ? (
                            <span style={{ 
                              display: 'inline-block',
                              padding: '4px 10px', 
                              background: '#fef3c7', 
                              color: '#92400e', 
                              borderRadius: 12, 
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}>
                              {q.section}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>Uncategorized</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <BookOpen size={14} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
                              {q.quizTitle}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '0.85rem' }}>
                          {q.options?.length || 0} options
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .slide-down { animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
          @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </main>
    </div>
  );
}
