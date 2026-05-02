import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import { Trash2 } from 'lucide-react';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function LivePoll() {
  const [questions, setQuestions] = useState([{ text: '', options: ['', ''] }]);
  const [pollTitle, setPollTitle] = useState('');
  const [activePoll, setActivePoll] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkInput, setBulkInput] = useState('');

  // Socket connection
  useEffect(() => {
    if (!activePoll?.code) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    socket.emit('join_poll', activePoll.code);
    socket.on('poll_update', (data) => setChartData(data));
    return () => socket.disconnect();
  }, [activePoll?.code]);

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
      const { data } = await api.get(`/poll/${poll.code}`);
      if (data.success) {
        setActivePoll(data.poll);
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

  const addQuestion = () => setQuestions([...questions, { text: '', options: ['', ''] }]);
  const removeQuestion = (qIndex) => setQuestions(questions.filter((_, i) => i !== qIndex));

  const handleBulkParse = () => {
    if (!bulkInput.trim()) { toast.error('Please paste some text first.'); return; }
    try {
      const blocks = bulkInput.trim().split(/\n\s*\n/);
      const parsedQuestions = blocks.map(block => {
        const lines = block.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '');
        if (lines.length < 3) return null;
        return { text: lines[0], options: lines.slice(1) };
      }).filter(Boolean);

      if (parsedQuestions.length === 0) {
        toast.error('Could not find any valid questions. Format: Question on line 1, Options below, blank line between questions.');
        return;
      }
      setQuestions(parsedQuestions);
      setIsBulkMode(false);
      setBulkInput('');
      toast.success(`Successfully imported ${parsedQuestions.length} questions!`);
    } catch (err) {
      toast.error('Error parsing bulk input. Please check the format.');
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validQuestions = questions.map(q => ({
      text: q.text.trim(),
      options: q.options.filter(o => o.trim() !== '')
    }));
    const isValid = validQuestions.every(q => q.text && q.options.length >= 2);
    if (!isValid || validQuestions.length === 0) {
      toast.error('All questions must have text and at least 2 options.');
      return;
    }
    try {
      const { data } = await api.post('/poll/create', { title: pollTitle, questions: validQuestions });
      if (data.success) {
        setActivePoll(data.poll);
        setChartData(validQuestions.map(q => q.options.map(opt => ({ name: opt, value: 0 }))));
        toast.success('Poll created successfully!');
        setPollTitle('');
        setQuestions([{ text: '', options: ['', ''] }]);
        fetchHistory();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create poll');
    }
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

                {/* Card Header with Bulk Toggle */}
                <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--text-primary)', margin: 0 }}>
                    {isBulkMode ? 'BULK UPLOAD MODE' : 'CREATE NEW POLL'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(!isBulkMode)}
                    className="btn"
                    style={{ background: '#f59e0b', color: '#fff', fontWeight: '900', border: 'none', padding: '10px 20px', borderRadius: '6px' }}
                  >
                    {isBulkMode ? '← SWITCH TO MANUAL' : '⚡ OPEN BULK UPLOAD'}
                  </button>
                </div>

                {/* Bulk Mode */}
                {isBulkMode ? (
                  <div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Paste your questions and options from Notepad. Separate questions with an empty line.
                    </p>
                    <textarea
                      className="form-input"
                      style={{ minHeight: '300px', fontFamily: 'monospace', fontSize: '0.9rem', marginBottom: '1rem', resize: 'vertical' }}
                      placeholder={"Example:\nWhat is your favorite color?\nRed\nBlue\nGreen\n\nNext Question?\nOption A\nOption B"}
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
                            <div key={oIndex} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder={`Option ${oIndex + 1}`}
                                value={opt}
                                onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
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
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>{activePoll.title}</h1>
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
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 500 }}>
                    ⚠️ This poll and QR code will expire 10 hours after creation.
                  </p>
                </div>
                <button className="btn btn-secondary" style={{ marginTop: '2rem' }} onClick={() => setActivePoll(null)}>
                  End Poll &amp; Create New
                </button>
              </div>
            )}

            {/* ── Right: Live Results ── */}
            {activePoll && (
              <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Live Results</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                  {activePoll.questions.map((q, qIndex) => (
                    <div key={qIndex} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '2rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 500 }}>{qIndex + 1}. {q.text}</h3>
                      <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(chartData && chartData[qIndex]) || []}
                              cx="50%" cy="50%"
                              outerRadius={100} innerRadius={50}
                              dataKey="value" nameKey="name"
                              labelLine={false}
                              label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                              animationBegin={0} animationDuration={800}
                            >
                              {((chartData && chartData[qIndex]) || []).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} itemStyle={{ color: '#1f2937' }} />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
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

        </div>
      </main>
    </div>
  );
}
