import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function LivePoll() {
  const [questions, setQuestions] = useState([{ text: '', options: ['', ''] }]);
  const [activePoll, setActivePoll] = useState(null);
  const [chartData, setChartData] = useState([]); // This will now be an array of arrays

  // Socket connection effect
  useEffect(() => {
    if (!activePoll?.code) return;

    // Connect to backend socket
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socket.emit('join_poll', activePoll.code);

    socket.on('poll_update', (data) => {
      setChartData(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [activePoll?.code]);

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

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    
    // Validate all questions
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
      const { data } = await api.post('/poll/create', {
        questions: validQuestions
      });
      if (data.success) {
        setActivePoll(data.poll);
        // Initialize chart data (array of arrays)
        setChartData(validQuestions.map(q => q.options.map(opt => ({ name: opt, value: 0 }))));
        toast.success('Poll created successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create poll');
    }
  };

  const pollUrl = `${window.location.origin}/poll/${activePoll?.code}`;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Live Polls</h1>
        <p>Create and monitor real-time interactive polls.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        
        {/* Create Poll Section */}
        {!activePoll ? (
          <div className="card" style={{ padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Create New Poll</h2>
            <form onSubmit={handleCreatePoll}>
              {questions.map((q, qIndex) => (
                <div key={qIndex} style={{ padding: '1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontWeight: 600 }}>Question {qIndex + 1}</h3>
                    {questions.length > 1 && (
                      <button type="button" className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => removeQuestion(qIndex)}>Remove Question</button>
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
            </form>
          </div>
        ) : (
          /* Active Poll Details */
          <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--accent)' }}>
              Join at: {pollUrl}
            </h2>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '16px', display: 'inline-block', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
              <QRCodeSVG value={pollUrl} size={200} />
            </div>
            <div style={{ marginTop: '2rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Or use join code:</p>
              <h1 style={{ fontSize: '3rem', letterSpacing: '8px', color: 'var(--text)', marginTop: '0.5rem' }}>
                {activePoll.code}
              </h1>
            </div>
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '2rem' }} 
              onClick={() => setActivePoll(null)}
            >
              End Poll & Create New
            </button>
          </div>
        )}

        {/* Live Results Section */}
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
                          data={chartData[qIndex] || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={50}
                          dataKey="value"
                          nameKey="name"
                          labelLine={false}
                          label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {(chartData[qIndex] || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          itemStyle={{ color: '#1f2937' }}
                        />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
