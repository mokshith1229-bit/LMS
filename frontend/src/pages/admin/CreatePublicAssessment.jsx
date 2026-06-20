import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChevronRight, ChevronLeft, Check, Globe, Image, Sliders, List,
  Settings, Share2, Plus, Trash2, Upload, Eye, EyeOff, Clock,
  Link2, Copy, MessageSquare, Mail, Smartphone, Download
} from 'lucide-react';
import { createPublicAssessment, getAdminQuizList, getQuizQuestions } from '../../api/publicAssessmentApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';

const STEPS = [
  { id: 1, label: 'Info', icon: <Globe size={16} /> },
  { id: 2, label: 'Fields', icon: <List size={16} /> },
  { id: 3, label: 'Questions', icon: <Sliders size={16} /> },
  { id: 4, label: 'Settings', icon: <Settings size={16} /> },
  { id: 5, label: 'Share', icon: <Share2 size={16} /> },
];

const DEFAULT_FIELDS = [
  { fieldName: 'fullName', label: 'Full Name', enabled: true, required: true },
  { fieldName: 'mobile', label: 'Mobile Number', enabled: true, required: true },
  { fieldName: 'flatNo', label: 'Flat / House Number', enabled: false, required: false },
  { fieldName: 'email', label: 'Email Address', enabled: false, required: false },
  { fieldName: 'employeeId', label: 'Employee ID', enabled: false, required: false },
  { fieldName: 'organization', label: 'Organization', enabled: false, required: false },
  { fieldName: 'city', label: 'City', enabled: false, required: false },
  { fieldName: 'customField', label: 'Custom Field', enabled: false, required: false },
];

const BLANK_Q = { question: '', options: ['', '', '', ''], correctAnswer: '0', imageUrl: '', section: '' };

export default function CreatePublicAssessment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const qrRef = useRef(null);

  // Step 1 — Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bgTheme, setBgTheme] = useState('gradient');
  const [solidColor, setSolidColor] = useState('#4f46e5');
  const [gradFrom, setGradFrom] = useState('#4f46e5');
  const [gradTo, setGradTo] = useState('#7c3aed');

  // Step 2 — Fields
  const [fields, setFields] = useState(DEFAULT_FIELDS);

  // Step 3 — Questions
  const [questionMode, setQuestionMode] = useState('new'); // 'new' | 'existing'
  const [questions, setQuestions] = useState([{ ...BLANK_Q }]);
  const [quizList, setQuizList] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [duration, setDuration] = useState(30); // minutes

  // Step 4 — Settings
  const [showScore, setShowScore] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [passingScore, setPassingScore] = useState(60);

  useEffect(() => {
    getAdminQuizList()
      .then(r => setQuizList(r.quizzes || []))
      .catch(() => {});
  }, []);

  const handleBannerChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setBgTheme('banner');
  };

  const loadQuizQuestions = async (quizId) => {
    if (!quizId) return;
    setLoadingQuiz(true);
    try {
      const { quiz } = await getQuizQuestions(quizId);
      setQuestions(quiz.questions.map(q => ({
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        imageUrl: q.imageUrl || '',
        section: q.section || '',
      })));
      if (quiz.duration) setDuration(Math.floor(quiz.duration / 60));
      toast.success(`Imported ${quiz.questions.length} questions from "${quiz.title}"`);
    } catch {
      toast.error('Failed to load quiz questions');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const updateField = (idx, key, val) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: val } : f));
  };

  const addQuestion = () => setQuestions(prev => [...prev, { ...BLANK_Q, options: ['', '', '', ''] }]);

  const removeQuestion = (idx) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, key, val) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [key]: val } : q));
  };

  const updateOption = (qIdx, oIdx, val) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[oIdx] = val;
      return { ...q, options: opts };
    }));
  };

  const addOption = (qIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx || q.options.length >= 6) return q;
      return { ...q, options: [...q.options, ''] };
    }));
  };

  const removeOption = (qIdx, oIdx) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx || q.options.length <= 2) return q;
      const opts = q.options.filter((_, oi) => oi !== oIdx);
      const correct = parseInt(q.correctAnswer);
      return {
        ...q,
        options: opts,
        correctAnswer: correct >= opts.length ? '0' : q.correctAnswer,
      };
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!title.trim()) { toast.error('Please enter an assessment title'); return false; }
    }
    if (step === 3) {
      const invalid = questions.some(q => !q.question.trim() || q.options.some(o => !o.trim()));
      if (invalid) { toast.error('Please fill all questions and options'); return false; }
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(5, s + 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);

    try {
      const payload = {
        title,
        description,
        backgroundTheme: bgTheme,
        solidColor,
        gradientFrom: gradFrom,
        gradientTo: gradTo,
        candidateFields: fields,
        questions,
        duration: duration * 60,
        passingScore,
        showScore,
        isActive,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      };

      if (selectedQuizId && questionMode === 'existing') {
        payload.sourceQuizId = selectedQuizId;
      }

      const fd = new FormData();
      if (bannerFile) fd.append('bannerImage', bannerFile);
      fd.append('data', JSON.stringify(payload));

      const { assessment } = await createPublicAssessment(fd);
      setCreatedToken(assessment.token);
      setCreatedId(assessment._id);
      setStep(5);
      toast.success('Assessment created successfully! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = createdToken ? `${window.location.origin}/p/${createdToken}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    toast.success('Link copied!');
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Take the assessment: ${publicUrl}`)}`, '_blank');
  };

  const shareSMS = () => {
    window.open(`sms:?body=${encodeURIComponent(`Take the assessment: ${publicUrl}`)}`, '_blank');
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Take the assessment: ${publicUrl}`)}`, '_blank');
  };

  const downloadQR = () => {
    const svg = document.getElementById('public-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_QR.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: '0.9rem', background: '#fff', outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block', fontSize: '0.85rem', fontWeight: 700,
    color: '#374151', marginBottom: 6,
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={22} color="#4f46e5" />
              Create Public Assessment
            </h1>
            <p>Build a shareable assessment for anyone — no login required</p>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 36, overflowX: 'auto' }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: 8, cursor: step > s.id ? 'pointer' : 'default',
                background: step === s.id ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : step > s.id ? '#f5f3ff' : '#f8fafc',
                color: step === s.id ? '#fff' : step > s.id ? '#7c3aed' : '#94a3b8',
                fontWeight: step === s.id ? 700 : 600, fontSize: '0.85rem',
                border: step === s.id ? 'none' : '1px solid #e2e8f0',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
                onClick={() => { if (step > s.id) setStep(s.id); }}
              >
                {step > s.id ? <Check size={14} /> : s.icon}
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 32, height: 2, background: step > s.id ? '#ddd6fe' : '#e2e8f0', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ maxWidth: 780, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 36 }}>

          {/* ── STEP 1: Info ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Assessment Details</h2>

              <div>
                <label style={labelStyle}>Assessment Title *</label>
                <input
                  style={inputStyle}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. National Yoga Day Assessment"
                />
              </div>

              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description shown to candidates before they start..."
                />
              </div>

              <div>
                <label style={labelStyle}>Background Theme</label>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  {[
                    { val: 'gradient', label: 'Gradient' },
                    { val: 'solid', label: 'Solid Color' },
                    { val: 'banner', label: 'Custom Banner' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      onClick={() => setBgTheme(opt.val)}
                      style={{
                        padding: '8px 18px', borderRadius: 8,
                        border: bgTheme === opt.val ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                        background: bgTheme === opt.val ? '#ede9fe' : '#fff',
                        color: bgTheme === opt.val ? '#4f46e5' : '#64748b',
                        fontWeight: bgTheme === opt.val ? 700 : 500,
                        cursor: 'pointer', fontSize: '0.875rem',
                        transition: 'all 0.18s',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {bgTheme === 'gradient' && (
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '0.8rem' }}>From Color</label>
                      <input type="color" value={gradFrom} onChange={e => setGradFrom(e.target.value)}
                        style={{ width: 60, height: 40, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: '0.8rem' }}>To Color</label>
                      <input type="color" value={gradTo} onChange={e => setGradTo(e.target.value)}
                        style={{ width: 60, height: 40, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                    </div>
                    <div style={{
                      flex: 1, height: 40, borderRadius: 8,
                      background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                      border: '1px solid #e2e8f0'
                    }} />
                  </div>
                )}

                {bgTheme === 'solid' && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="color" value={solidColor} onChange={e => setSolidColor(e.target.value)}
                      style={{ width: 60, height: 40, borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }} />
                    <div style={{ flex: 1, height: 40, borderRadius: 8, background: solidColor, border: '1px solid #e2e8f0' }} />
                  </div>
                )}

                {bgTheme === 'banner' && (
                  <div>
                    <label style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, padding: 24, border: '2px dashed #e2e8f0', borderRadius: 10, cursor: 'pointer',
                      background: bannerPreview ? 'none' : '#f8fafc', position: 'relative', overflow: 'hidden',
                      minHeight: 140,
                    }}>
                      {bannerPreview ? (
                        <img src={bannerPreview} alt="Banner preview" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }} />
                      ) : (
                        <>
                          <Image size={28} color="#94a3b8" />
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Click to upload banner image</span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>PNG, JPG, WebP — Recommended: 1200×400</span>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleBannerChange} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Candidate Fields ── */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Candidate Details Form</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 24 }}>
                Choose which fields to collect from candidates before they start the assessment.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map((field, idx) => (
                  <div key={field.fieldName} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                    background: field.enabled ? '#f5f3ff' : '#f8fafc',
                    border: `1px solid ${field.enabled ? '#ddd6fe' : '#e2e8f0'}`,
                    borderRadius: 10, transition: 'all 0.2s',
                  }}>
                    {/* Enable toggle */}
                    <input
                      type="checkbox"
                      checked={field.enabled}
                      onChange={e => {
                        updateField(idx, 'enabled', e.target.checked);
                        if (!e.target.checked) updateField(idx, 'required', false);
                      }}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#4f46e5' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: field.enabled ? '#4f46e5' : '#64748b' }}>
                        {field.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{field.fieldName}</div>
                    </div>
                    {field.enabled && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: '#7c3aed', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => updateField(idx, 'required', e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: '#7c3aed' }}
                        />
                        Required
                      </label>
                    )}
                    <span style={{
                      fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                      background: field.enabled ? '#ddd6fe' : '#e2e8f0',
                      color: field.enabled ? '#4f46e5' : '#94a3b8',
                    }}>
                      {field.enabled ? (field.required ? 'Required' : 'Optional') : 'Disabled'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Questions ── */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: 6 }}>Questions</h2>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: 20 }}>Add questions or import from an existing assessment.</p>

              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {[
                  { val: 'new', label: '✏️ Create New Questions' },
                  { val: 'existing', label: '📥 Import from Existing Assessment' },
                ].map(m => (
                  <button key={m.val} onClick={() => setQuestionMode(m.val)} style={{
                    padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                    border: questionMode === m.val ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                    background: questionMode === m.val ? '#ede9fe' : '#fff',
                    color: questionMode === m.val ? '#4f46e5' : '#64748b',
                    transition: 'all 0.18s',
                  }}>{m.label}</button>
                ))}
              </div>

              {questionMode === 'existing' && (
                <div style={{ marginBottom: 24, padding: 20, background: '#f5f3ff', borderRadius: 10, border: '1px solid #ddd6fe' }}>
                  <label style={labelStyle}>Select Assessment to Import</label>
                  <select
                    style={{ ...inputStyle, marginBottom: 12 }}
                    value={selectedQuizId}
                    onChange={e => setSelectedQuizId(e.target.value)}
                  >
                    <option value="">-- Select an assessment --</option>
                    {quizList.map(q => (
                      <option key={q._id} value={q._id}>
                        {q.title} ({q.questions?.length || 0} questions)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadQuizQuestions(selectedQuizId)}
                    disabled={!selectedQuizId || loadingQuiz}
                    style={{
                      padding: '10px 20px', borderRadius: 8, background: '#4f46e5', color: '#fff',
                      border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                      opacity: (!selectedQuizId || loadingQuiz) ? 0.5 : 1,
                    }}
                  >
                    {loadingQuiz ? 'Importing...' : '📥 Import Questions'}
                  </button>
                </div>
              )}

              {/* Duration */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 18px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <Clock size={18} color="#4f46e5" />
                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#374151', margin: 0 }}>Duration (minutes)</label>
                <input
                  type="number" min="1" max="480" value={duration}
                  onChange={e => setDuration(parseInt(e.target.value) || 30)}
                  style={{ ...inputStyle, width: 80, marginBottom: 0 }}
                />
              </div>

              {/* Question list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {questions.map((q, qIdx) => (
                  <div key={qIdx} style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#4f46e5' }}>Q{qIdx + 1}</span>
                      <button onClick={() => removeQuestion(qIdx)} disabled={questions.length <= 1}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, opacity: questions.length <= 1 ? 0.3 : 1 }}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <textarea
                      placeholder="Enter your question here..."
                      value={q.question}
                      onChange={e => updateQuestion(qIdx, 'question', e.target.value)}
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical', marginBottom: 14 }}
                    />

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ ...labelStyle, fontSize: '0.8rem' }}>Image URL (optional)</label>
                      <input
                        placeholder="https://... or leave empty"
                        value={q.imageUrl}
                        onChange={e => updateQuestion(qIdx, 'imageUrl', e.target.value)}
                        style={{ ...inputStyle }}
                      />
                    </div>

                    <div style={{ marginBottom: 6 }}>
                      <label style={{ ...labelStyle, fontSize: '0.8rem', marginBottom: 10 }}>
                        Options <span style={{ color: '#94a3b8', fontWeight: 500 }}>(select the correct one)</span>
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correctAnswer === String(oIdx)}
                              onChange={() => updateQuestion(qIdx, 'correctAnswer', String(oIdx))}
                              style={{ accentColor: '#10b981', width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                            />
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 800,
                              background: q.correctAnswer === String(oIdx) ? '#d1fae5' : '#f1f5f9',
                              color: q.correctAnswer === String(oIdx) ? '#065f46' : '#64748b',
                            }}>
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <input
                              value={opt}
                              onChange={e => updateOption(qIdx, oIdx, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                              style={{ ...inputStyle, flex: 1 }}
                            />
                            <button onClick={() => removeOption(qIdx, oIdx)} disabled={q.options.length <= 2}
                              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', opacity: q.options.length <= 2 ? 0.3 : 1 }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {q.options.length < 6 && (
                        <button onClick={() => addOption(qIdx)} style={{
                          marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
                          color: '#4f46e5', background: 'none', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}>
                          <Plus size={14} /> Add Option
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addQuestion} style={{
                marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
                background: '#f5f3ff', border: '2px dashed #ddd6fe', borderRadius: 10, color: '#4f46e5',
                fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', width: '100%', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                <Plus size={16} /> Add Question
              </button>
            </div>
          )}

          {/* ── STEP 4: Settings ── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: 8 }}>Assessment Settings</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div>
                  <label style={labelStyle}>Start Date (optional)</label>
                  <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                    style={inputStyle} />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Leave blank to allow access immediately when activated</p>
                </div>
                <div>
                  <label style={labelStyle}>End Date (optional)</label>
                  <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                    style={inputStyle} />
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>Leave blank for no expiry</p>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Passing Score (%)</label>
                <input type="number" min="0" max="100" value={passingScore}
                  onChange={e => setPassingScore(parseInt(e.target.value) || 60)}
                  style={{ ...inputStyle, maxWidth: 200 }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  {
                    key: 'showScore', val: showScore, set: setShowScore,
                    label: 'Show Score After Submission',
                    desc: 'Candidates will see their score and percentage on the thank-you page',
                    icon: showScore ? <Eye size={20} /> : <EyeOff size={20} />,
                  },
                  {
                    key: 'isActive', val: isActive, set: setIsActive,
                    label: 'Activate Assessment Immediately',
                    desc: 'The public link will be accessible as soon as you save',
                    icon: <Globe size={20} />,
                  },
                ].map(opt => (
                  <div key={opt.key} onClick={() => opt.set(v => !v)} style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px',
                    background: opt.val ? '#f5f3ff' : '#f8fafc',
                    border: `1px solid ${opt.val ? '#ddd6fe' : '#e2e8f0'}`,
                    borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
                  }}>
                    <div style={{ color: opt.val ? '#4f46e5' : '#94a3b8' }}>{opt.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: opt.val ? '#4f46e5' : '#374151' }}>{opt.label}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{opt.desc}</div>
                    </div>
                    <div style={{
                      width: 44, height: 24, borderRadius: 12, transition: 'background 0.2s',
                      background: opt.val ? '#4f46e5' : '#e2e8f0', position: 'relative', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        left: opt.val ? 23 : 3,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 5: Share ── */}
          {step === 5 && createdToken && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#fff',
              }}>
                <Check size={36} />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>Assessment Created!</h2>
              <p style={{ color: '#64748b', marginBottom: 32 }}>Share the link or QR code with your candidates</p>

              {/* URL Box */}
              <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link2 size={18} color="#4f46e5" style={{ flexShrink: 0 }} />
                <code style={{ flex: 1, fontSize: '0.875rem', color: '#4f46e5', wordBreak: 'break-all', textAlign: 'left' }}>{publicUrl}</code>
                <button onClick={copyLink} style={{
                  background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6,
                  padding: '6px 14px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                }}>
                  <Copy size={13} /> Copy
                </button>
              </div>

              {/* QR Code */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
                <div style={{ padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, display: 'inline-block', marginBottom: 14 }}>
                  <QRCodeSVG
                    id="public-qr-svg"
                    value={publicUrl}
                    size={180}
                    fgColor="#1e293b"
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <button onClick={downloadQR} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px',
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                  color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem',
                }}>
                  <Download size={15} /> Download QR Code
                </button>
              </div>

              {/* Share buttons */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                {[
                  { label: 'WhatsApp', icon: <MessageSquare size={16} />, color: '#25d366', bg: '#f0fdf4', border: '#bbf7d0', fn: shareWhatsApp },
                  { label: 'SMS', icon: <Smartphone size={16} />, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', fn: shareSMS },
                  { label: 'Email', icon: <Mail size={16} />, color: '#ef4444', bg: '#fff1f2', border: '#fecdd3', fn: shareEmail },
                ].map(s => (
                  <button key={s.label} onClick={s.fn} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                    background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
                    color: s.color, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
                    transition: 'all 0.18s',
                  }}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button onClick={() => navigate(`/admin/public-assessments/${createdId}/results`)}
                  style={{ padding: '10px 24px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                  View Results
                </button>
                <button onClick={() => navigate('/admin/public-assessments')}
                  style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  Back to Assessments
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          {step < 5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 36, paddingTop: 24, borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px',
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
                  fontWeight: 600, cursor: step === 1 ? 'not-allowed' : 'pointer',
                  opacity: step === 1 ? 0.4 : 1, color: '#374151',
                }}
              >
                <ChevronLeft size={16} /> Back
              </button>

              {step < 4 ? (
                <button onClick={goNext} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 28px',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none',
                  borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer',
                }}>
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={saving} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 28px',
                  background: saving ? '#94a3b8' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}>
                  {saving ? 'Creating...' : <><Check size={16} /> Create & Get Link</>}
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
