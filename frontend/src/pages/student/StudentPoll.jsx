import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function StudentPoll() {
  const { code } = useParams();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});

  // Generate or retrieve a persistent user key for anonymous voting
  const getUserKey = () => {
    let key = localStorage.getItem('poll_user_key');
    if (!key) {
      key = 'user_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('poll_user_key', key);
    }
    return key;
  };

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const { data } = await api.get(`/poll/${code}`);
        if (data.success) {
          setPoll(data.poll);
          setChartData(data.results);
          
          // Check if already voted via localStorage key or backend validation
          const votedStore = localStorage.getItem(`voted_${code}`);
          if (votedStore === 'true') {
            setHasVoted(true);
          }
        }
      } catch (err) {
        setError('Poll not found or inactive');
      } finally {
        setLoading(false);
      }
    };

    fetchPoll();
  }, [code]);

  // Socket connection effect
  useEffect(() => {
    if (!poll?.code) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socket.emit('join_poll', poll.code);

    socket.on('poll_update', (data) => {
      setChartData(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [poll?.code]);

  const handleOptionSelect = (qIndex, option) => {
    setAnswers({ ...answers, [qIndex]: option });
  };

  const handleSubmitVotes = async () => {
    if (Object.keys(answers).length !== poll.questions.length) {
      toast.error('Please answer all questions before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qIndex, selectedOption]) => ({
        questionIndex: Number(qIndex),
        selectedOption
      }));

      const { data } = await api.post('/poll/respond', {
        code: poll.code,
        userKey: getUserKey(),
        answers: formattedAnswers
      });

      if (data.success) {
        setHasVoted(true);
        localStorage.setItem(`voted_${code}`, 'true');
        toast.success('Votes submitted successfully!');
      }
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.message.includes('already voted')) {
        setHasVoted(true);
        localStorage.setItem(`voted_${code}`, 'true');
        toast.error('You have already voted in this poll.');
      } else {
        toast.error('Failed to submit votes');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#fff' }}>Loading poll...</div>;
  }

  if (error || !poll) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0f172a' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Oops!</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error || 'Invalid poll code.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      
      {/* Brand Header */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <img src="/assets/minds_logo.png" alt="Logo" style={{ height: '50px', marginBottom: '1rem' }} />
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 600 }}>Live Interactive Poll</h1>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '700px', padding: '2.5rem', background: '#1e293b', border: '1px solid #334155' }}>
        {!hasVoted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            {poll.questions.map((q, qIndex) => (
              <div key={qIndex}>
                <h2 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '1.5rem', lineHeight: 1.4, fontWeight: 500 }}>
                  {qIndex + 1}. {q.text}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[qIndex] === opt;
                    return (
                      <button
                        key={idx}
                        className="btn"
                        onClick={() => handleOptionSelect(qIndex, opt)}
                        disabled={submitting}
                        style={{ 
                          padding: '1rem', 
                          fontSize: '1.1rem', 
                          background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.05)', 
                          border: `1px solid ${isSelected ? '#38bdf8' : 'rgba(255,255,255,0.1)'}`,
                          color: isSelected ? '#38bdf8' : '#fff',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            <button 
              className="btn btn-primary btn-full" 
              style={{ padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}
              onClick={handleSubmitVotes}
              disabled={submitting || Object.keys(answers).length !== poll.questions.length}
            >
              {submitting ? 'Submitting...' : 'Submit All Votes'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.5s ease-out', width: '100%' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', padding: '10px 20px', borderRadius: '30px', fontWeight: 600, marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✓</span> Votes recorded successfully
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem', width: '100%' }}>
              {poll.questions.map((q, qIndex) => (
                <div key={qIndex} style={{ width: '100%' }}>
                  <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '1rem', textAlign: 'center' }}>
                    {qIndex + 1}. {q.text}
                  </h3>
                  <div style={{ width: '100%', height: '300px' }}>
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
                          contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#94a3b8' }}/>
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
