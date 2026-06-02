import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import { Trash2, Target, Users, Trophy, ArrowLeft, Clock, Timer, FileText, Image, X } from 'lucide-react';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function LivePoll() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([{ text: '', options: ['', ''], correctAnswer: '' }]);
  const [pollTitle, setPollTitle] = useState('');
  const [activePoll, setActivePoll] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkTab, setBulkTab] = useState('excel'); // 'excel' | 'paste'
  const [excelParsing, setExcelParsing] = useState(false);
  const excelFileRef = useRef(null);
  // Reveal mode state
  const [revealMode, setRevealMode] = useState('live');
  const [revealDelayMinutes, setRevealDelayMinutes] = useState(1);
  const [revealResults, setRevealResults] = useState(false);
  const [responseCount, setResponseCount] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0); // seconds

  // Import poll questions state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPollForImport, setSelectedPollForImport] = useState(null);
  const [selectedQuestionIndices, setSelectedQuestionIndices] = useState([]);

  // Socket connection
  useEffect(() => {
    if (!activePoll?.code) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    socket.emit('join_poll', `poll_admin_${activePoll.code}`);
    // Live mode: receive full chart data
    socket.on('poll_update', (data) => setChartData(data));
    // Delayed mode: receive only response count
    socket.on('poll_response_count', ({ count }) => setResponseCount(count));
    // Delayed mode: timer fired — reveal full results
    socket.on('poll_reveal', ({ results }) => {
      if (results) setChartData(results);
      setRevealResults(true);
      setTimerRunning(false);
      setTimeLeft(0);
      toast.success('Results revealed! Charts are now visible.');
    });
    return () => socket.disconnect();
  }, [activePoll?.code]);

  // Client-side countdown display (visual only — server enforces actual timer)
  useEffect(() => {
    if (!timerRunning || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timeLeft]);

  useEffect(() => { fetchHistory(); }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await api.get('/poll/admin/all');
      if (data.success) setHistory(data.polls);
    } catch (err) {
      console.error('Failed to fetch poll history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const viewPoll = async (poll) => {
    try {
      const { data } = await api.get(`/poll/${poll._id}/results`);
      if (data.success) {
        setActivePoll({ ...data.poll, isExpired: poll.isExpired });
        setChartData(data.results);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load poll');
    }
  };

  const handleQuestionTextChange = (qIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].text = value;
    setQuestions(newQs);
  };

  const handleOptionChange = (qIndex, oIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].options[oIndex] = value;
    setQuestions(newQs);
  };

  const addOption = (qIndex) => {
    const newQs = [...questions];
    newQs[qIndex].options.push('');
    setQuestions(newQs);
  };

  const removeOption = (qIndex, oIndex) => {
    const newQs = [...questions];
    newQs[qIndex].options = newQs[qIndex].options.filter((_, i) => i !== oIndex);
    setQuestions(newQs);
  };

  const addQuestion = () => setQuestions([...questions, { text: '', options: ['', ''], correctAnswer: '' }]);
  const removeQuestion = (qIndex) => setQuestions(questions.filter((_, i) => i !== qIndex));

  const setCorrectAnswer = (qIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].correctAnswer = value;
    setQuestions(newQs);
  };

  // ── Text-paste bulk parser (existing logic — unchanged) ──
  const handleBulkParse = () => {
    if (!bulkInput.trim()) { toast.error('Please paste some text first.'); return; }
    try {
      const blocks = bulkInput.trim().split(/\n\s*\n/);
      const parsedQuestions = blocks.map(block => {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        if (lines.length < 3) return null;
        
        // Identify "Correct Answer: x" line
        const correctLineIndex = lines.findIndex(l => l.toLowerCase().includes('correct answer:'));
        let correctLetter = '';
        if (correctLineIndex !== -1) {
          const match = lines[correctLineIndex].match(/correct\s+answer:\s*([a-d])/i);
          if (match) correctLetter = match[1].toLowerCase();
        }

        // Identify Options
        let optionLines = [];
        let questionText = '';

        if (correctLineIndex !== -1) {
          questionText = lines[0].replace(/^\d+[\)\.]\ */, '').trim();
          optionLines = lines.slice(1, correctLineIndex);
        } else {
          questionText = lines[0];
          optionLines = lines.slice(1);
        }

        let correctAnswer = '';
        const options = optionLines.map(line => {
          const letterMatch = line.match(/^([a-d])[\)\.]\ *(.*)/i);
          if (letterMatch) {
            const letter = letterMatch[1].toLowerCase();
            const text = letterMatch[2].trim();
            if (letter === correctLetter) correctAnswer = text;
            return text;
          }
          if (line.startsWith('*')) {
            const cleanOpt = line.substring(1).trim();
            correctAnswer = cleanOpt;
            return cleanOpt;
          }
          return line;
        });

        return { text: questionText, options, correctAnswer };
      }).filter(Boolean);

      if (parsedQuestions.length === 0) {
        toast.error('Could not parse any questions. Please check the format.');
        return;
      }
      setQuestions(parsedQuestions);
      setIsBulkMode(false);
      setBulkInput('');
      toast.success(`Successfully imported ${parsedQuestions.length} questions!`);
    } catch (err) {
      console.error(err);
      toast.error('Error parsing bulk input. Please check the format.');
    }
  };

  // ── Excel bulk import (unified engine — same as AddQuiz) ──
  const handlePollExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'poll');        // poll mode → { text, options, correctAnswer(string), imageUrl }
    formData.append('uploadImages', 'true'); // upload Image URL column values to Cloudinary

    setExcelParsing(true);
    try {
      const { data } = await api.post('/import/parse-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newQuestions = data?.questions;
      if (!newQuestions || !Array.isArray(newQuestions)) {
        throw new Error('Invalid server response: missing questions array');
      }

      // Map to poll question shape
      const mapped = newQuestions.map((q) => ({
        text: q.text || '',
        options: q.options?.length >= 2 ? q.options : ['', ''],
        correctAnswer: q.correctAnswer || '',
        imageUrl: q.imageUrl || '',
      }));

      setQuestions(mapped);

      if (data.errors?.length) {
        data.errors.forEach((err) => toast.error(err, { duration: 4000 }));
      }

      toast.success(`${data.count} question(s) imported from Excel!`);
      setIsBulkMode(false);
    } catch (err) {
      console.error('Poll Excel import error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to parse Excel';
      toast.error(msg);
    } finally {
      setExcelParsing(false);
      if (excelFileRef.current) excelFileRef.current.value = '';
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validQuestions = questions.map(q => ({
      text: q.text.trim(),
      options: q.options.filter(o => o.trim() !== ''),
      correctAnswer: q.correctAnswer
    }));
    const isValid = validQuestions.every(q => q.text && q.options.length >= 2);
    if (!isValid || validQuestions.length === 0) {
      toast.error('All questions must have text and at least 2 options.');
      return;
    }
    try {
      const { data } = await api.post('/poll/create', {
        title: pollTitle,
        questions: validQuestions,
        revealMode,
        revealDelayMinutes: Number(revealDelayMinutes)
      });
      if (data.success) {
        setActivePoll(data.poll);
        setChartData(validQuestions.map(q => q.options.map(opt => ({ name: opt, value: 0 }))));
        setRevealResults(false);
        setResponseCount(0);
        setTimerRunning(false);
        setTimeLeft(0);
        toast.success('Poll created successfully!');
        setPollTitle('');
        setQuestions([{ text: '', options: ['', ''], correctAnswer: '' }]);
        fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create poll');
    }
  };

  const handleStartTimer = async () => {
    if (!activePoll?._id) return;
    try {
      const { data } = await api.post(`/poll/start-timer/${activePoll._id}`);
      if (data.success) {
        setTimerRunning(true);
        setTimeLeft((activePoll.revealDelayMinutes || 1) * 60);
        toast.success(`Timer started! Charts reveal in ${activePoll.revealDelayMinutes} minute(s).`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start timer');
    }
  };

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleDeletePoll = async (pollId) => {
    if (!window.confirm('Are you sure you want to completely delete this poll? This cannot be undone.')) return;
    try {
      const { data } = await api.delete(`/poll/${pollId}`);
      if (data.success) {
        toast.success('Poll deleted successfully');
        fetchHistory();
        if (activePoll?._id === pollId) setActivePoll(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete poll');
    }
  };

  const handleDuplicatePoll = (poll) => {
    if (!poll || !poll.questions) return;
    setPollTitle(`${poll.title} (Copy)`);
    setRevealMode(poll.revealMode || 'live');
    setRevealDelayMinutes(poll.revealDelayMinutes || 1);
    
    const copiedQuestions = poll.questions.map(q => ({
      text: q.text || '',
      options: Array.isArray(q.options) ? [...q.options] : ['', ''],
      correctAnswer: q.correctAnswer || '',
      imageUrl: q.imageUrl || '',
      explanation: q.explanation || ''
    }));
    
    setQuestions(copiedQuestions);
    setIsImportModalOpen(false);
    setSelectedPollForImport(null);
    setSelectedQuestionIndices([]);
    toast.success('Poll duplicated! The editor has been populated.');
  };

  const handleImportSelectedQuestions = () => {
    if (!selectedPollForImport || selectedQuestionIndices.length === 0) {
      toast.error('No questions selected for import.');
      return;
    }
    
    const imported = selectedQuestionIndices.map(index => {
      const q = selectedPollForImport.questions[index];
      return {
        text: q.text || '',
        options: Array.isArray(q.options) ? [...q.options] : ['', ''],
        correctAnswer: q.correctAnswer || '',
        imageUrl: q.imageUrl || '',
        explanation: q.explanation || ''
      };
    });

    const isCurrentBlank = questions.length === 1 && 
      !questions[0].text.trim() && 
      questions[0].options.every(o => !o.trim());

    if (isCurrentBlank) {
      setQuestions(imported);
    } else {
      setQuestions([...questions, ...imported]);
    }

    setIsImportModalOpen(false);
    setSelectedPollForImport(null);
    setSelectedQuestionIndices([]);
    toast.success(`Successfully imported ${imported.length} question(s)!`);
  };

  const handleDownloadExcel = async (pollId, pollCode) => {
    try {
      const response = await api.get(`/poll/${pollId}/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `poll-${pollCode}-results.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download Excel report');
    }
  };

  const pollUrl = activePoll?.code ? `${window.location.origin}/poll/${activePoll.code}` : '';

  const downloadQRCode = () => {
    const svg = document.getElementById('poll-qr-code');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `poll-qr-${activePoll.code}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="admin-page">

          {/* Page Header */}
          <div className="admin-header">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '1rem', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
              onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
              onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <h1>Live Polls</h1>
            <p>Create and monitor real-time interactive polls.</p>
          </div>

          {/* Floating Bulk Upload Button */}
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999 }}>
            <button
              type="button"
              onClick={() => setIsBulkMode(!isBulkMode)}
              className="btn"
              style={{
                background: '#f59e0b', color: 'white', padding: '16px 24px',
                borderRadius: '50px', fontWeight: '900',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)', fontSize: '1rem', border: '2px solid white'
              }}
            >
              {isBulkMode ? '← MANUAL FORM' : '⚡ BULK UPLOAD QUESTIONS'}
            </button>
          </div>

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginTop: '2rem' }}>

            {/* ── Left: Create OR Active Poll ── */}
            {!activePoll ? (
              <div className="card" style={{ padding: '2rem', borderTop: '4px solid #f59e0b' }}>

                {/* Card Header with Bulk Toggle and Import */}
                <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                    {isBulkMode ? 'BULK UPLOAD MODE' : 'CREATE NEW POLL'}
                  </h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsImportModalOpen(true)}
                      className="btn"
                      style={{ background: '#10b981', color: '#fff', fontWeight: '900', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      📥 Import Questions
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBulkMode(!isBulkMode)}
                      className="btn"
                      style={{ background: '#f59e0b', color: '#fff', fontWeight: '900', border: 'none', padding: '10px 20px', borderRadius: '6px' }}
                    >
                      {isBulkMode ? '← SWITCH TO MANUAL' : '⚡ OPEN BULK UPLOAD'}
                    </button>
                  </div>
                </div>

                {/* Bulk Mode — Excel + Paste tabs */}
                {isBulkMode ? (
                  <div>
                    {/* Tab selector */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
                      {['excel', 'paste'].map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setBulkTab(tab)}
                          style={{
                            padding: '8px 18px', borderRadius: 6, fontWeight: 800, fontSize: '0.85rem',
                            border: '2px solid #f59e0b', cursor: 'pointer',
                            background: bulkTab === tab ? '#f59e0b' : 'transparent',
                            color: bulkTab === tab ? '#fff' : '#f59e0b',
                            transition: 'all 0.15s',
                          }}
                        >
                          {tab === 'excel' ? '📊 Excel Upload' : '📝 Text Paste'}
                        </button>
                      ))}
                    </div>

                    {bulkTab === 'excel' ? (
                      /* ── Excel Upload Panel ── */
                      <div>
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.85rem', marginBottom: 14, fontSize: '0.82rem', color: '#475569' }}>
                          <p style={{ fontWeight: 700, marginBottom: 6, color: '#1e293b' }}>📋 Required Excel Columns:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
                            {[
                              { col: 'Question', req: true },
                              { col: 'Option A', req: true },
                              { col: 'Option B', req: true },
                              { col: 'Option C', req: false },
                              { col: 'Option D', req: false },
                              { col: 'Correct Answer', req: true, note: 'A/B/C/D' },
                              { col: 'Image URL', req: false, note: 'optional' },
                            ].map(({ col, req, note }) => (
                              <span key={col} style={{ fontWeight: req ? 700 : 400, color: req ? '#1e293b' : '#64748b' }}>
                                {req ? '●' : '○'} {col}{note ? ` (${note})` : ''}
                              </span>
                            ))}
                          </div>
                          <p style={{ marginTop: 8, color: '#64748b', fontSize: '0.78rem' }}>
                            💡 Images in the <b>Image URL</b> column are automatically uploaded to Cloudinary.
                          </p>
                        </div>

                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePollExcelUpload}
                          style={{ display: 'none' }}
                          id="poll-excel-upload"
                          ref={excelFileRef}
                          disabled={excelParsing}
                        />
                        <label
                          htmlFor="poll-excel-upload"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            cursor: excelParsing ? 'wait' : 'pointer',
                            opacity: excelParsing ? 0.65 : 1,
                            background: '#f59e0b', color: '#fff', fontWeight: 800,
                            padding: '12px 24px', borderRadius: 8, fontSize: '0.9rem',
                            border: '2px solid rgba(255,255,255,0.4)',
                            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                            transition: 'all 0.2s',
                          }}
                        >
                          <FileText size={18} />
                          {excelParsing ? 'Parsing & Uploading Images…' : 'Choose Excel File (.xlsx)'}
                        </label>
                      </div>
                    ) : (
                      /* ── Text Paste Panel ── */
                      <div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                          Paste your questions and options from Notepad. Separate questions with an empty line.
                        </p>
                        <textarea
                          className="form-input"
                          style={{ minHeight: '280px', fontFamily: 'monospace', fontSize: '0.9rem', marginBottom: '1rem', resize: 'vertical' }}
                          placeholder={"Example:\nWhat is your favorite color?\n*Red (Correct answer starts with *)\nBlue\nGreen\n\nNext Question?\nOption A\n*Option B (Correct)"}
                          value={bulkInput}
                          onChange={(e) => setBulkInput(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" className="btn btn-primary btn-full" onClick={handleBulkParse}>
                            Process &amp; Fill Form
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setBulkInput('')}>
                            Clear
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Manual Form */
                  <form onSubmit={handleCreatePoll}>
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <label className="form-label">Poll Name / Title</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Workshop Feedback, Quiz A, etc."
                        value={pollTitle}
                        onChange={(e) => setPollTitle(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label className="form-label">Reveal Mode</label>
                        <select 
                          className="form-input" 
                          value={revealMode} 
                          onChange={(e) => setRevealMode(e.target.value)}
                        >
                          <option value="live">Live Reveal</option>
                          <option value="delayed">Reveal After Timer</option>
                        </select>
                      </div>
                      {revealMode === 'delayed' && (
                        <div>
                          <label className="form-label">Timer Delay</label>
                          <select 
                            className="form-input" 
                            value={revealDelayMinutes} 
                            onChange={(e) => setRevealDelayMinutes(Number(e.target.value))}
                          >
                            <option value={1}>1 Minute</option>
                            <option value={2}>2 Minutes</option>
                            <option value={5}>5 Minutes</option>
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={30}>30 Minutes</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {questions.map((q, qIndex) => (
                      <div key={qIndex} style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h3 style={{ fontWeight: 600 }}>Question {qIndex + 1}</h3>
                          {questions.length > 1 && (
                            <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => removeQuestion(qIndex)}>
                              Remove Question
                            </button>
                          )}
                        </div>

                        {/* Image preview if imported from Excel */}
                        {q.imageUrl && (
                          <div style={{ marginBottom: 12, position: 'relative', display: 'inline-block' }}>
                            <img
                              src={q.imageUrl}
                              alt={`Q${qIndex + 1} image`}
                              style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid #e2e8f0', display: 'block' }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...questions];
                                updated[qIndex].imageUrl = '';
                                setQuestions(updated);
                              }}
                              style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Remove image"
                            >
                              <X size={12} />
                            </button>
                            <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 600 }}>
                              <Image size={11} style={{ display: 'inline', marginRight: 4 }} />
                              Image attached (Cloudinary)
                            </div>
                          </div>
                        )}

                        <div className="form-group">
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Enter question text..."
                            value={q.text}
                            onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginTop: '1rem' }}>
                          <label className="form-label" style={{ fontSize: '0.85rem' }}>Options</label>
                          {q.options.map((opt, oIndex) => (
                            <div key={oIndex} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                              <input
                                type="radio"
                                name={`correct-${qIndex}`}
                                checked={q.correctAnswer === opt && opt !== ''}
                                onChange={() => setCorrectAnswer(qIndex, opt)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#8DC63F' }}
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                className="form-input"
                                placeholder={`Option ${oIndex + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const oldVal = q.options[oIndex];
                                  handleOptionChange(qIndex, oIndex, e.target.value);
                                  if (q.correctAnswer === oldVal && oldVal !== '') {
                                    setCorrectAnswer(qIndex, e.target.value);
                                  }
                                }}
                                style={{ border: q.correctAnswer === opt && opt !== '' ? '2px solid #8DC63F' : '1px solid var(--border)' }}
                              />
                              {q.options.length > 2 && (
                                <button type="button" className="btn btn-danger" onClick={() => removeOption(qIndex, oIndex)} style={{ padding: '0 12px' }}>✕</button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn btn-secondary" onClick={() => addOption(qIndex)} style={{ marginTop: '10px', width: '100%' }}>
                            + Add Option
                          </button>
                        </div>
                      </div>
                    ))}

                    <button type="button" className="btn btn-secondary btn-full" onClick={addQuestion} style={{ marginBottom: '1.5rem', borderStyle: 'dashed' }}>
                      + Add Another Question
                    </button>

                    <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '2rem' }}>
                      Start Live Poll
                    </button>

                    <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Prefer pasting from notepad?</p>
                      <button type="button" className="btn btn-secondary" onClick={() => setIsBulkMode(true)}>
                        ⚡ Switch to Bulk Import
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* ── Active Poll Card ── */
              <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                  {activePoll.title}
                  {activePoll.isExpired && (
                    <span style={{ marginLeft: '10px', background: '#ef4444', color: '#fff', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', verticalAlign: 'middle' }}>Expired</span>
                  )}
                </h1>
                
                {!activePoll.isExpired ? (
                  <>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent)' }}>
                      Join at: {pollUrl}
                    </h2>
                    <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                      <QRCodeSVG id="poll-qr-code" value={pollUrl} size={200} />
                    </div>
                    <button onClick={downloadQRCode} className="btn btn-secondary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem' }}>
                      📥 Download QR Code
                    </button>
                    <div style={{ marginTop: '2rem' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Or use join code:</p>
                      <h1 style={{ fontSize: '3rem', letterSpacing: '8px', color: 'var(--text)', marginTop: '0.5rem' }}>
                        {activePoll.code}
                      </h1>

                      {activePoll.revealMode === 'delayed' && (
                        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <Timer size={24} color={timerRunning ? "#f59e0b" : "#64748b"} />
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>
                              {revealResults ? 'RESULTS REVEALED' : timerRunning ? 'REVEAL COUNTDOWN' : 'DELAYED REVEAL MODE'}
                            </span>
                          </div>
                          
                          {timerRunning ? (
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                              {formatCountdown(timeLeft)}
                            </div>
                          ) : !revealResults ? (
                            <>
                              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Charts are currently hidden from view. Start the timer to reveal results to everyone after {activePoll.revealDelay} minute(s).
                              </p>
                              <button 
                                className="btn btn-primary btn-full" 
                                onClick={handleStartTimer}
                                style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
                              >
                                Start Reveal Timer ({activePoll.revealDelay}m)
                              </button>
                            </>
                          ) : (
                            <p style={{ color: '#8DC63F', fontWeight: 600 }}>Charts are now visible to everyone.</p>
                          )}
                        </div>
                      )}

                      <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 500 }}>
                        ⚠️ This poll and QR code will expire 24 hours after creation.
                      </p>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: '2rem', padding: '2rem', background: 'rgba(239,68,68,0.05)', borderRadius: '12px', border: '1px dashed #ef4444' }}>
                    <p style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 'bold' }}>This poll has expired.</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>It is no longer accepting new responses, but you can still view the results and download the report.</p>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button className="btn btn-primary" onClick={() => handleDownloadExcel(activePoll._id, activePoll.code)}>
                    Download Excel
                  </button>
                  <button className="btn btn-secondary" onClick={() => setActivePoll(null)}>
                    End Poll &amp; Create New
                  </button>
                </div>
              </div>
            )}

            {/* ── Right: Live Results (Premium Summary View) ── */}
            {activePoll && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '1.5rem 2rem', borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Poll Results Summary</h2>
                    <p style={{ color: '#64748b', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Real-time analytics and audience insights</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ background: 'rgba(141,198,63,0.1)', color: '#8DC63F', padding: '0.5rem 1rem', borderRadius: '2rem', fontSize: '0.8rem', fontWeight: 700 }}>
                      Live Tracking
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
                  {activePoll.questions.map((q, qi) => {
                    const data = chartData[qi] || [];
                    const total = data.reduce((a, c) => a + c.value, 0);
                    let majorityOption = 'No votes yet';
                    let majorityPct = 0;
                    
                    if (total > 0) {
                      const sorted = [...data].sort((a, b) => b.value - a.value);
                      majorityOption = sorted[0].name;
                      majorityPct = Math.round((sorted[0].value / total) * 100);
                    }

                    const correctAnswerData = data.find(d => d.name === q.correctAnswer);
                    const accuracyPct = total > 0 && correctAnswerData ? Math.round((correctAnswerData.value / total) * 100) : 0;
                    const isMajorityCorrect = majorityOption === q.correctAnswer;

                    return (
                      <div key={qi} style={{ background: '#ffffff', borderRadius: '1.25rem', padding: '1.75rem', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px rgba(0,0,0,0.04)', position: 'relative' }}>
                        
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h3 style={{ fontSize: '1rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.5 }}>{qi + 1}. {q.text}</h3>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.5rem' }}>
                          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '0.8rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.3rem' }}>Total Responses</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38BDF8' }}>
                              {activePoll.revealMode === 'delayed' && !revealResults ? responseCount : total}
                            </div>
                            <Users size="1rem" color="#94a3b8" style={{ marginTop: '0.3rem' }}/>
                          </div>
                          <div style={{ flex: 1, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '0.8rem', padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.3rem' }}>Accuracy</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: accuracyPct >= 70 ? '#8DC63F' : accuracyPct >= 40 ? '#F59E0B' : '#EF4444' }}>
                              {activePoll.revealMode === 'delayed' && !revealResults ? '??%' : `${accuracyPct}%`}
                            </div>
                            <Target size="1rem" color="#94a3b8" style={{ marginTop: '0.3rem' }}/>
                            {(q.correctAnswer && (activePoll.revealMode === 'live' || revealResults)) && (
                              <div style={{ position: 'absolute', top: -10, right: -10, background: isMajorityCorrect ? '#8DC63F' : '#EF4444', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 800, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                                {isMajorityCorrect ? 'MATCHED' : 'MISMATCH'}
                              </div>
                            )}
                          </div>
                        </div>

                        {(activePoll.revealMode === 'live' || revealResults) ? (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.8rem', background: 'rgba(141,198,63,0.05)', padding: '0.6rem 0.8rem', borderRadius: '0.8rem', border: '1px solid rgba(141,198,63,0.2)', overflow: 'hidden' }}>
                              <Trophy size="1.25rem" color="#8DC63F" style={{ flexShrink: 0 }} />
                              <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Winning Answer:</span>
                              <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'rgba(141,198,63,0.15)', borderRadius: '1.2rem', padding: '0.3rem 0.8rem', display: 'flex' }}>
                                <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'ticker 10s linear infinite' }}>
                                  <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 700, paddingRight: '2.5rem' }}>{majorityOption}</span>
                                  <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 700, paddingRight: '2.5rem' }}>{majorityOption}</span>
                                </div>
                              </div>
                            </div>

                            {q.correctAnswer && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', background: 'rgba(56,189,248,0.05)', padding: '0.6rem 0.8rem', borderRadius: '0.8rem', border: '1px solid rgba(56,189,248,0.2)', overflow: 'hidden' }}>
                                <Target size="1.25rem" color="#38BDF8" style={{ flexShrink: 0 }} />
                                <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>Correct Answer:</span>
                                <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: 'rgba(56,189,248,0.15)', borderRadius: '1.2rem', padding: '0.3rem 0.8rem', display: 'flex' }}>
                                  <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'ticker 12s linear infinite' }}>
                                    <span style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: 700, paddingRight: '2.5rem' }}>{q.correctAnswer}</span>
                                    <span style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: 700, paddingRight: '2.5rem' }}>{q.correctAnswer}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minHeight: '200px' }}>
                              <div style={{ flex: 1, height: '100%', minWidth: '150px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Pie data={data} cx="50%" cy="50%" outerRadius="90%" innerRadius="55%" dataKey="value" stroke="none">
                                      {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#1e293b' }} itemStyle={{ color: '#1e293b' }} />
                                  </PieChart>
                                </ResponsiveContainer>
                              </div>
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', justifyContent: 'center' }}>
                                {[...data].sort((a,b)=>b.value - a.value).slice(0,4).map((opt, i) => {
                                  const pct = total > 0 ? Math.round((opt.value/total)*100) : 0;
                                  return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <div style={{ width: '0.6rem', height: '0.6rem', borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                      <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, minWidth: '2.75rem' }}>{pct}%</span>
                                      <span style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }} title={opt.name}>{opt.name}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0' }}>
                            <Clock size={40} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
                            <p style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Results are hidden until revealed</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>{/* end main grid */}

          {/* Poll History */}
          {!activePoll && (
            <div className="card" style={{ marginTop: '3rem', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Poll History &amp; Recent Quizzes</h2>
                <button className="btn btn-secondary" onClick={fetchHistory} style={{ padding: '4px 12px', fontSize: '0.85rem' }}>Refresh List</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '1rem' }}>CODE</th>
                      <th style={{ padding: '1rem' }}>POLL NAME</th>
                      <th style={{ padding: '1rem' }}>CREATED</th>
                      <th style={{ padding: '1rem' }}>STATUS</th>
                      <th style={{ padding: '1rem' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!history || history.length === 0) ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No polls found yet.</td>
                      </tr>
                    ) : (
                      history.filter(p => p && p._id).map((poll) => (
                        <tr key={poll._id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                          <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent)' }}>{poll.code}</td>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>{poll.title || 'Untitled Poll'}</td>
                          <td style={{ padding: '1rem' }}>{new Date(poll.createdAt).toLocaleString()}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem',
                              background: poll.isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                              color: poll.isExpired ? '#ef4444' : '#22c55e'
                            }}>
                              {poll.isExpired ? 'Expired' : 'Active'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem', display: 'flex', gap: '8px' }}>
                            <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={() => viewPoll(poll)}>
                              View Results &amp; QR
                            </button>
                            <button className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#8b5cf6', color: 'white', border: 'none' }} onClick={() => handleDuplicatePoll(poll)}>
                              Duplicate
                            </button>
                            <button className="btn btn-success" style={{ padding: '4px 12px', fontSize: '0.8rem', background: '#10b981', color: 'white', border: 'none' }} onClick={() => handleDownloadExcel(poll._id, poll.code)}>
                              Download Excel
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => handleDeletePoll(poll._id)}
                              title="Delete Poll"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Questions Modal */}
          {isImportModalOpen && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              zIndex: 10000, padding: '20px'
            }}>
              <div style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: '16px', width: '100%', maxWidth: '900px',
                maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', overflow: 'hidden'
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '1.25rem 1.5rem', borderBottom: '1px solid #334155',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#0f172a'
                }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f1f2f6', margin: 0 }}>
                    📥 Import Questions from Previous Polls
                  </h3>
                  <button
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setSelectedPollForImport(null);
                      setSelectedQuestionIndices([]);
                    }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                  {/* Left Column: Polls List */}
                  <div style={{
                    padding: '1.5rem', borderRight: '1px solid #334155',
                    overflowY: 'auto', background: '#161e2e'
                  }}>
                    <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '1rem', marginTop: 0 }}>
                      Select a Poll ({history?.length || 0} Available)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(!history || history.length === 0) ? (
                        <div style={{ padding: '1.5rem', color: '#64748b', textAlign: 'center', fontSize: '0.9rem' }}>
                          No previous polls available to import from.
                        </div>
                      ) : (
                        history.map((p) => {
                          const isSelected = selectedPollForImport?._id === p._id;
                          return (
                            <div
                              key={p._id}
                              onClick={() => {
                                setSelectedPollForImport(p);
                                setSelectedQuestionIndices([]);
                              }}
                              style={{
                                padding: '12px', borderRadius: '10px',
                                background: isSelected ? 'rgba(56, 189, 248, 0.15)' : '#1e293b',
                                border: `2px solid ${isSelected ? '#38bdf8' : '#334155'}`,
                                cursor: 'pointer', transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ fontWeight: 700, color: isSelected ? '#38bdf8' : '#f1f2f6', fontSize: '0.95rem', marginBottom: '4px' }}>
                                {p.title || 'Untitled Poll'}
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                                <span>📅 {new Date(p.createdAt).toLocaleDateString()}</span>
                                <span style={{ fontWeight: 600, color: '#38bdf8' }}>❓ {p.questions?.length || 0} Questions</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Question Preview */}
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                    {!selectedPollForImport ? (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center' }}>
                        <FileText size={40} style={{ marginBottom: '10px', color: '#475569' }} />
                        <p style={{ fontSize: '0.95rem' }}>Select a poll from the left column to preview and choose questions.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '10px' }}>
                          <span style={{ fontWeight: 700, color: '#f1f2f6', fontSize: '1rem' }}>
                            {selectedPollForImport.title}
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={selectedQuestionIndices.length === selectedPollForImport.questions?.length && selectedPollForImport.questions?.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedQuestionIndices(selectedPollForImport.questions.map((_, idx) => idx));
                                } else {
                                  setSelectedQuestionIndices([]);
                                }
                              }}
                              style={{ accentColor: '#38bdf8', width: '16px', height: '16px' }}
                            />
                            Select All
                          </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                          {selectedPollForImport.questions?.map((q, idx) => {
                            const isChecked = selectedQuestionIndices.includes(idx);
                            return (
                              <div
                                key={idx}
                                style={{
                                  padding: '12px', borderRadius: '8px',
                                  background: isChecked ? 'rgba(16, 185, 129, 0.05)' : '#161e2e',
                                  border: `1px solid ${isChecked ? '#10b981' : '#334155'}`,
                                  display: 'flex', gap: '12px', alignItems: 'flex-start'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedQuestionIndices([...selectedQuestionIndices, idx]);
                                    } else {
                                      setSelectedQuestionIndices(selectedQuestionIndices.filter(i => i !== idx));
                                    }
                                  }}
                                  style={{ accentColor: '#10b981', width: '18px', height: '18px', marginTop: '3px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, color: '#f1f2f6', fontSize: '0.9rem', marginBottom: '6px' }}>
                                    {idx + 1}. {q.text}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    {q.options?.map((opt, oIdx) => (
                                      <span
                                        key={oIdx}
                                        style={{
                                          padding: '2px 8px', borderRadius: '4px',
                                          background: opt === q.correctAnswer ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                                          color: opt === q.correctAnswer ? '#10b981' : '#94a3b8',
                                          border: `1px solid ${opt === q.correctAnswer ? 'rgba(16, 185, 129, 0.3)' : '#334155'}`,
                                          fontWeight: opt === q.correctAnswer ? 700 : 400
                                        }}
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{
                  padding: '1rem 1.5rem', borderTop: '1px solid #334155',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#0f172a'
                }}>
                  <div>
                    {selectedPollForImport && (
                      <button
                        onClick={() => handleDuplicatePoll(selectedPollForImport)}
                        className="btn"
                        style={{ background: '#8b5cf6', color: '#fff', fontWeight: 'bold', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        🗂️ Duplicate Entire Poll
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setSelectedPollForImport(null);
                        setSelectedQuestionIndices([]);
                      }}
                      className="btn"
                      style={{ background: '#475569', color: '#fff', fontWeight: 'bold', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportSelectedQuestions}
                      disabled={!selectedPollForImport || selectedQuestionIndices.length === 0}
                      className="btn"
                      style={{
                        background: '#10b981', color: '#fff', fontWeight: 'bold', border: 'none',
                        padding: '10px 20px', borderRadius: '6px', cursor: selectedQuestionIndices.length > 0 ? 'pointer' : 'not-allowed',
                        opacity: selectedQuestionIndices.length > 0 ? 1 : 0.5
                      }}
                    >
                      Import Selected ({selectedQuestionIndices.length})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
