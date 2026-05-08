import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Users, Plus, Calendar, Save, Trash2, CheckSquare, ArrowLeft } from 'lucide-react';

export default function BatchManagement() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('CREATE_BATCH');
  
  // Form states
  const [batchSchedules, setBatchSchedules] = useState([]);
  
  // Form states
  const [batchName, setBatchName] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  
  const [schedule, setSchedule] = useState({
    batchId: '',
    quizId: '',
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    loadData();
    loadSchedules();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchRes, userRes, quizRes] = await Promise.all([
        api.get('/batch'),
        api.get('/admin/users'),
        api.get('/quiz')
      ]);
      setBatches(batchRes.data.batches || []);
      setUsers(userRes.data.users || []);
      setQuizzes(Array.isArray(quizRes.data) ? quizRes.data : quizRes.data.quizzes || []);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const { data } = await api.get('/assignment/batch');
      setBatchSchedules(data.assignments || []);
    } catch (err) {
      console.error('Failed to load schedules');
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!batchName.trim()) return;
    try {
      await api.post('/batch', { name: batchName });
      toast.success('Batch created successfully');
      setBatchName('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create batch');
    }
  };

  const handleAssignUsers = async (e) => {
    e.preventDefault();
    if (!selectedBatch) return toast.error('Please select a batch');
    try {
      await api.put(`/batch/${selectedBatch}/users`, { users: Array.from(selectedUsers) });
      toast.success('Users assigned successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign users');
    }
  };

  const handleScheduleQuiz = async (e) => {
    e.preventDefault();
    let { batchId, quizId, startTime, endTime } = schedule;
    if (!batchId || !quizId || !startTime || !endTime) return toast.error('All fields are required');
    
    // Robust conversion to IST (UTC+5:30)
    // datetime-local input gives: "YYYY-MM-DDTHH:mm"
    const convertToISTUtc = (dateTimeStr) => {
      const [datePart, timePart] = dateTimeStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, min] = timePart.split(':').map(Number);
      
      // Date.UTC(year, monthIndex, day, hour, minute)
      // IST is UTC + 5:30, so UTC = IST - 5.5 hours
      const utcMillis = Date.UTC(year, month - 1, day, hour, min) - (5.5 * 60 * 60 * 1000);
      return new Date(utcMillis).toISOString();
    };

    const startISO = convertToISTUtc(startTime);
    const endISO = convertToISTUtc(endTime);

    if (new Date(startISO) >= new Date(endISO)) {
      return toast.error('Start time must be before end time');
    }

    try {
      console.log('[Scheduling] Sending IST-adjusted times:', { startISO, endISO });
      await api.post('/assignment/create', {
        ...schedule,
        startTime: startISO,
        endTime: endISO
      });
      toast.success('Quiz scheduled successfully');
      setSchedule({ batchId: '', quizId: '', startTime: '', endTime: '' });
      loadSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to schedule quiz');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to remove this schedule?')) return;
    try {
      await api.delete(`/assignment/batch/${id}`);
      toast.success('Schedule removed');
      loadSchedules();
    } catch (err) {
      toast.error('Failed to remove schedule');
    }
  };

  // Helper to load users for a selected batch
  useEffect(() => {
    if (selectedBatch && activeTab === 'ASSIGN_USERS') {
      const batch = batches.find(b => b._id === selectedBatch);
      if (batch) {
        setSelectedUsers(new Set(batch.users.map(u => typeof u === 'string' ? u : u._id)));
      }
    }
  }, [selectedBatch, activeTab, batches]);

  const toggleUser = (id) => {
    const next = new Set(selectedUsers);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedUsers(next);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content fade-in">
        <div className="page-header" style={{ marginBottom: 30, display: 'block' }}>
          <button 
            onClick={() => navigate('/admin/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '1rem', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
            onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--bg-primary)', padding: 10, borderRadius: 8, color: 'var(--accent)' }}>
              <Users size={24} />
            </div>
            <div>
              <h1>Batch Management</h1>
              <p style={{ color: 'var(--text-secondary)' }}>Create batches, assign students, and schedule exams.</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
          <button 
            className={`btn ${activeTab === 'CREATE_BATCH' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('CREATE_BATCH')}
          >
            <Plus size={16} /> Create Batch
          </button>
          <button 
            className={`btn ${activeTab === 'ASSIGN_USERS' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('ASSIGN_USERS')}
          >
            <CheckSquare size={16} /> Assign Users
          </button>
          <button 
            className={`btn ${activeTab === 'SCHEDULE_EXAM' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('SCHEDULE_EXAM')}
          >
            <Calendar size={16} /> Schedule Exam
          </button>
        </div>

        <div className="card">
          {activeTab === 'CREATE_BATCH' && (
            <form onSubmit={handleCreateBatch}>
              <h2 className="title-sm" style={{ marginBottom: 16 }}>Create New Batch</h2>
              <div className="form-group" style={{ maxWidth: 400 }}>
                <label className="form-label">Batch Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={batchName} 
                  onChange={(e) => setBatchName(e.target.value)} 
                  placeholder="e.g. 2026 CS Batch A"
                />
              </div>
              <button type="submit" className="btn btn-primary"><Save size={16} /> Save Batch</button>

              <h3 style={{ marginTop: 40, marginBottom: 16 }}>Existing Batches</h3>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Batch Name</th>
                      <th>Total Students</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map(b => (
                      <tr key={b._id}>
                        <td style={{ fontWeight: 600 }}>{b.name}</td>
                        <td>{b.users?.length || 0} Students</td>
                        <td>{new Date(b.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </form>
          )}

          {activeTab === 'ASSIGN_USERS' && (
            <form onSubmit={handleAssignUsers}>
              <h2 className="title-sm" style={{ marginBottom: 16 }}>Assign Users to Batch</h2>
              <div className="form-group" style={{ maxWidth: 400 }}>
                <label className="form-label">Select Batch</label>
                <select 
                  className="form-input" 
                  value={selectedBatch} 
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>

              {selectedBatch && (
                <>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Select Students</label>
                    <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                      {selectedUsers.size} Selected
                    </span>
                  </div>
                  <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 20 }}>
                    {users.map(u => (
                      <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.has(u._id)} 
                          onChange={() => toggleUser(u._id)}
                          style={{ width: 16, height: 16 }}
                        />
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className="btn btn-primary"><Save size={16} /> Update Batch Users</button>
                </>
              )}
            </form>
          )}

          {activeTab === 'SCHEDULE_EXAM' && (
            <div>
              <form onSubmit={handleScheduleQuiz} style={{ marginBottom: 40 }}>
                <h2 className="title-sm" style={{ marginBottom: 16 }}>Create New Schedule</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, maxWidth: 800 }}>
                  <div className="form-group">
                    <label className="form-label">Select Batch</label>
                    <select 
                      className="form-input" 
                      value={schedule.batchId} 
                      onChange={(e) => setSchedule({...schedule, batchId: e.target.value})}
                    >
                      <option value="">-- Choose Batch --</option>
                      {batches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Select Assessment</label>
                    <select 
                      className="form-input" 
                      value={schedule.quizId} 
                      onChange={(e) => setSchedule({...schedule, quizId: e.target.value})}
                    >
                      <option value="">-- Choose Quiz --</option>
                      {quizzes.map(q => <option key={q._id} value={q._id}>{q.title}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input 
                      type="datetime-local" 
                      className="form-input" 
                      value={schedule.startTime} 
                      onChange={(e) => setSchedule({...schedule, startTime: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input 
                      type="datetime-local" 
                      className="form-input" 
                      value={schedule.endTime} 
                      onChange={(e) => setSchedule({...schedule, endTime: e.target.value})}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
                  <Calendar size={16} /> Assign &amp; Schedule
                </button>
              </form>

              <h2 className="title-sm" style={{ marginBottom: 16 }}>Existing Schedules</h2>
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Batch</th>
                      <th>Assessment</th>
                      <th>Schedule Window</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchSchedules.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No schedules found</td></tr>
                    ) : (
                      batchSchedules.map(s => (
                        <tr key={s._id}>
                          <td style={{ fontWeight: 600 }}>{s.batchId?.name || 'Deleted Batch'}</td>
                          <td>{s.quizId?.title || 'Deleted Quiz'}</td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <div style={{ color: '#059669' }}>
                              <strong>Starts:</strong> {new Date(s.startTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </div>
                            <div style={{ color: '#dc2626' }}>
                              <strong>Ends:</strong> {new Date(s.endTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                            </div>
                          </td>
                          <td>
                            <button 
                              className="btn btn-danger btn-sm" 
                              onClick={() => handleDeleteSchedule(s._id)}
                              style={{ padding: '6px 12px' }}
                            >
                              <Trash2 size={14} />
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
