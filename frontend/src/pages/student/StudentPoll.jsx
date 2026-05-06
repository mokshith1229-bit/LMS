import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const COLORS = ['#8DC63F', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function StudentPoll() {
  const { code } = useParams();
  const [poll, setPoll] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [resultsRevealed, setResultsRevealed] = useState(false);

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

  // Socket connection effect (Student room only, no insights received)
  useEffect(() => {
    if (!poll?.code) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    // Join student-specific room
    socket.emit('join_poll_user', poll.code);

    socket.on('poll_reveal', (data) => {
      setResultsRevealed(true);
      toast.success(data.message || 'Results have been revealed!');
    });

    return () => socket.disconnect();
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
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Inter, sans-serif' }}>
      
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeIn 0.5s ease-out', width: '100%', padding: '2rem 0' }}>
            <div style={{ background: '#ecfdf5', color: '#059669', padding: '12px 24px', borderRadius: '50px', fontWeight: 600, marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #d1fae5' }}>
              <span style={{ fontSize: '1.2rem' }}>✓</span> Your response has been submitted
            </div>
            <div style={{ background: '#f0f9ff', border: '1px solid #e0f2fe', padding: '2rem', borderRadius: '16px', textAlign: 'center', maxWidth: '500px' }}>
              {poll.revealMode === 'delayed' && !resultsRevealed ? (
                <>
                  <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>Answer submitted.</h2>
                  <p style={{ color: '#0ea5e9', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>⏳ Waiting for the session to conclude...</p>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>Please wait for the administrator to finalize the poll.</p>
                </>
              ) : resultsRevealed ? (
                <>
                  <h2 style={{ color: '#059669', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>Poll Concluded</h2>
                  <p style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>Thank you for your participation!</p>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>The session has ended. You may now close this window.</p>
                </>
              ) : (
                <>
                  <h2 style={{ color: '#0369a1', fontSize: '1.5rem', marginBottom: '1rem', fontWeight: 700 }}>Thank you!</h2>
                  <p style={{ color: '#0ea5e9', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>Participation level: Excellent—let’s keep the streak alive!</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
