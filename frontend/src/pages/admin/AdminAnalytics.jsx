import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Activity, Users, Award, CheckCircle, ChevronDown, ChevronUp, ArrowLeft, 
  Clock, AlertCircle, Download, RefreshCw, Search, Filter, TrendingUp,
  FileText, ArrowUpRight, Check, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminAnalytics.css';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const CHART_COLORS = {
  pass: '#10B981',
  fail: '#EF4444',
  attempted: '#3B82F6',
  pending: '#64748B',
  primary: '#3B82F6'
};

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState('');
  
  const [analytics, setAnalytics] = useState(null);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await api.get('/batch');
      setBatches(res.data.batches || []);
    } catch (error) {
      console.error('Batch fetch error:', error);
      toast.error('Failed to load batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    if (selectedBatch) {
      fetchQuizzesForBatch(selectedBatch);
      setSelectedQuiz(''); 
      setAnalytics(null);  
    } else {
      setQuizzes([]);
      setSelectedQuiz('');
      setAnalytics(null);
    }
  }, [selectedBatch]);

  const fetchQuizzesForBatch = async (batchId) => {
    try {
      setLoadingQuizzes(true);
      const res = await api.get(`/batch/${batchId}/quizzes`);
      setQuizzes(res.data.quizzes || []);
    } catch (error) {
      console.error('Quiz fetch error:', error);
      toast.error('Failed to load quizzes for batch');
    } finally {
      setLoadingQuizzes(false);
    }
  };

  useEffect(() => {
    if (selectedBatch && selectedQuiz) {
      fetchAnalytics();
    } else {
      setAnalytics(null);
    }
  }, [selectedBatch, selectedQuiz]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    setExpandedRow(null);
    try {
      const res = await api.get(`/admin/analytics?batchId=${selectedBatch}&quizId=${selectedQuiz}`);
      setAnalytics(res.data.data);
    } catch (error) {
      console.error('Analytics fetch error:', error);
      toast.error('Failed to load analytics');
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  const filteredStudents = useMemo(() => {
    if (!analytics?.studentTable) return [];
    return analytics.studentTable.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            student.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || 
                           (statusFilter === 'PASS' && student.passed) || 
                           (statusFilter === 'FAIL' && !student.passed);
      return matchesSearch && matchesStatus;
    });
  }, [analytics, searchTerm, statusFilter]);

  const passFailData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Passed', value: analytics.passCount, color: CHART_COLORS.pass },
      { name: 'Failed', value: analytics.failCount, color: CHART_COLORS.fail }
    ];
  }, [analytics]);

  const attemptData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Attempted', value: analytics.attemptedStudents, color: CHART_COLORS.attempted },
      { name: 'Pending', value: analytics.pendingStudents, color: CHART_COLORS.pending }
    ];
  }, [analytics]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-data">
              <span className="tooltip-dot" style={{ backgroundColor: entry.color || entry.fill }}></span>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="analytics-container">
      <Sidebar />
      <main className="analytics-main">
        <div className="glow-left"></div>
        <div className="glow-right"></div>

        <div className="analytics-content">
          <div className="header-row">
            <div>
              <button onClick={() => navigate('/admin/dashboard')} className="back-btn">
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <h1 className="page-title">
                <Activity size={32} /> Intelligence Hub
              </h1>
              <p className="page-subtitle">Real-time assessment analytics and batch performance metrics.</p>
            </div>

            <div className="header-actions">
              <button 
                onClick={fetchAnalytics}
                disabled={!selectedBatch || !selectedQuiz || loadingAnalytics}
                className="action-btn btn-refresh"
              >
                <RefreshCw size={16} className={loadingAnalytics ? "spin" : ""} />
                Refresh
              </button>
              <button 
                disabled={!analytics || analytics.attemptedStudents === 0}
                className="action-btn btn-export"
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>
      
          <div className="filter-bar">
            <div className="filter-group">
              <Users size={16} className="filter-icon-left" />
              <select 
                value={selectedBatch} 
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={loadingBatches}
                className="filter-select"
              >
                <option value="">{loadingBatches ? 'Loading workspace...' : 'Select Target Batch'}</option>
                {batches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="filter-icon-right" />
            </div>

            <div className="filter-group">
              <FileText size={16} className="filter-icon-left" />
              <select 
                value={selectedQuiz} 
                onChange={(e) => setSelectedQuiz(e.target.value)}
                disabled={!selectedBatch || loadingQuizzes || quizzes.length === 0}
                className="filter-select"
              >
                <option value="">
                  {!selectedBatch 
                    ? 'Awaiting batch selection...' 
                    : loadingQuizzes 
                      ? 'Loading assessments...' 
                      : quizzes.length === 0 
                        ? 'No active assessments' 
                        : 'Select Assessment Context'}
                </option>
                {quizzes.map(q => (
                  <option key={q._id} value={q._id}>{q.title}</option>
                ))}
              </select>
              <ChevronDown size={16} className="filter-icon-right" />
            </div>
          </div>

          {loadingAnalytics && (
            <div className="state-container">
              <div className="loader-spinner">
                <div className="loader-outer"></div>
                <div className="loader-inner"></div>
              </div>
              <p className="state-desc" style={{marginTop: '16px'}}>Aggregating Intelligence...</p>
            </div>
          )}

          {!loadingAnalytics && !analytics && selectedBatch && selectedQuiz && (
            <div className="state-container fade-in">
              <AlertCircle size={48} className="state-icon-bg" style={{color: '#64748b', background: 'transparent'}} />
              <h3 className="state-title">No Data Signals Detected</h3>
              <p className="state-desc">The analytics engine could not retrieve data for this selection. Verify assessment status.</p>
            </div>
          )}

          {!loadingAnalytics && analytics && analytics.attemptedStudents === 0 && (
            <div className="state-container fade-in">
              <div className="state-icon-bg">
                <Clock size={32} color="#94a3b8" />
              </div>
              <h3 className="state-title">Awaiting Submissions</h3>
              <p className="state-desc">The selected batch has not initiated this assessment. Metrics will populate in real-time as submissions stream in.</p>
            </div>
          )}

          {!loadingAnalytics && analytics && analytics.attemptedStudents > 0 && (
            <div className="fade-in">
              <div className="kpi-grid">
                {[
                  { label: 'Total Cohort', value: analytics.totalStudents, icon: Users, color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)' },
                  { label: 'Attempted', value: analytics.attemptedStudents, subValue: `${analytics.completionRate}%`, icon: Activity, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.1)' },
                  { label: 'Pending', value: analytics.pendingStudents, icon: Clock, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
                  { label: 'Avg Score', value: `${analytics.averageScore}%`, icon: TrendingUp, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
                  { label: 'Pass Rate', value: `${analytics.passPercentage}%`, icon: CheckCircle, color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)' },
                  { label: 'Highest Score', value: `${analytics.highestScore}%`, icon: Award, color: '#c084fc', bg: 'rgba(192, 132, 252, 0.1)' },
                ].map((kpi, idx) => (
                  <div key={idx} className="kpi-card">
                    <kpi.icon size={64} className="kpi-bg-icon" style={{color: kpi.color}} />
                    <div className="kpi-icon-box" style={{backgroundColor: kpi.bg, color: kpi.color}}>
                      <kpi.icon size={20} />
                    </div>
                    <p className="kpi-label">{kpi.label}</p>
                    <div className="kpi-value-row">
                      <span className="kpi-value">{kpi.value}</span>
                      {kpi.subValue && <span className="kpi-subvalue">({kpi.subValue})</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <div className="chart-header">
                    <div>
                      <h2 className="chart-title">Score Distribution Trajectory</h2>
                      <p className="chart-subtitle">Individual performance across the assessment lifecycle</p>
                    </div>
                    <div className="live-badge"><TrendingUp size={12} /> Live</div>
                  </div>
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.studentScores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} tickFormatter={(val) => val.split(' ')[0]} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="score" stroke={CHART_COLORS.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="widgets-col">
                  <div className="widget-card">
                    <h3 className="widget-title">Outcome Matrix</h3>
                    <div className="widget-content">
                      <div className="widget-chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={passFailData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
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

                  <div className="widget-card">
                    <h3 className="widget-title">Cohort Engagement</h3>
                    <div className="widget-content">
                      <div className="widget-chart-wrapper">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={attemptData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                              {attemptData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="widget-center-text">{analytics.completionRate}%</div>
                      </div>
                      <div className="widget-legend">
                        <div className="legend-item">
                          <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#3b82f6'}}></span><span className="legend-label">Attempted</span></div>
                          <span className="legend-val">{analytics.attemptedStudents}</span>
                        </div>
                        <div className="legend-item">
                          <div className="legend-label-group"><span className="legend-dot" style={{backgroundColor: '#64748b'}}></span><span className="legend-label">Pending</span></div>
                          <span className="legend-val">{analytics.pendingStudents}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-panel">
                <div className="table-header-row" style={{borderBottom: 'none'}}>
                  <div>
                    <h2 className="table-title">Item Analysis Matrix</h2>
                    <p className="table-subtitle">Detailed breakdown of question-level performance</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{textAlign: 'center', width: '48px'}}>#</th>
                        <th>Question Parameter</th>
                        <th style={{width: '200px'}}>Accuracy Rate</th>
                        <th style={{textAlign: 'center', width: '120px'}}>Status</th>
                        <th style={{textAlign: 'center', width: '120px'}}>Variance</th>
                        <th style={{textAlign: 'right', width: '80px'}}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.questions.map((q, idx) => {
                        const isWeak = q.accuracy < 50;
                        const isPerfect = q.accuracy === 100;
                        const optionData = Object.keys(q.optionCounts)
                          .filter(k => k !== 'NA' && q.optionCounts[k] > 0)
                          .map((key, i) => ({
                            name: `Opt ${key}`, fullname: `Option ${key}`, value: q.optionCounts[key], color: COLORS[i % COLORS.length]
                          }));

                        return (
                          <React.Fragment key={idx}>
                            <tr className="table-row clickable" onClick={() => toggleRow(idx)}>
                              <td style={{textAlign: 'center'}} className="cell-secondary">{idx + 1}</td>
                              <td className="cell-primary" style={{maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                {q.question}
                              </td>
                              <td>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                  <span style={{fontFamily: 'monospace', fontWeight: '600', color: '#fff', width: '40px', textAlign: 'right'}}>{q.accuracy}%</span>
                                  <div className="dist-bar-wrap" style={{flex: 1, backgroundColor: '#1e293b'}}>
                                    <div className="dist-bar-fill" style={{ width: `${q.accuracy}%`, backgroundColor: isPerfect ? '#34d399' : isWeak ? '#f87171' : '#3b82f6', boxShadow: isPerfect ? '0 0 10px rgba(52,211,153,0.5)' : 'none' }}></div>
                                  </div>
                                </div>
                              </td>
                              <td style={{textAlign: 'center'}}>
                                {isWeak ? <span className="badge-status badge-critical">Critical</span> : 
                                 isPerfect ? <span className="badge-status badge-mastered">Mastered</span> : 
                                 <span className="badge-status badge-nominal">Nominal</span>}
                              </td>
                              <td style={{textAlign: 'center'}}>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                  <span style={{fontSize: '0.75rem', color: '#64748b'}}>Ans: <span style={{color: '#34d399', fontWeight: '700'}}>{q.correctAnswer}</span></span>
                                  {q.mostSelected !== q.correctAnswer && q.mostSelected !== 'N/A' && (
                                    <span style={{fontSize: '0.65rem', color: '#f87171', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px'}}>
                                      <ArrowUpRight size={10} /> Shifted to {q.mostSelected}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{textAlign: 'right'}}>
                                <div className={`action-btn-table ${expandedRow === idx ? 'expanded' : ''}`}>
                                  {expandedRow === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </td>
                            </tr>

                            {expandedRow === idx && (
                              <tr className="expanded-row">
                                <td colSpan="6">
                                  <div className="expanded-content fade-in">
                                    <div className="expanded-grid">
                                      <div>
                                        <h4 className="dist-title">Response Distribution</h4>
                                        <div className="dist-list">
                                          {optionData.map((opt, i) => {
                                            const isCorrect = opt.fullname.replace('Option ', '') === q.correctAnswer;
                                            const pct = ((opt.value / analytics.attemptedStudents) * 100).toFixed(1);
                                            return (
                                              <div key={i} className="dist-item">
                                                <div className="dist-item-left">
                                                  <div className="dist-box" style={{backgroundColor: `${opt.color}20`, color: opt.color}}>{opt.fullname.replace('Option ', '')}</div>
                                                  <span className={`dist-label ${isCorrect ? 'correct' : ''}`}>{isCorrect && <Check size={14} />} Selected</span>
                                                </div>
                                                <div className="dist-item-right">
                                                  <div className="dist-bar-wrap">
                                                    <div className="dist-bar-fill" style={{width: `${pct}%`, backgroundColor: opt.color}}></div>
                                                  </div>
                                                  <span className="dist-pct">{pct}%</span>
                                                  <span className="dist-count">({opt.value})</span>
                                                </div>
                                              </div>
                                            )
                                          })}
                                          {q.optionCounts['NA'] > 0 && (
                                            <div className="dist-item dashed">
                                              <div className="dist-item-left">
                                                <div className="dist-box empty">--</div>
                                                <span className="dist-label" style={{color: '#94a3b8'}}>Unattempted</span>
                                              </div>
                                              <div className="dist-item-right">
                                                <span className="dist-pct" style={{color: '#94a3b8'}}>{((q.optionCounts['NA'] / analytics.attemptedStudents) * 100).toFixed(1)}%</span>
                                                <span className="dist-count">({q.optionCounts['NA']})</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="chart-viz-box">
                                        <h4 className="viz-title">Visual Hierarchy</h4>
                                        {optionData.length > 0 ? (
                                          <div className="viz-chart-wrap">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <BarChart data={optionData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                                                <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }} itemStyle={{ color: '#fff' }} />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                                  {optionData.map((entry, i) => (<Cell key={`cell-${i}`} fill={entry.color} />))}
                                                </Bar>
                                              </BarChart>
                                            </ResponsiveContainer>
                                          </div>
                                        ) : (
                                          <p className="no-data">Insufficient data for visualization</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-panel">
                <div className="table-header-row">
                  <div>
                    <h2 className="table-title">Student Roster Metrics</h2>
                    <p className="table-subtitle">Individual performance records and submission timestamps</p>
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
                        <th>Identity</th>
                        <th>Score</th>
                        <th style={{textAlign: 'center'}}>Correct</th>
                        <th style={{textAlign: 'center'}}>Incorrect</th>
                        <th>Outcome</th>
                        <th style={{textAlign: 'right'}}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((student, idx) => (
                          <tr key={idx} className="table-row">
                            <td>
                              <div className="cell-primary">{student.name}</div>
                              <div className="cell-secondary">{student.email}</div>
                            </td>
                            <td><span className={`cell-score ${student.passed ? 'text-green' : 'text-red'}`}>{student.percentage}%</span></td>
                            <td style={{textAlign: 'center'}}><span className="count-box count-correct">{student.correct}</span></td>
                            <td style={{textAlign: 'center'}}><span className="count-box count-wrong">{student.wrong}</span></td>
                            <td>
                              {student.passed ? 
                                <span className="badge-status badge-mastered" style={{boxShadow: '0 0 10px rgba(16,185,129,0.1)'}}><Check size={12} /> Certified</span> : 
                                <span className="badge-status badge-critical"><X size={12} /> Failed</span>
                              }
                            </td>
                            <td style={{textAlign: 'right'}}>
                              <div className="cell-secondary" style={{color: '#cbd5e1'}}>{new Date(student.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                              <div className="cell-secondary" style={{fontSize: '0.65rem'}}>{new Date(student.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}</div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="empty-table-cell">
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
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
