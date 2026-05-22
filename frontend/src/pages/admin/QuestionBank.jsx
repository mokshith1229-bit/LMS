import { useState, useEffect } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Database, Search, Loader, CheckSquare, Square, Save, Filter, BookOpen, Pencil, Plus, Trash, Image, X } from 'lucide-react';

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuizFilter, setSelectedQuizFilter] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  
  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const [updating, setUpdating] = useState(false);

  // Single Question Editing state
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editForm, setEditForm] = useState({ question: '', options: [], correctAnswer: 0, imageUrl: '', section: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (questions.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const quizIdParam = params.get('quizId');
      const quizTitleParam = params.get('quizTitle');
      const categoryParam = params.get('category');

      if (quizIdParam) {
        const matched = questions.find(q => q.quizId === quizIdParam);
        if (matched) {
          setSelectedQuizFilter(matched.quizTitle);
        }
      } else if (quizTitleParam) {
        setSelectedQuizFilter(quizTitleParam);
      }

      if (categoryParam) {
        setSelectedCategoryFilter(categoryParam);
      }
    }
  }, [questions]);

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

  const handleOpenEdit = (e, q) => {
    e.stopPropagation(); // Stop row click trigger selection
    setEditingQuestion(q._id);
    setEditForm({
      question: q.question || '',
      options: [...(q.options || ['', ''])],
      correctAnswer: parseInt(q.correctAnswer) || 0,
      imageUrl: q.imageUrl || '',
      section: q.section || ''
    });
  };

  const closeEditModal = () => {
    setEditingQuestion(null);
    setEditForm({ question: '', options: [], correctAnswer: 0, imageUrl: '', section: '' });
  };

  const handleModalImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/import/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditForm(prev => ({ ...prev, imageUrl: data.url }));
      toast.success('Image uploaded successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveQuestion = async () => {
    if (!editForm.question.trim()) {
      toast.error('Question text is required');
      return;
    }

    const filteredOptions = editForm.options.map(o => o.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      toast.error('At least 2 options are required');
      return;
    }

    if (editForm.options.some(o => !o.trim())) {
      toast.error('All options must have text. Remove unused options.');
      return;
    }

    setSaving(true);
    try {
      const response = await api.put(`/admin/questions/${editingQuestion}`, {
        question: editForm.question,
        options: editForm.options,
        correctAnswer: editForm.correctAnswer,
        section: editForm.section,
        imageUrl: editForm.imageUrl
      });

      toast.success('Question updated successfully');

      // Optimistically update the UI
      setQuestions(prev => prev.map(q => {
        if (q._id === editingQuestion) {
          return {
            ...q,
            question: editForm.question,
            options: editForm.options,
            correctAnswer: String(editForm.correctAnswer),
            section: editForm.section,
            imageUrl: editForm.imageUrl
          };
        }
        return q;
      }));

      closeEditModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const uniqueQuizzes = Array.from(new Set(questions.map(q => q.quizTitle))).filter(Boolean).sort();
  const uniqueCategories = Array.from(new Set([
    ...categories.map(c => c.name),
    ...questions.map(q => q.section).filter(Boolean)
  ])).sort();

  const filteredQuestions = questions.filter(q => {
    // 1. Search filter
    const matchesSearch = !search.trim() ||
      q.question.toLowerCase().includes(search.toLowerCase()) ||
      (q.section && q.section.toLowerCase().includes(search.toLowerCase())) ||
      q.quizTitle.toLowerCase().includes(search.toLowerCase());

    // 2. Quiz filter
    const matchesQuiz = !selectedQuizFilter || q.quizTitle === selectedQuizFilter;

    // 3. Category filter
    const matchesCategory = !selectedCategoryFilter || q.section === selectedCategoryFilter;

    return matchesSearch && matchesQuiz && matchesCategory;
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1>Question Bank</h1>
            <p>Manage all questions across all assessments and bulk-assign categories.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/assets/minds_logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
          </div>
        </div>

        {/* Horizontal Filters Bar */}
        <div className="card mb-20" style={{ padding: '16px 20px', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Box */}
            <div style={{ flex: '1 1 240px', position: 'relative' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                className="form-input" 
                placeholder="Search questions, categories, quizzes..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 36, margin: 0, width: '100%' }}
              />
            </div>
            
            {/* Quiz Filter Dropdown */}
            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <select
                className="form-input"
                value={selectedQuizFilter}
                onChange={e => setSelectedQuizFilter(e.target.value)}
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.9rem', width: '100%', borderColor: '#cbd5e1' }}
              >
                <option value="">-- All Quizzes / Tests --</option>
                {uniqueQuizzes.map(qTitle => (
                  <option key={qTitle} value={qTitle}>{qTitle}</option>
                ))}
              </select>
            </div>

            {/* Category Filter Dropdown */}
            <div style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Filter size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <select
                className="form-input"
                value={selectedCategoryFilter}
                onChange={e => setSelectedCategoryFilter(e.target.value)}
                style={{ margin: 0, padding: '8px 12px', fontSize: '0.9rem', width: '100%', borderColor: '#cbd5e1' }}
              >
                <option value="">-- All Categories --</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Reset Filters button */}
            {(search || selectedQuizFilter || selectedCategoryFilter) && (
              <button
                className="btn"
                onClick={() => {
                  setSearch('');
                  setSelectedQuizFilter('');
                  setSelectedCategoryFilter('');
                  window.history.replaceState({}, document.title, window.location.pathname);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  margin: 0,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.color = '#1e293b';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <X size={14} /> Clear Filters
              </button>
            )}
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
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '10%' }}>Options</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, width: '10%' }}>Actions</th>
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
                        <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleOpenEdit(e, q)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#f1f5f9',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              color: '#334155',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                            className="edit-btn"
                          >
                            <Pencil size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Overlay */}
        {editingQuestion && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20
          }}>
            <div className="slide-down" style={{
              background: 'white',
              borderRadius: 16,
              width: '100%',
              maxWidth: 700,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>Edit Question</h3>
                <button 
                  onClick={closeEditModal} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Question Text */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#344054', marginBottom: 6, display: 'block' }}>Question Text *</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={editForm.question}
                    onChange={e => setEditForm(prev => ({ ...prev, question: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', minHeight: 80, resize: 'vertical', margin: 0 }}
                    placeholder="Enter question text..."
                  />
                </div>

                {/* Options */}
                <div>
                  <label className="form-label" style={{ fontWeight: 600, color: '#344054', marginBottom: 8, display: 'block' }}>
                    Options — click letter badge to mark correct
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {editForm.options.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, correctAnswer: idx }))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid',
                            borderColor: editForm.correctAnswer === idx ? '#10b981' : '#e2e8f0',
                            background: editForm.correctAnswer === idx ? '#ecfdf5' : '#f8fafc',
                            color: editForm.correctAnswer === idx ? '#047857' : '#475569',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            minWidth: 85,
                            transition: 'all 0.2s'
                          }}
                        >
                          {editForm.correctAnswer === idx ? 'CORRECT' : `Option ${String.fromCharCode(65 + idx)}`}
                        </button>
                        <input
                          className="form-input"
                          value={opt}
                          onChange={e => {
                            const newOpts = [...editForm.options];
                            newOpts[idx] = e.target.value;
                            setEditForm(prev => ({ ...prev, options: newOpts }));
                          }}
                          style={{ flex: 1, margin: 0, padding: '8px 12px' }}
                          placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                        />
                        {editForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditForm(prev => {
                                const newOpts = prev.options.filter((_, i) => i !== idx);
                                let newCorrect = prev.correctAnswer;
                                if (prev.correctAnswer === idx) {
                                  newCorrect = 0;
                                } else if (prev.correctAnswer > idx) {
                                  newCorrect = prev.correctAnswer - 1;
                                }
                                return { ...prev, options: newOpts, correctAnswer: newCorrect };
                              });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: 6
                            }}
                            title="Delete option"
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {editForm.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, options: [...prev.options, ''] }))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 10,
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        padding: '4px 8px'
                      }}
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>

                {/* Category & Section */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, color: '#344054', marginBottom: 6, display: 'block' }}>Category / Section</label>
                  <select
                    className="form-input"
                    value={editForm.section}
                    onChange={e => setEditForm(prev => ({ ...prev, section: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', margin: 0 }}
                  >
                    <option value="">-- None --</option>
                    {categories.map(c => (
                      <option key={c._id} value={c.name}>{c.name}</option>
                    ))}
                    {editForm.section && !categories.some(c => c.name === editForm.section) && (
                      <option value={editForm.section}>{editForm.section} (Custom)</option>
                    )}
                  </select>
                </div>

                {/* Image Attachment */}
                <div style={{
                  padding: 16,
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px dashed #cbd5e1'
                }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: 8, display: 'block' }}>
                    🖼️ Question Image <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
                  </label>

                  {editForm.imageUrl && (
                    <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
                      <img
                        src={editForm.imageUrl}
                        alt="Preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 140,
                          borderRadius: 6,
                          border: '1px solid #e2e8f0',
                          display: 'block'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, imageUrl: '' }))}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        title="Remove image"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="modal-image-upload"
                      style={{ display: 'none' }}
                      onChange={handleModalImageUpload}
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="modal-image-upload"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: uploadingImage ? '#cbd5e1' : '#7c3aed',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: uploadingImage ? 'wait' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {uploadingImage ? (
                        <><Loader size={14} className="spin" /> Uploading...</>
                      ) : (
                        <><Image size={14} /> Upload from System</>
                      )}
                    </label>

                    <input
                      className="form-input"
                      value={editForm.imageUrl}
                      onChange={e => setEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                      placeholder="...or paste image URL directly"
                      style={{ flex: 1, margin: 0, padding: '8px 12px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                background: '#f8fafc',
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16
              }}>
                <button
                  onClick={closeEditModal}
                  className="btn btn-secondary"
                  style={{ padding: '8px 18px', fontSize: '0.9rem', margin: 0 }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuestion}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}
                  disabled={saving || uploadingImage}
                >
                  {saving ? <Loader size={16} className="spin" /> : <Save size={16} />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

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
