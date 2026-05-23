import { useState, useEffect, useMemo } from 'react';
import { Search, X, Loader, Filter, CopyPlus, Image as ImageIcon, Database } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function ImportQuestionModal({ isOpen, onClose, onImport }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [selectedQs, setSelectedQs] = useState(new Set());
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
      // Reset state on open
      setSelectedQs(new Set());
      setSearchTerm('');
      setCategoryFilter('');
      setCourseFilter('');
      setPage(1);
    }
  }, [isOpen]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/questions');
      if (data.success) {
        setQuestions(data.questions || []);
      }
    } catch (err) {
      toast.error('Failed to load Question Bank data');
    } finally {
      setLoading(false);
    }
  };

  // Derive filter options
  const categories = useMemo(() => {
    const cats = new Set(questions.map(q => q.section).filter(Boolean));
    return Array.from(cats).sort();
  }, [questions]);

  const courses = useMemo(() => {
    const crs = new Set(questions.map(q => q.courseTitle).filter(Boolean));
    return Array.from(crs).sort();
  }, [questions]);

  // Filter questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      const matchSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (q.options && q.options.some(o => o.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchCat = categoryFilter ? q.section === categoryFilter : true;
      const matchCourse = courseFilter ? q.courseTitle === courseFilter : true;
      return matchSearch && matchCat && matchCourse;
    });
  }, [questions, searchTerm, categoryFilter, courseFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredQuestions.length / pageSize) || 1;
  const currentQuestions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredQuestions.slice(start, start + pageSize);
  }, [filteredQuestions, page, pageSize]);

  // Handle page change safety
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const handleSelectAllOnPage = (e) => {
    const newSet = new Set(selectedQs);
    if (e.target.checked) {
      currentQuestions.forEach(q => newSet.add(q._id));
    } else {
      currentQuestions.forEach(q => newSet.delete(q._id));
    }
    setSelectedQs(newSet);
  };

  const handleImport = () => {
    if (selectedQs.size === 0) return;
    
    const questionsToImport = questions.filter(q => selectedQs.has(q._id));
    
    // Create soft copies / clones
    const clonedQuestions = questionsToImport.map(q => ({
      question: q.question,
      options: [...q.options], // Deep copy options array
      correctAnswer: q.correctAnswer,
      imageUrl: q.imageUrl || '',
      section: q.section || '',
    }));

    onImport(clonedQuestions);
    toast.success(`${clonedQuestions.length} questions cloned & imported successfully!`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        padding: '20px'
      }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          style={{
            background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '1000px',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: '#e0e7ff', padding: '10px', borderRadius: '8px' }}>
                <Database size={24} color="#4f46e5" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Question Bank Import</h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                  Select questions to clone into your current assessment. These are independent copies.
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
              borderRadius: '50%', color: '#64748b', transition: 'background 0.2s'
            }} onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'} onMouseOut={e => e.currentTarget.style.background = 'none'}>
              <X size={24} />
            </button>
          </div>

          {/* Filters & Search */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', flexWrap: 'wrap', background: '#fff' }}>
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search questions or options..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px',
                  border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px', flex: '1 1 400px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Filter size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <select 
                  value={courseFilter} 
                  onChange={e => setCourseFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 32px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', appearance: 'none', background: '#fff'
                  }}
                >
                  <option value="">All Courses</option>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ flex: 1, position: 'relative' }}>
                <Filter size={14} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <select 
                  value={categoryFilter} 
                  onChange={e => setCategoryFilter(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 32px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', appearance: 'none', background: '#fff'
                  }}
                >
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Content Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0', background: '#f8fafc' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                <Loader size={40} color="#4f46e5" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '16px', color: '#64748b', fontWeight: 500 }}>Loading Question Bank...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px' }}>
                <Database size={48} color="#cbd5e1" />
                <p style={{ marginTop: '16px', color: '#64748b', fontWeight: 500, fontSize: '1.1rem' }}>No questions found.</p>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9', zIndex: 10, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <tr>
                    <th style={{ padding: '12px 24px', textAlign: 'left', width: '50px' }}>
                      <input 
                        type="checkbox" 
                        checked={currentQuestions.length > 0 && currentQuestions.every(q => selectedQs.has(q._id))}
                        onChange={handleSelectAllOnPage}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Question Details</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, width: '200px' }}>Context</th>
                  </tr>
                </thead>
                <tbody>
                  {currentQuestions.map((q) => {
                    const isSelected = selectedQs.has(q._id);
                    return (
                      <tr key={q._id} onClick={() => {
                        const newSet = new Set(selectedQs);
                        isSelected ? newSet.delete(q._id) : newSet.add(q._id);
                        setSelectedQs(newSet);
                      }} style={{
                        background: isSelected ? '#eff6ff' : '#fff',
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}>
                        <td style={{ padding: '16px 24px', verticalAlign: 'top' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => {}} // handled by tr click
                            style={{ width: '16px', height: '16px', cursor: 'pointer', marginTop: '4px' }}
                          />
                        </td>
                        <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px', lineHeight: '1.4' }}>
                            {q.question}
                          </div>
                          {q.imageUrl && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>
                              <ImageIcon size={12} /> Contains Image
                            </div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {q.options.map((opt, idx) => (
                              <div key={idx} style={{
                                fontSize: '0.85rem', padding: '4px 8px', borderRadius: '4px',
                                background: idx === q.correctAnswer ? '#dcfce7' : '#f8fafc',
                                color: idx === q.correctAnswer ? '#166534' : '#475569',
                                border: `1px solid ${idx === q.correctAnswer ? '#bbf7d0' : '#e2e8f0'}`,
                                display: 'flex', alignItems: 'center', gap: '8px'
                              }}>
                                <span style={{ fontWeight: 700, width: '20px' }}>{String.fromCharCode(65 + idx)}.</span>
                                <span>{opt}</span>
                                {idx === q.correctAnswer && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700 }}>✓ Correct</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {q.section && (
                              <div>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>Category</div>
                                <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>{q.section}</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>Source Course</div>
                              <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>{q.courseTitle}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>Source Quiz</div>
                              <div style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>{q.quizTitle}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer with Pagination & Action */}
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            {/* Pagination Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Showing <span style={{ fontWeight: 700, color: '#0f172a' }}>{filteredQuestions.length > 0 ? (page - 1) * pageSize + 1 : 0}</span> to <span style={{ fontWeight: 700, color: '#0f172a' }}>{Math.min(page * pageSize, filteredQuestions.length)}</span> of <span style={{ fontWeight: 700, color: '#0f172a' }}>{filteredQuestions.length}</span> questions
              </div>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  disabled={page === 1}
                  style={{
                    padding: '6px 12px', border: '1px solid #cbd5e1', background: page === 1 ? '#f8fafc' : '#fff',
                    color: page === 1 ? '#94a3b8' : '#334155', borderRadius: '6px', cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  Prev
                </button>
                <div style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600, color: '#334155', background: '#f1f5f9', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {page} / {totalPages}
                </div>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                  style={{
                    padding: '6px 12px', border: '1px solid #cbd5e1', background: page === totalPages ? '#f8fafc' : '#fff',
                    color: page === totalPages ? '#94a3b8' : '#334155', borderRadius: '6px', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem', fontWeight: 600
                  }}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Import Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>
                <span style={{ color: '#4f46e5', fontWeight: 700 }}>{selectedQs.size}</span> selected
              </div>
              <button 
                onClick={handleImport}
                disabled={selectedQs.size === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: selectedQs.size > 0 ? '#4f46e5' : '#cbd5e1',
                  color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px',
                  fontSize: '0.95rem', fontWeight: 700, cursor: selectedQs.size > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: selectedQs.size > 0 ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <CopyPlus size={18} />
                Import Selected
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
