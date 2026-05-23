import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, FileText, AlignLeft, Image, X, Loader, Shuffle, Users, ToggleLeft, ToggleRight, Info, ChevronDown, ChevronUp, AlertCircle, Database } from 'lucide-react';
import ImportQuestionModal from '../../components/ImportQuestionModal';

const emptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  imageUrl: '',
  section: '',
});

// ── Text-paste parser (same logic as LivePoll) ──────────────────────────────
function parseTextBlock(raw) {
  const blocks = raw.trim().split(/\n\s*\n/);
  const results = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;
    const correctLineIdx = lines.findIndex(l => /correct\s+answer:/i.test(l));
    let correctLetter = '';
    if (correctLineIdx !== -1) {
      const m = lines[correctLineIdx].match(/correct\s+answer:\s*([a-d])/i);
      if (m) correctLetter = m[1].toUpperCase();
    }
    const questionText = lines[0].replace(/^\d+[\)\.]\s*/, '').trim();
    const optionLines = correctLineIdx !== -1 ? lines.slice(1, correctLineIdx) : lines.slice(1);
    let correctIndex = 0;
    const options = optionLines.map((line, i) => {
      const lm = line.match(/^([a-d])[\)\.]\s*(.*)/i);
      if (lm) {
        if (lm[1].toUpperCase() === correctLetter) correctIndex = i;
        return lm[2].trim();
      }
      if (line.startsWith('*')) { correctIndex = i; return line.slice(1).trim(); }
      return line;
    });
    if (questionText && options.length >= 2) {
      results.push({ question: questionText, options, correctAnswer: correctIndex, imageUrl: '', section: '' });
    }
  }
  return results;
}

// ── Toggle Switch Component ──────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, id, label, description }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderRadius: 8,
        background: checked ? 'rgba(141, 198, 63, 0.05)' : '#ffffff',
        border: `1.5px solid ${checked ? '#8DC63F' : '#cbd5e1'}`,
        cursor: 'pointer', transition: 'all 0.2s ease',
        boxShadow: checked ? '0 2px 8px rgba(141, 198, 63, 0.08)' : 'none',
      }}
      onClick={() => onChange(!checked)}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#3D3D3D', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '0.77rem', color: '#5b5b5b' }}>{description}</div>
      </div>
      <div style={{ marginLeft: 16, flexShrink: 0 }}>
        {checked
          ? <ToggleRight size={32} color="#8DC63F" />
          : <ToggleLeft size={32} color="#94a3b8" />}
      </div>
    </div>
  );
}

export default function AddQuiz() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    courseId: '', title: 'MINDS', timeLimitMinutes: 30, passingScore: 60, instructions: '',
    questionsPerStudent: '', shuffleQuestions: false, shuffleOptions: false,
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState('paste'); // 'paste' | 'excel'
  const [pasteText, setPasteText] = useState('');
  const [excelParsing, setExcelParsing] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({}); // { [qIdx]: true }
  const [isRandomizationOpen, setIsRandomizationOpen] = useState(false);
  const [enableSectionDist, setEnableSectionDist] = useState(false);
  const [sectionDistribution, setSectionDistribution] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedQs, setSelectedQs] = useState(new Set());
  const [bulkCategory, setBulkCategory] = useState('');
  const excelRef = useRef(null);
  const imgRefs = useRef({});
  const navigate = useNavigate();

  const poolSize = questions.filter(q => q.question.trim()).length || questions.length;
  const qps = parseInt(form.questionsPerStudent) || 0;
  const qpsError = !enableSectionDist && qps > 0 && qps > poolSize
    ? `Cannot exceed pool size (${poolSize} questions)`
    : null;
  
  const sectionDistError = enableSectionDist
    ? sectionDistribution.some(d => {
        const poolSizeVal = questions.filter(q => (q.section || '').trim() === d.section).length;
        const deliverVal = d.questionsToDeliver || 0;
        return deliverVal <= 0 || deliverVal > poolSizeVal;
      })
      ? 'Each section must have a positive delivery size not exceeding its pool size.'
      : sectionDistribution.length === 0
      ? 'Please add sections and specify delivery sizes.'
      : null
    : null;

  const isRandomized = form.shuffleQuestions || form.shuffleOptions || enableSectionDist || (qps > 0 && qps < poolSize);

  useEffect(() => { 
    api.get('/courses').then(({ data }) => setCourses(data.courses)).catch(() => {});
    api.get('/categories').then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  // Update sectionDistribution whenever uniqueSections changes
  useEffect(() => {
    const uniqueSecs = Array.from(new Set(questions.map(q => (q.section || '').trim()).filter(Boolean)));
    setSectionDistribution(prev => {
      return uniqueSecs.map(sec => {
        const existing = prev.find(p => p.section === sec);
        return {
          section: sec,
          questionsToDeliver: existing ? existing.questionsToDeliver : 0
        };
      });
    });
  }, [questions]);

  // ── Text paste handler ────────────────────────────────────────────────────
  const handlePasteParse = () => {
    if (!pasteText.trim()) { toast.error('Please paste some text first.'); return; }
    const parsed = parseTextBlock(pasteText);
    if (!parsed.length) { toast.error('Could not parse any questions. Check the format.'); return; }
    if (questions.length === 1 && !questions[0].question) setQuestions(parsed);
    else setQuestions(prev => [...prev, ...parsed]);
    toast.success(`${parsed.length} question(s) imported!`);
    setPasteText('');
    setIsBulkOpen(false);
  };

  const handleImportQuestions = (importedQs) => {
    if (questions.length === 1 && !questions[0].question) {
      setQuestions(importedQs);
    } else {
      setQuestions(prev => [...prev, ...importedQs]);
    }
  };

  // ── Excel handler ─────────────────────────────────────────────────────────
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData();
    fd.append('file', file); fd.append('mode', 'quiz'); fd.append('uploadImages', 'true');
    setExcelParsing(true);
    try {
      const { data } = await api.post('/import/parse-excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const mapped = (data.questions || []).map(q => ({
        question: q.question || '', options: q.options?.length >= 2 ? q.options : ['', '', '', ''],
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0, imageUrl: q.imageUrl || '',
        section: q.section || '',
      }));
      if (questions.length === 1 && !questions[0].question) setQuestions(mapped);
      else setQuestions(prev => [...prev, ...mapped]);
      (data.errors || []).forEach(e => toast.error(e, { duration: 4000 }));
      toast.success(`${data.count} question(s) loaded!`);
      setIsBulkOpen(false);
    } catch (err) { toast.error(err.response?.data?.message || err.message || 'Failed to parse Excel'); }
    finally { setExcelParsing(false); if (excelRef.current) excelRef.current.value = ''; }
  };

  // ── Per-question local image upload → Cloudinary ─────────────────────────
  const handleImageFileUpload = async (qIdx, file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return; }
    setUploadingImg(prev => ({ ...prev, [qIdx]: true }));
    try {
      const fd = new FormData(); fd.append('image', file);
      const { data } = await api.post('/import/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.success && data.url) {
        setQuestions(prev => { const u = [...prev]; u[qIdx] = { ...u[qIdx], imageUrl: data.url }; return u; });
        toast.success('Image uploaded to Cloudinary!');
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Image upload failed'); }
    finally {
      setUploadingImg(prev => ({ ...prev, [qIdx]: false }));
      if (imgRefs.current[qIdx]) imgRefs.current[qIdx].value = '';
    }
  };

  const setQ = (idx, field, val) => setQuestions(prev => { const u = [...prev]; u[idx][field] = val; return u; });
  const setOpt = (qi, oi, val) => setQuestions(prev => { const u = [...prev]; u[qi].options[oi] = val; return u; });

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { toast.error(`Question ${i+1} text is required`); return; }
      if (q.options.some(o => !o.trim())) { toast.error(`All options of question ${i+1} must be filled`); return; }
    }
    if (!form.courseId || !form.title) { toast.error('Please select a course and add a title'); return; }
    if (qpsError) { toast.error(qpsError); return; }
    if (sectionDistError) { toast.error(sectionDistError); return; }

    setLoading(true);
    try {
      await api.post('/quiz', { 
        courseId: form.courseId, 
        title: form.title, 
        questions, 
        timeLimitSeconds: Number(form.timeLimitMinutes) * 60, 
        passingScore: Number(form.passingScore),
        instructions: form.instructions,
        questionsPerStudent: enableSectionDist ? null : (qps > 0 ? qps : null),
        shuffleQuestions: form.shuffleQuestions,
        shuffleOptions: form.shuffleOptions,
        sectionDistribution: enableSectionDist ? sectionDistribution.filter(d => d.questionsToDeliver > 0) : [],
      });
      toast.success('Assessment created successfully!');
      navigate('/admin');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create assessment'); }
    finally { setLoading(false); }
  };

  const TAB_STYLE = (active) => ({
    padding: '8px 20px', borderRadius: 6, fontWeight: 800, fontSize: '0.85rem',
    border: '2px solid #f59e0b', cursor: 'pointer',
    background: active ? '#f59e0b' : 'transparent',
    color: active ? '#fff' : '#f59e0b', transition: 'all 0.15s',
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <button onClick={() => navigate('/admin/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '1rem', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
            onMouseOver={e => e.currentTarget.style.color = '#1e293b'}
            onMouseOut={e => e.currentTarget.style.color = '#64748b'}>
            <ArrowLeft size={18} /> Back to Dashboard
          </button>
          <h1>Create Assessment</h1>
          <p>Configure quiz settings, randomization engine, and add questions.</p>
        </div>

        {/* ── Bulk Import Panel ─────────────────────────────────────────────── */}
        <div className="card" style={{ maxWidth: 780, marginBottom: 24, border: isBulkOpen ? '2px solid #f59e0b' : '1px dashed var(--border)', background: isBulkOpen ? '#fffbeb' : '#fff', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isBulkOpen ? 16 : 0 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Upload size={17} color="#f59e0b" />
              Bulk Question Import
              <span style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                ⚡ SAME ENGINE AS LIVE POLLS
              </span>
            </h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={() => setIsImportModalOpen(true)}
                style={{ background: '#4f46e5', color: '#fff', fontWeight: 800, border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Database size={16} /> Import Questions
              </button>
              <button type="button" onClick={() => setIsBulkOpen(o => !o)}
                style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                {isBulkOpen ? '← Close' : '⚡ Open Bulk Upload'}
              </button>
            </div>
          </div>

          {isBulkOpen && (
            <div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button type="button" style={TAB_STYLE(bulkTab === 'paste')} onClick={() => setBulkTab('paste')}>
                  <AlignLeft size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />📝 Text Paste
                </button>
                <button type="button" style={TAB_STYLE(bulkTab === 'excel')} onClick={() => setBulkTab('excel')}>
                  <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />📊 Excel Upload
                </button>
              </div>

              {/* ── Text Paste Tab ── */}
              {bulkTab === 'paste' && (
                <div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.8rem', marginBottom: 14, fontSize: '0.82rem', color: '#166534' }}>
                    <strong>Format:</strong> Separate questions with a blank line. Mark correct answer with <code>*</code> prefix <em>or</em> add <code>Correct Answer: B</code> line.
                    <br />
                    <code style={{ display: 'block', marginTop: 6, whiteSpace: 'pre', color: '#15803d' }}>
{`1. What is 2+2?
a) 3
*b) 4   ← correct (star prefix)
c) 5

2. Capital of France?
a) London
b) Berlin
c) Paris
Correct Answer: C`}
                    </code>
                  </div>
                  <textarea className="form-input"
                    style={{ minHeight: 220, fontFamily: 'monospace', fontSize: '0.88rem', marginBottom: 12, resize: 'vertical' }}
                    placeholder="Paste your questions here…"
                    value={pasteText} onChange={e => setPasteText(e.target.value)} />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={handlePasteParse}
                      style={{ background: '#f59e0b', borderColor: '#f59e0b', fontWeight: 800 }}>
                      Process &amp; Fill Form
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setPasteText('')}>Clear</button>
                  </div>
                </div>
              )}

              {/* ── Excel Tab ── */}
              {bulkTab === 'excel' && (
                <div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.85rem', marginBottom: 14, fontSize: '0.82rem', color: '#475569' }}>
                    <strong style={{ color: '#1e293b' }}>Required columns:</strong>{' '}
                    {['Question ✅', 'Option A ✅', 'Option B ✅', 'Option C', 'Option D', 'Correct Answer ✅ (A/B/C/D)', 'Image URL (optional)'].map((c, i) => (
                      <span key={i} style={{ marginRight: 10 }}>• {c}</span>
                    ))}
                    <br />
                    <span style={{ color: '#7c3aed', fontSize: '0.78rem' }}>💡 URLs in the <strong>Image URL</strong> column are auto-uploaded to Cloudinary.</span>
                  </div>
                  <input type="file" accept=".xlsx,.xls" ref={excelRef} style={{ display: 'none' }} id="quiz-excel-upload" onChange={handleExcelUpload} disabled={excelParsing} />
                  <label htmlFor="quiz-excel-upload" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, cursor: excelParsing ? 'wait' : 'pointer',
                    opacity: excelParsing ? 0.65 : 1, background: '#f59e0b', color: '#fff', fontWeight: 800,
                    padding: '12px 24px', borderRadius: 8, fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                  }}>
                    {excelParsing ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Parsing…</> : <><FileText size={17} /> Choose Excel File (.xlsx)</>}
                  </label>
                  <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#64748b' }}>
                    Loaded: <strong>{questions.length}</strong> question(s)
                    {questions.some(q => q.imageUrl) && <span style={{ marginLeft: 8, color: '#7c3aed' }}>· {questions.filter(q => q.imageUrl).length} with images</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quiz Settings */}
          <div className="card" style={{ maxWidth: 780, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Quiz Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Course *</label>
                <select id="quiz-course" className="form-input" name="courseId" value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })}>
                  <option value="">-- Select course --</option>
                  {courses?.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quiz Title *</label>
                <input id="quiz-title" className="form-input" name="title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Module 1 Assessment" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Time Limit (minutes)</label>
                <input id="quiz-time" className="form-input" type="number" name="timeLimitMinutes" min={1} max={180} value={form.timeLimitMinutes} onChange={e => setForm({ ...form, timeLimitMinutes: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Passing Score (%)</label>
                <input id="quiz-passing" className="form-input" type="number" name="passingScore" min={0} max={100} value={form.passingScore} onChange={e => setForm({ ...form, passingScore: e.target.value })} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', marginBottom: 0 }}>
                <label className="form-label">Assessment Instructions (Optional)</label>
                <textarea 
                  id="quiz-instructions" 
                  className="form-input" 
                  name="instructions" 
                  placeholder="e.g. Read each question carefully. No calculators allowed except for the built-in one." 
                  style={{ minHeight: 100, resize: 'vertical' }}
                  value={form.instructions || ''} 
                  onChange={e => setForm({ ...form, instructions: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* ── Randomization Engine ─────────────────────────────────────────── */}
          <div className="card" style={{
            maxWidth: 780, marginBottom: 24,
            border: isRandomizationOpen ? '2px solid #8DC63F' : '1px solid #cbd5e1',
            background: isRandomizationOpen ? 'linear-gradient(135deg, #fcfefe 0%, #f7fbf2 100%)' : '#ffffff',
            transition: 'all 0.25s ease',
            boxShadow: isRandomizationOpen ? '0 4px 20px rgba(141, 198, 63, 0.08)' : 'var(--shadow-sm)',
          }}>
            {/* Header */}
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setIsRandomizationOpen(o => !o)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isRandomized ? '#8DC63F' : '#e2e8f0',
                }}>
                  <Shuffle size={18} color={isRandomized ? '#ffffff' : '#5b5b5b'} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#3D3D3D' }}>
                      Randomization Engine
                    </h2>
                    {isRandomized && (
                      <span style={{
                        background: '#8DC63F', color: '#ffffff', fontSize: '0.65rem',
                        fontWeight: 800, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.5px'
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#5b5b5b' }}>
                    Configure anti-cheating paper randomization for this assessment
                  </p>
                </div>
              </div>
              <div style={{ color: '#5b5b5b' }}>
                {isRandomizationOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>

            {/* Pool counter badge — always visible */}
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(141, 198, 63, 0.05)', color: '#3D3D3D', border: '1px solid rgba(141, 198, 63, 0.3)',
                borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700,
              }}>
                <Users size={13} color="#8DC63F" /> Master Pool: {questions.length} question{questions.length !== 1 ? 's' : ''}
              </span>
              {qps > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: qpsError ? '#fff1f2' : 'rgba(141, 198, 63, 0.05)',
                  color: qpsError ? '#b91c1c' : '#3D3D3D',
                  border: `1px solid ${qpsError ? '#fecaca' : 'rgba(141, 198, 63, 0.3)'}`,
                  borderRadius: 20, padding: '4px 12px', fontSize: '0.78rem', fontWeight: 700,
                }}>
                  {qpsError ? <AlertCircle size={13} /> : <Shuffle size={13} color="#8DC63F" />}
                  {qpsError ? qpsError : `Each student receives: ${qps} questions`}
                </span>
              )}
            </div>

            {/* Expanded config */}
            {isRandomizationOpen && (
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #cbd5e1' }}>

                {/* Info box */}
                <div style={{
                  background: 'rgba(61, 61, 61, 0.03)', border: '1px solid #cbd5e1',
                  borderLeft: '4px solid #8DC63F',
                  borderRadius: 6, padding: '12px 16px', marginBottom: 20,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <Info size={16} color="#8DC63F" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ fontSize: '0.8rem', color: '#3D3D3D', lineHeight: 1.5 }}>
                    <strong>How it works:</strong> When a student opens this exam, the system generates a unique frozen paper —
                    randomly selecting questions from your pool, shuffling their order and option order (if enabled).
                    The paper is saved permanently so <strong>refresh or reconnect always restores the same paper</strong>.
                    Analytics, PDFs, and scores all use the frozen snapshot, never the master pool directly.
                  </div>
                </div>

                {/* Questions Per Student (Only if Section Distribution is disabled) */}
                {!enableSectionDist ? (
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3D3D3D' }}>
                      <Users size={14} color="#8DC63F" />
                      Questions Per Student
                      <span style={{ fontWeight: 400, color: '#5b5b5b', fontSize: '0.78rem' }}>(leave blank to deliver all {questions.length})</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <input
                        id="quiz-qps"
                        className="form-input"
                        type="number"
                        min={1}
                        max={questions.length}
                        value={form.questionsPerStudent}
                        onChange={e => setForm({ ...form, questionsPerStudent: e.target.value })}
                        placeholder={`Max ${questions.length} (pool size)`}
                        style={{
                          maxWidth: 220,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          borderColor: qpsError ? '#f87171' : undefined,
                          boxShadow: qpsError ? '0 0 0 3px rgba(239,68,68,0.15)' : undefined,
                        }}
                      />
                      {qps > 0 && !qpsError && (
                        <div style={{ fontSize: '0.82rem', color: '#8DC63F', fontWeight: 600 }}>
                          {Math.round((qps / questions.length) * 100)}% of pool selected per student
                        </div>
                      )}
                    </div>
                    {qpsError && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: '0.8rem', fontWeight: 600 }}>
                        <AlertCircle size={14} /> {qpsError}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(141, 198, 63, 0.05)', border: '1px solid rgba(141, 198, 63, 0.3)',
                    borderRadius: 6, padding: '12px 16px', marginBottom: 16, fontSize: '0.8rem', color: '#3D3D3D'
                  }}>
                    ℹ️ <strong>Questions Per Student:</strong> Overridden by Section Distribution configuration (Total: {sectionDistribution.reduce((sum, d) => sum + (d.questionsToDeliver || 0), 0)} questions).
                  </div>
                )}

                {/* Toggle switches */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <ToggleSwitch
                    checked={form.shuffleQuestions}
                    onChange={v => setForm({ ...form, shuffleQuestions: v })}
                    label="Shuffle Question Order"
                    description="Randomize the sequence of questions shown to each student — every student sees a different order"
                  />
                  <ToggleSwitch
                    checked={form.shuffleOptions}
                    onChange={v => setForm({ ...form, shuffleOptions: v })}
                    label="Shuffle Option Order"
                    description="Randomize A/B/C/D option positions for each MCQ — prevents answer-pattern copying"
                  />
                  <ToggleSwitch
                    checked={enableSectionDist}
                    onChange={setEnableSectionDist}
                    label="Enable Section-Based Question Distribution"
                    description="Deliver a balanced set of questions from specific categories rather than drawing globally"
                  />
                </div>

                {/* Section Distribution Table */}
                {enableSectionDist && (
                  <div style={{ marginTop: 16, padding: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3D3D3D', marginBottom: 12 }}>
                      Section Distribution Configuration
                    </h3>
                    
                    {sectionDistribution.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <AlertCircle size={14} /> No sections found in the questions below. Please add a section/category to your questions first.
                      </div>
                    ) : (
                      <div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                              <th style={{ padding: '8px 4px', fontWeight: 700 }}>Section / Category</th>
                              <th style={{ padding: '8px 4px', fontWeight: 700, width: 100 }}>Pool Size</th>
                              <th style={{ padding: '8px 4px', fontWeight: 700, width: 180 }}>Questions to Deliver</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sectionDistribution.map((dist, idx) => {
                              const poolSizeVal = questions.filter(q => (q.section || '').trim() === dist.section).length;
                              const deliverVal = dist.questionsToDeliver || 0;
                              const hasError = deliverVal > poolSizeVal || deliverVal <= 0;

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px 4px', fontWeight: 600, color: '#1e293b' }}>
                                    {dist.section}
                                  </td>
                                  <td style={{ padding: '10px 4px', color: '#475569' }}>
                                    <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                                      {poolSizeVal}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 4px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <input
                                        type="number"
                                        min={0}
                                        max={poolSizeVal}
                                        className="form-input"
                                        style={{
                                          width: 80,
                                          padding: '4px 8px',
                                          margin: 0,
                                          fontSize: '0.85rem',
                                          borderColor: hasError ? '#f87171' : undefined,
                                        }}
                                        value={dist.questionsToDeliver || ''}
                                        onChange={e => {
                                          const val = parseInt(e.target.value) || 0;
                                          setSectionDistribution(prev => {
                                            const u = [...prev];
                                            u[idx] = { ...u[idx], questionsToDeliver: val };
                                            return u;
                                          });
                                        }}
                                      />
                                      {hasError && (
                                        <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                          <AlertCircle size={12} /> Limit: 1-{poolSizeVal}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        
                        {/* Total deliveries summary */}
                        <div style={{ marginTop: 12, padding: 8, background: '#f8fafc', borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                          <span>Total Questions Configured to Deliver:</span>
                          <span style={{ color: '#8DC63F' }}>
                            {sectionDistribution.reduce((sum, d) => sum + (d.questionsToDeliver || 0), 0)} questions
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview summary */}
                <div style={{
                  marginTop: 16, padding: '12px 16px', borderRadius: 8,
                  background: isRandomized ? 'rgba(141, 198, 63, 0.04)' : '#f8fafc',
                  border: `1px solid ${isRandomized ? 'rgba(141, 198, 63, 0.25)' : '#cbd5e1'}`,
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isRandomized ? '#3D3D3D' : '#5b5b5b', marginBottom: 6 }}>
                    {isRandomized ? '✅ Randomization Active — Summary' : '⚪ No Randomization — Standard delivery'}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.78rem', color: isRandomized ? '#4F4F4F' : '#5b5b5b', lineHeight: 1.8 }}>
                    <li>Pool size: <strong>{questions.length} questions</strong></li>
                    <li>
                      Delivered per student:{' '}
                      <strong>
                        {enableSectionDist
                          ? `${sectionDistribution.reduce((sum, d) => sum + (d.questionsToDeliver || 0), 0)} (categorized balanced)`
                          : qps > 0
                          ? `${qps} (randomly selected)`
                          : `All ${questions.length}`}
                      </strong>
                    </li>
                    <li>Question order: <strong>{form.shuffleQuestions ? 'Shuffled per student' : 'Fixed'}</strong></li>
                    <li>Option order: <strong>{form.shuffleOptions ? 'Shuffled per student' : 'Fixed'}</strong></li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Bulk Category Assignment */}
          {questions.length > 0 && (
            <div className="card" style={{ maxWidth: 780, marginBottom: 16, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input 
                  type="checkbox" 
                  checked={selectedQs.size === questions.length && questions.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedQs(new Set(questions.map((_, i) => i)));
                    else setSelectedQs(new Set());
                  }}
                  style={{ cursor: 'pointer', width: 16, height: 16 }}
                />
                <span style={{ fontWeight: 600, color: '#1e3a8a', fontSize: '0.9rem' }}>
                  {selectedQs.size} Selected
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select 
                  className="form-input" 
                  style={{ margin: 0, padding: '6px 12px', minWidth: 180, borderColor: '#bfdbfe' }}
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value)}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(c => <option key={c._id} value={c.name}>{c.name}</option>)}
                </select>
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedQs.size === 0) { toast.error('Select questions first'); return; }
                    setQuestions(prev => prev.map((q, i) => selectedQs.has(i) ? { ...q, section: bulkCategory } : q));
                    toast.success(`Category applied to ${selectedQs.size} question(s)!`);
                    setSelectedQs(new Set());
                    setBulkCategory('');
                  }}
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  Apply to Selected
                </button>
              </div>
            </div>
          )}

          {/* Questions */}
          {questions.map((q, qi) => (
            <div key={qi} className="card" style={{ maxWidth: 780, marginBottom: 16, border: selectedQs.has(qi) ? '2px solid #3b82f6' : '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input 
                    type="checkbox" 
                    checked={selectedQs.has(qi)}
                    onChange={() => {
                      const newSet = new Set(selectedQs);
                      if (newSet.has(qi)) newSet.delete(qi);
                      else newSet.add(qi);
                      setSelectedQs(newSet);
                    }}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <p style={{ fontWeight: 800, fontSize: '0.8rem', margin: 0 }}>QUESTION {qi + 1}</p>
                </div>
                {questions.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => {
                    setQuestions(prev => prev.filter((_, i) => i !== qi));
                    const newSet = new Set(selectedQs);
                    newSet.delete(qi);
                    setSelectedQs(newSet);
                  }}>Delete</button>
                )}
              </div>

              {/* ── Image Section ── */}
              <div style={{ marginBottom: 14, padding: '12px', background: '#fafafa', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8, display: 'block' }}>
                  🖼️ Question Image <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
                </label>

                {/* Preview */}
                {q.imageUrl && (
                  <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
                    <img src={q.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid #e2e8f0', display: 'block' }}
                      onError={e => e.currentTarget.style.display = 'none'} />
                    <button type="button" onClick={() => setQ(qi, 'imageUrl', '')}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove image"><X size={12} /></button>
                    <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#7c3aed', fontWeight: 600 }}>✅ Saved to Cloudinary</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Upload from system */}
                  <input type="file" accept="image/*"
                    ref={el => imgRefs.current[qi] = el}
                    style={{ display: 'none' }} id={`img-upload-${qi}`}
                    onChange={e => handleImageFileUpload(qi, e.target.files[0])}
                    disabled={!!uploadingImg[qi]} />
                  <label htmlFor={`img-upload-${qi}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploadingImg[qi] ? 'wait' : 'pointer',
                    background: uploadingImg[qi] ? '#e2e8f0' : '#7c3aed', color: '#fff', fontWeight: 700,
                    padding: '7px 14px', borderRadius: 6, fontSize: '0.82rem', opacity: uploadingImg[qi] ? 0.7 : 1,
                  }}>
                    {uploadingImg[qi]
                      ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…</>
                      : <><Image size={14} /> Upload from System</>}
                  </label>

                  {/* Or paste URL */}
                  <input className="form-input" placeholder="…or paste image URL here"
                    value={q.imageUrl} onChange={e => setQ(qi, 'imageUrl', e.target.value)}
                    style={{ flex: 1, minWidth: 180, fontSize: '0.82rem' }} />
                </div>
              </div>

              {/* Section / Category */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  🏷️ Section / Category
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 400 }}>(Managed in Categories menu)</span>
                </label>
                <select
                  id={`question-section-${qi}`}
                  className="form-input"
                  value={q.section || ''}
                  onChange={e => setQ(qi, 'section', e.target.value)}
                  style={{ fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  <option value="">[ Select Section ▼ ]</option>
                  {categories.map(c => (
                    <option key={c._id} value={c.name}>{c.name}</option>
                  ))}
                  {/* Allow imported sections that aren't loaded yet to still show up properly */}
                  {q.section && !categories.find(c => c.name === q.section) && (
                    <option value={q.section}>{q.section} (New)</option>
                  )}
                </select>
              </div>

              {/* Question Text */}
              <div className="form-group">
                <label className="form-label">Question Text *</label>
                <input id={`question-${qi}`} className="form-input" placeholder="Type your question here…"
                  value={q.question} onChange={e => setQ(qi, 'question', e.target.value)} />
              </div>

              {/* Options */}
              <label className="form-label">Options — click letter badge to mark correct</label>
              <div className="options-row">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="option-row">
                    <div className={`option-label-badge ${q.correctAnswer === oi ? 'correct' : ''}`}
                      onClick={() => setQuestions(prev => { const u = [...prev]; u[qi].correctAnswer = oi; return u; })}
                      style={{ borderRadius: 0, width: 'auto', padding: '0 8px', cursor: 'pointer' }}>
                      {q.correctAnswer === oi ? 'CORRECT' : String.fromCharCode(65 + oi)}
                    </div>
                    <input id={`q${qi}-opt${oi}`} className="form-input"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      value={opt} onChange={e => setOpt(qi, oi, e.target.value)} style={{ flex: 1 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, maxWidth: 780, marginBottom: 32, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}>
              + Add Another Question
            </button>
            <button id="quiz-submit" type="submit" className="btn btn-primary" style={{ background: 'var(--accent-secondary)' }} disabled={loading || !!qpsError}>
              {loading ? 'Saving…' : 'Save Assessment Data'}
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </main>
      
      <ImportQuestionModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImportQuestions} 
      />
    </div>
  );
}
