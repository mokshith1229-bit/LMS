import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function LivePoll() {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [activePoll, setActivePoll] = useState(null);
  const [chartData, setChartData] = useState([]);

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

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (index) => setOptions(options.filter((_, i) => i !== index));

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim() !== '');
    if (!question.trim() || validOptions.length < 2) {
      toast.error('Question and at least 2 options are required');
      return;
    }

    try {
      const { data } = await api.post('/poll/create', {
        question,
        options: validOptions
      });
      if (data.success) {
        setActivePoll(data.poll);
        setChartData(validOptions.map(opt => ({ name: opt, value: 0 })));
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
              <div className="form-group">
                <label className="form-label">Question</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. What is your favorite framework?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Options</label>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(idx, e.target.value)}
                    />
                    {options.length > 2 && (
                      <button type="button" className="btn btn-danger" onClick={() => removeOption(idx)} style={{ padding: '0 12px' }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" className="btn btn-secondary" onClick={addOption} style={{ marginTop: '10px', width: '100%' }}>
                  + Add Option
                </button>
              </div>

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
            <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>Live Results: {activePoll.question}</h2>
            
            <div style={{ flex: 1, minHeight: '350px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    innerRadius={60}
                    dataKey="value"
                    nameKey="name"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {chartData.map((entry, index) => (
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
        )}

      </div>
    </div>
  );
}
