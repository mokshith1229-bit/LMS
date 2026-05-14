import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  ArrowLeft, Users, Activity, Clock, TrendingUp, CheckCircle, Award, 
  RefreshCw, Download, Search, Filter, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminAnalytics.css';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const CHART_COLORS = {
  pass: '#10b981',
  fail: '#ef4444',
  attempted: '#2563eb',
  pending: '#94a3b8',
  primary: '#2563eb'
};

export default function DetailedAnalytics() {
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const batchId = searchParams.get('batchId');
  const quizId = searchParams.get('quizId');
  
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    if (batchId && quizId) {
      fetchAnalytics();
    } else {
      setLoading(false);
      toast.error('Missing parameters');
    }
  }, [batchId, quizId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/analytics?batchId=${batchId}&quizId=${quizId}`);
      setAnalytics(res.data.data);
    } catch (error) {
      console.error('Analytics fetch error:', error);
      toast.error('Failed to load analytics details');
    } finally {
      setLoading(false);
    }
  };

  const getPageConfig = () => {
    switch (type) {
      case 'cohort': return { title: 'Cohort Analytics', icon: Users, desc: 'Overview of all students in selected batch' };
      case 'attempted': return { title: 'Attempted Participants', icon: Activity, desc: 'Students who completed the assessment' };
      case 'pending': return { title: 'Pending Submissions', icon: Clock, desc: 'Students who have not yet attempted' };
      case 'average-score': return { title: 'Score Distribution Analysis', icon: TrendingUp, desc: 'Score trends and distribution charts' };
      case 'pass-rate': return { title: 'Pass Rate Analytics', icon: CheckCircle, desc: 'Pass vs Fail breakdown and comparisons' };
      case 'highest-score': return { title: 'Top Performers', icon: Award, desc: 'Highest scoring students and rankings' };
      default: return { title: 'Detailed Analytics', icon: Activity, desc: 'In-depth reporting' };
    }
  };

  const config = getPageConfig();

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-data">
              <span className="tooltip-dot" style={{ backgroundColor: entry.color || entry.fill }}></span>
              {entry.name}: {entry.value}
              {entry.name.includes('Passed') || entry.name.includes('Failed') ? '' : '%'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="state-container">
          <div className="loader-spinner">
            <div className="loader-outer"></div>
            <div className="loader-inner"></div>
          </div>
          <p className="state-desc" style={{marginTop: '16px'}}>Loading detailed analytics...</p>
        </div>
      );
    }

    if (!analytics) {
      return (
        <div className="state-container fade-in">
          <p className="state-desc">No data found. Please return to the dashboard.</p>
        </div>
      );
    }

    let displayStudents = analytics.studentTable || [];
    
    // Sort logic for top performers
    if (type === 'highest-score') {
      displayStudents = [...displayStudents].sort((a, b) => b.percentage - a.percentage);
    }

    // Filter logic
    displayStudents = displayStudents.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            student.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || 
                           (statusFilter === 'PASS' && student.passed) || 
                           (statusFilter === 'FAIL' && !student.passed);
      return matchesSearch && matchesStatus;
    });

    const passFailData = [
      { name: 'Passed', value: analytics.passCount, color: CHART_COLORS.pass },
      { name: 'Failed', value: analytics.failCount, color: CHART_COLORS.fail }
    ];

    const attemptData = [
      { name: 'Attempted', value: analytics.attemptedStudents, color: CHART_COLORS.attempted },
      { name: 'Pending', value: analytics.pendingStudents, color: CHART_COLORS.pending }
    ];

    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Type specific top widgets */}
        {(type === 'pass-rate' || type === 'average-score' || type === 'attempted' || type === 'pending') && (
          <div className="charts-grid" style={{ gridTemplateColumns: type === 'average-score' ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            
            {(type === 'average-score') && (
              <div className="chart-card">
                <div className="chart-header">
                  <div>
                    <h2 className="chart-title">Score Distribution Trend</h2>
                    <p className="chart-subtitle">Individual performance across the assessment</p>
                  </div>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.studentScores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.1}/>
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(val) => val.split(' ')[0]} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="score" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {(type === 'pass-rate') && (
              <div className="widget-card">
                <h3 className="widget-title">Performance Outcome</h3>
                <div className="widget-content">
                  <div className="widget-chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={passFailData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                          {passFailData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="widget-center-text">{analytics.passPercentage}%</div>
                  </div>
                  <div className="widget-legend">
                    <div className="legend-item">
                      <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#10b981'}}></span><span className="legend-label">Passed</span></div>
                      <span className="legend-val">{analytics.passCount}</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#ef4444'}}></span><span className="legend-label">Failed</span></div>
                      <span className="legend-val">{analytics.failCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(type === 'attempted' || type === 'pending') && (
              <div className="widget-card">
                <h3 className="widget-title">Participation Overview</h3>
                <div className="widget-content">
                  <div className="widget-chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={attemptData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value" stroke="none">
                          {attemptData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="widget-center-text">{analytics.completionRate}%</div>
                  </div>
                  <div className="widget-legend">
                    <div className="legend-item">
                      <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#2563eb'}}></span><span className="legend-label">Attempted</span></div>
                      <span className="legend-val">{analytics.attemptedStudents}</span>
                    </div>
                    <div className="legend-item">
                      <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#94a3b8'}}></span><span className="legend-label">Pending</span></div>
                      <span className="legend-val">{analytics.pendingStudents}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Table */}
        {type !== 'pending' && (
          <div className="table-panel">
            <div className="table-header-row">
              <div>
                <h2 className="table-title">{type === 'highest-score' ? 'Top Performers Ranking' : 'Student Roster'}</h2>
                <p className="table-subtitle">Individual performance metrics and outcomes</p>
              </div>
              <div className="table-controls">
                <div className="control-input-wrap">
                  <Search className="control-icon" size={16} />
                  <input type="text" placeholder="Search roster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="control-input" />
                </div>
                <div className="control-input-wrap">
                  <Filter className="control-icon" size={16} />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="control-select">
                    <option value="ALL">All Status</option>
                    <option value="PASS">Passed Only</option>
                    <option value="FAIL">Failed Only</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="table-wrap scrollable">
              <table className="data-table">
                <thead>
                  <tr>
                    {type === 'highest-score' && <th style={{textAlign: 'center', width: '60px'}}>Rank</th>}
                    <th>Candidate</th>
                    <th>Score</th>
                    <th style={{textAlign: 'center'}}>Correct</th>
                    <th style={{textAlign: 'center'}}>Incorrect</th>
                    <th>Outcome</th>
                    <th style={{textAlign: 'right'}}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {displayStudents.length > 0 ? (
                    displayStudents.map((student, idx) => (
                      <tr key={idx} className="table-row">
                        {type === 'highest-score' && (
                          <td style={{textAlign: 'center'}}>
                            {idx === 0 ? <Award size={20} color="#f59e0b" /> : 
                             idx === 1 ? <Award size={20} color="#94a3b8" /> : 
                             idx === 2 ? <Award size={20} color="#b45309" /> : 
                             <span style={{fontWeight: 600, color: '#64748b'}}>#{idx + 1}</span>}
                          </td>
                        )}
                        <td>
                          <div className="cell-primary">{student.name}</div>
                          <div className="cell-secondary">{student.email}</div>
                        </td>
                        <td><span className={`cell-score ${student.passed ? 'text-green' : 'text-red'}`}>{student.percentage}%</span></td>
                        <td style={{textAlign: 'center'}}><span className="count-box count-correct">{student.correct}</span></td>
                        <td style={{textAlign: 'center'}}><span className="count-box count-wrong">{student.wrong}</span></td>
                        <td>
                          {student.passed ? 
                            <span className="badge-status badge-mastered"><Check size={12} /> Passed</span> : 
                            <span className="badge-status badge-critical"><X size={12} /> Failed</span>
                          }
                        </td>
                        <td style={{textAlign: 'right'}}>
                          <div className="cell-secondary" style={{color: '#475569', marginTop: 0}}>{new Date(student.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="cell-secondary" style={{fontSize: '0.65rem'}}>{new Date(student.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={type === 'highest-score' ? 7 : 6} className="empty-table-cell">
                        <div className="empty-table-content">
                          <Search size={32} className="empty-table-icon" />
                          <p className="empty-table-text">No records match your criteria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {type === 'pending' && (
           <div className="table-panel">
            <div className="table-header-row">
              <div>
                <h2 className="table-title">Pending Roster Status</h2>
                <p className="table-subtitle">Summary of outstanding assessments</p>
              </div>
            </div>
            <div className="table-wrap">
              <div className="empty-table-cell" style={{ padding: '64px 24px' }}>
                <div className="empty-table-content">
                  <Clock size={48} className="empty-table-icon" style={{color: '#94a3b8'}} />
                  <h3 style={{color: '#333', fontSize: '1.25rem', marginTop: '16px'}}>Awaiting Submissions</h3>
                  <p className="empty-table-text" style={{marginTop: '8px', maxWidth: '400px', lineHeight: '1.5'}}>
                    There are currently <strong>{analytics.pendingStudents}</strong> students who have not yet submitted this assessment. Individual pending candidate names are kept anonymous until their first attempt is initiated.
                  </p>
                </div>
              </div>
            </div>
           </div>
        )}

      </div>
    );
  };

  return (
    <div className="analytics-container">
      <Sidebar />
      <main className="analytics-main">
        <div className="analytics-content">
          <div className="header-row">
            <div>
              <button onClick={() => navigate('/admin/analytics')} className="back-btn">
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <h1 className="page-title">
                <config.icon size={28} /> {config.title}
              </h1>
              <p className="page-subtitle">{config.desc}</p>
            </div>

            <div className="header-actions">
              <button onClick={fetchAnalytics} disabled={loading} className="action-btn btn-refresh">
                <RefreshCw size={16} className={loading ? "spin" : ""} />
                Refresh Data
              </button>
              <button disabled={!analytics || analytics.attemptedStudents === 0} className="action-btn btn-export">
                <Download size={16} />
                Export
              </button>
            </div>
          </div>

          {renderContent()}

        </div>
      </main>
    </div>
  );
}
