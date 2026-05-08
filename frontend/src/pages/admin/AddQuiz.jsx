import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, FileText, AlignLeft, Image, X, Loader } from 'lucide-react';

const emptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  imageUrl: '',
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
      results.push({ question: questionText, options, correctAnswer: correctIndex, imageUrl: '' });
    }
  }
  return results;
}

export default function AddQuiz() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ courseId: '', title: 'CUBE HIGHWAYS', timeLimitMinutes: 30, passingScore: 60, instructions: '' });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkTab, setBulkTab] = useState('paste'); // 'paste' | 'excel'
  const [pasteText, setPasteText] = useState('');
  const [excelParsing, setExcelParsing] = useState(false);
  const [uploadingImg, setUploadingImg] = useState({}); // { [qIdx]: true }
  const excelRef = useRef(null);
  const imgRefs = useRef({});
  const navigate = useNavigate();

  useEffect(() => { api.get('/courses').then(({ data }) => setCourses(data.courses)); }, []);

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
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { toast.error(`Question ${i+1} text is required`); return; }
      if (q.options.some(o => !o.trim())) { toast.error(`All options of question ${i+1} must be filled`); return; }
    }
    if (!form.courseId || !form.title) { toast.error('Please select a course and add a title'); return; }
    setLoading(true);
    try {
      await api.post('/quiz', { 
        courseId: form.courseId, 
        title: form.title, 
        questions, 
        timeLimitSeconds: Number(form.timeLimitMinutes) * 60, 
        passingScore: Number(form.passingScore),
        instructions: form.instructions 
      });
      toast.success('Quiz created successfully!');
      navigate('/admin');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create quiz'); }
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
          <p>Configure quiz settings and add questions.</p>
        </div>

        {/* ── Bulk Import Panel ───────────────────────────────────────────── */}
        <div className="card" style={{ maxWidth: 780, marginBottom: 24, border: isBulkOpen ? '2px solid #f59e0b' : '1px dashed var(--border)', background: isBulkOpen ? '#fffbeb' : '#fff', transition: 'all 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isBulkOpen ? 16 : 0 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Upload size={17} color="#f59e0b" />
              Bulk Question Import
              <span style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20 }}>
                ⚡ SAME ENGINE AS LIVE POLLS
              </span>
            </h2>
            <button type="button" onClick={() => setIsBulkOpen(o => !o)}
              style={{ background: '#f59e0b', color: '#fff', fontWeight: 800, border: 'none', padding: '8px 18px', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
              {isBulkOpen ? '← Close' : '⚡ Open Bulk Upload'}
            </button>
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

          {/* Questions */}
          {questions.map((q, qi) => (
            <div key={qi} className="card" style={{ maxWidth: 780, marginBottom: 16, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                <p style={{ fontWeight: 800, fontSize: '0.8rem', margin: 0 }}>QUESTION {qi + 1}</p>
                {questions.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}>Delete</button>
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
            <button id="quiz-submit" type="submit" className="btn btn-primary" style={{ background: 'var(--accent-secondary)' }} disabled={loading}>
              {loading ? 'Saving…' : 'Save Assessment Data'}
            </button>
          </div>
        </form>

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </main>
    </div>
  );
}
