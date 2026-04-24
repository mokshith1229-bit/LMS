import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowLeft, CheckCircle, Upload, FileDown } from 'lucide-react';

const emptyQuestion = () => ({
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
});

export default function AddQuiz() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    courseId: '',
    title: 'CUBE HIGHWAYS',
    timeLimitMinutes: 30, // Default to 30 minutes
    passingScore: 60,
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const navigate = useNavigate();

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setParsing(true);
    try {
      const { data } = await api.post('/quiz/parse-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Append new questions to existing ones (or replace if they were empty)
      const newQuestions = data?.questions || data?.quiz?.questions;
      
      if (!newQuestions || !Array.isArray(newQuestions)) {
        throw new Error('Invalid response format from server: missing questions array');
      }

      if (questions.length === 1 && !questions[0].question) {
        setQuestions(newQuestions);
      } else {
        setQuestions([...questions, ...newQuestions]);
      }
      toast.success(`${data.count || newQuestions.length} questions loaded from Excel!`);
    } catch (err) {
      console.error('Excel processing error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to parse Excel';
      if (err.response?.data?.errors) {
        err.response.data.errors.forEach(e => toast.error(e));
      } else {
        toast.error(msg);
      }
    } finally {
      setParsing(false);
      e.target.value = ''; // Reset input
    }
  };

  useEffect(() => {
    api.get('/courses').then(({ data }) => setCourses(data.courses));
  }, []);

  const handleFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleQuestion = (qIdx, field, value) => {
    const updated = [...questions];
    updated[qIdx][field] = value;
    setQuestions(updated);
  };

  const handleOption = (qIdx, oIdx, value) => {
    const updated = [...questions];
    updated[qIdx].options[oIdx] = value;
    setQuestions(updated);
  };

  const handleCorrect = (qIdx, oIdx) => {
    const updated = [...questions];
    updated[qIdx].correctAnswer = oIdx;
    setQuestions(updated);
  };

  const addQuestion = () => setQuestions([...questions, emptyQuestion()]);

  const removeQuestion = (idx) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { toast.error(`Question ${i + 1} text is required`); return; }
      if (q.options.some((o) => !o.trim())) { toast.error(`All options of question ${i + 1} must be filled`); return; }
    }
    if (!form.courseId || !form.title) { toast.error('Please select a course and add a quiz title'); return; }

    setLoading(true);
    try {
      await api.post('/quiz', {
        courseId: form.courseId,
        title: form.title,
        questions,
        timeLimitSeconds: Number(form.timeLimitMinutes) * 60,
        passingScore: Number(form.passingScore),
      });
      toast.success('Quiz created successfully!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <button onClick={() => navigate('/admin')} className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
            &lt; Back 
          </button>
          <h1>Create Assessment</h1>
          <p>Configure quiz settings and add test questions.</p>
        </div>

        {/* Bulk Upload Section */}
        <div className="card" style={{ maxWidth: 780, marginBottom: 24, border: '1px dashed var(--border)', background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={18} /> Bulk Question Upload
            </h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Upload an Excel file (.xlsx) with columns: <b>Question, Option A, Option B, Option C, Option D, Correct Answer (A/B/C/D)</b>.
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              style={{ display: 'none' }}
              id="excel-upload-input"
              disabled={parsing}
            />
            <label 
              htmlFor="excel-upload-input" 
              className="btn btn-secondary" 
              style={{ cursor: 'pointer', opacity: parsing ? 0.6 : 1 }}
            >
              {parsing ? 'Parsing Excel...' : 'Choose Excel File'}
            </label>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Total Questions: {questions.length}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quiz Settings */}
          <div className="card" style={{ maxWidth: 780, marginBottom: 24 }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 20 }}>Quiz Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Course *</label>
                <select id="quiz-course" className="form-input" name="courseId" value={form.courseId} onChange={handleFormChange}>
                  <option value="">-- Select course --</option>
                  {courses?.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Quiz Title *</label>
                <input id="quiz-title" className="form-input" name="title" placeholder="e.g. Module 1 Assessment" value={form.title} onChange={handleFormChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Time Limit (minutes)</label>
                <input id="quiz-time" className="form-input" type="number" name="timeLimitMinutes" min={1} max={180} value={form.timeLimitMinutes} onChange={handleFormChange} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Passing Score (%)</label>
                <input id="quiz-passing" className="form-input" type="number" name="passingScore" min={0} max={100} value={form.passingScore} onChange={handleFormChange} />
              </div>
            </div>
          </div>

          {/* Questions */}
          {questions?.map((q, qIdx) => (
            <div key={qIdx} className="card" style={{ maxWidth: 780, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
                <p style={{ fontWeight: 800, fontSize: '0.8rem' }}>QUESTION {qIdx + 1}</p>
                {questions.length > 1 && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(qIdx)}>
                    Delete
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Question Text *</label>
                <input
                  id={`question-${qIdx}`}
                  className="form-input"
                  placeholder="Type your question here…"
                  value={q.question}
                  onChange={(e) => handleQuestion(qIdx, 'question', e.target.value)}
                />
              </div>

              <label className="form-label">Options — click the letter badge to mark correct answer</label>
              <div className="options-row">
                {q.options?.map((opt, oIdx) => (
                  <div key={oIdx} className="option-row">
                    <div
                      className={`option-label-badge ${q.correctAnswer === oIdx ? 'correct' : ''}`}
                      onClick={() => handleCorrect(qIdx, oIdx)}
                      style={{ borderRadius: 0, width: 'auto', padding: '0 8px' }}
                    >
                      {q.correctAnswer === oIdx ? 'CORRECT' : String.fromCharCode(65 + oIdx)}
                    </div>
                    <input
                      id={`q${qIdx}-opt${oIdx}`}
                      className="form-input"
                      placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                      value={opt}
                      onChange={(e) => handleOption(qIdx, oIdx, e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, maxWidth: 780, marginBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={addQuestion}>
              + Add Another Question
            </button>
            <button id="quiz-submit" type="submit" className="btn btn-primary" style={{ background: 'var(--accent-secondary)' }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Assessment Data'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
