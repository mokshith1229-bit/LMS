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
        if (err.response?.status === 410) {
          setError(err.response.data.message || 'This poll has expired.');
        } else {
          setError('Poll not found or inactive');
        }
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
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: '#1e293b', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>Loading poll...</div>;
  }

  if (error || !poll) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}>
        <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', background: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderRadius: '16px' }}>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 700 }}>Oops!</h2>
          <p style={{ color: '#64748b' }}>{error || 'Invalid poll code.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Brand Header */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <img src="/assets/minds_logo.png" alt="Logo" style={{ height: '60px', marginBottom: '1rem' }} />
        <h1 style={{ color: '#1e293b', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' }}>Interactive Live Poll</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Join code: <span style={{ fontWeight: 700, color: '#0066cc' }}>{poll.code}</span></p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '750px', padding: '3rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.04)' }}>
        {!hasVoted ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}>
            {poll.questions.map((q, qIndex) => (
              <div key={qIndex}>
                <h2 style={{ color: '#1e293b', fontSize: '1.4rem', marginBottom: '1.5rem', lineHeight: 1.5, fontWeight: 600 }}>
                  {qIndex + 1}. {q.text}
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {q.options.map((opt, idx) => {
                    const isSelected = answers[qIndex] === opt;
                    return (
                      <button
                        key={idx}
                        className="btn"
                        onClick={() => handleOptionSelect(qIndex, opt)}
                        disabled={submitting}
                        style={{ 
                          padding: '1.25rem', 
                          fontSize: '1.05rem', 
                          background: isSelected ? '#f0f7ff' : '#ffffff', 
                          border: `2px solid ${isSelected ? '#0066cc' : '#f1f5f9'}`,
                          color: isSelected ? '#0066cc' : '#475569',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          borderRadius: '12px',
                          fontWeight: isSelected ? 600 : 500
                        }}
                      >
                        <div style={{ 
                          width: '24px', 
                          height: '24px', 
                          borderRadius: '50%', 
                          border: `2px solid ${isSelected ? '#0066cc' : '#cbd5e1'}`,
                          marginRight: '15px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? '#0066cc' : 'transparent'
                        }}>
                          {isSelected && <div style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%' }} />}
                        </div>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            <button 
              className="btn btn-primary btn-full" 
              style={{ padding: '1.25rem', fontSize: '1.1rem', marginTop: '1rem', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0, 102, 204, 0.2)' }}
              onClick={handleSubmitVotes}
              disabled={submitting || Object.keys(answers).length !== poll.questions.length}
            >
              {submitting ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.5s ease-out', width: '100%' }}>
            <div style={{ background: '#ecfdf5', color: '#059669', padding: '12px 24px', borderRadius: '50px', fontWeight: 600, marginBottom: '4rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #d1fae5' }}>
              <span style={{ fontSize: '1.2rem' }}>✓</span> Your response has been submitted
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem', width: '100%' }}>
              {poll.questions.map((q, qIndex) => (
                <div key={qIndex} style={{ width: '100%' }}>
                  <h3 style={{ color: '#1e293b', fontSize: '1.2rem', marginBottom: '2rem', textAlign: 'center', fontWeight: 600 }}>
                    {qIndex + 1}. {q.text}
                  </h3>
                  <div style={{ width: '100%', height: '320px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData[qIndex] || []}
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          innerRadius={60}
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
                          contentStyle={{ background: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '10px' }}
                          itemStyle={{ color: '#1e293b' }}
                        />
                        <Legend verticalAlign="bottom" height={40} wrapperStyle={{ color: '#64748b', fontSize: '0.9rem' }}/>
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
