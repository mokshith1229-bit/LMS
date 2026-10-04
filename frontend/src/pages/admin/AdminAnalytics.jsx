import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api/axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Activity, Users, Award, CheckCircle, ChevronDown, ChevronUp, ArrowLeft, 
  Clock, AlertCircle, Download, RefreshCw, Search, Filter, TrendingUp,
  FileText, ArrowUpRight, Check, X, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import './AdminAnalytics.css';

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#06B6D4', '#D946EF', '#6366F1'];
const CHART_COLORS = {
  pass: '#10b981',
  fail: '#ef4444',
  attempted: '#8DC63F',
  pending: '#94a3b8',
  primary: '#8DC63F'
};

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [batches, setBatches] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  
  const [selectedBatch, setSelectedBatch] = useState(searchParams.get('batchId') || '');
  const [selectedQuiz, setSelectedQuiz] = useState(searchParams.get('quizId') || '');
  
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
      setSearchParams({ batchId: selectedBatch, quizId: selectedQuiz }, { replace: true });
      fetchAnalytics();
    } else if (selectedBatch) {
      setSearchParams({ batchId: selectedBatch }, { replace: true });
      setAnalytics(null);
    } else {
      setSearchParams({}, { replace: true });
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

  const handleKpiClick = (route) => {
    navigate(`/admin/analytics/${route}?batchId=${selectedBatch}&quizId=${selectedQuiz}`);
  };

  const lowestScore = useMemo(() => {
    if (!analytics?.studentTable?.length) return 0;
    return Math.min(...analytics.studentTable.map(s => s.percentage));
  }, [analytics]);

  const { strongestArea, focusArea } = useMemo(() => {
    if (!analytics?.sectionPerformance?.length) return { strongestArea: null, focusArea: null };
    const sorted = [...analytics.sectionPerformance].sort((a, b) => b.accuracy - a.accuracy);
    return {
      strongestArea: sorted[0],
      focusArea: sorted[sorted.length - 1]
    };
  }, [analytics]);

  return (
    <div className="analytics-container">
      <Sidebar />
      <main className="analytics-main">
        <div className="analytics-content">
          
          <div className="header-row">
            <div className="header-left">
              <button onClick={() => navigate('/admin/dashboard')} className="back-btn">
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
              <h1 className="page-title">ADMIN ANALYTICS</h1>
              <p className="page-subtitle">Training performance and assessment insights</p>
            </div>
            <div className="header-actions">
              <button 
                onClick={fetchAnalytics}
                disabled={!selectedBatch || !selectedQuiz || loadingAnalytics}
                className="action-btn btn-refresh"
              >
                <RefreshCw size={16} className={loadingAnalytics ? "spin" : ""} />
                Refresh Data
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

          <div className="filter-panel">
            <div className="filter-item">
              <label>Training Programme</label>
              <div className="select-wrapper">
                <select 
                  value={selectedBatch} 
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  disabled={loadingBatches}
                  className="premium-select"
                >
                  <option value="">{loadingBatches ? 'Loading...' : 'Select Target Batch'}</option>
                  {batches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>
            </div>

            <div className="filter-item">
              <label>Organization</label>
              <div className="select-wrapper">
                <select 
                  value={selectedQuiz} 
                  onChange={(e) => setSelectedQuiz(e.target.value)}
                  disabled={!selectedBatch || loadingQuizzes || quizzes.length === 0}
                  className="premium-select"
                >
                  <option value="">
                    {!selectedBatch 
                      ? 'Awaiting selection...' 
                      : loadingQuizzes 
                        ? 'Loading...' 
                        : quizzes.length === 0 
                          ? 'No assessments' 
                          : 'Select Assessment'}
                  </option>
                  {quizzes.map(q => (
                    <option key={q._id} value={q._id}>{q.title}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-icon" />
              </div>
            </div>
          </div>

          {loadingAnalytics && (
            <div className="state-container">
              <div className="loader-spinner">
                <div className="loader-outer"></div>
                <div className="loader-inner"></div>
              </div>
              <p className="state-desc" style={{marginTop: '16px'}}>Retrieving analytics data...</p>
            </div>
          )}

          {!loadingAnalytics && !analytics && selectedBatch && selectedQuiz && (
            <div className="state-container fade-in">
              <div className="state-icon-bg">
                <AlertCircle size={32} color="#64748b" />
              </div>
              <h3 className="state-title">No Data Available</h3>
              <p className="state-desc">The analytics engine could not retrieve data for this selection. Verify assessment status.</p>
            </div>
          )}

          {!loadingAnalytics && analytics && analytics.attemptedStudents === 0 && (
            <div className="state-container fade-in">
              <div className="state-icon-bg">
                <Clock size={32} color="#64748b" />
              </div>
              <h3 className="state-title">Awaiting Submissions</h3>
              <p className="state-desc">The selected batch has not initiated this assessment. Metrics will populate once submissions begin.</p>
            </div>
          )}

          {!loadingAnalytics && analytics && analytics.attemptedStudents > 0 && (
            <div className="fade-in">
              
              <div className="kpi-grid">
                {[
                  { label: 'TOTAL COHORT', value: analytics.totalStudents },
                  { label: 'ATTEMPTED', value: analytics.attemptedStudents, subValue: `${analytics.completionRate}%` },
                  { label: 'PENDING', value: analytics.pendingStudents },
                  { label: 'AVERAGE SCORE', value: `${analytics.averageScore}%` },
                  { label: 'HIGHEST SCORE', value: `${analytics.highestScore}%` },
                ].map((kpi, idx) => (
                  <div key={idx} className="kpi-card interactive-kpi" onClick={() => handleKpiClick(['cohort', 'attempted', 'pending', 'average-score', 'highest-score'][idx])}>
                    <p className="kpi-label">{kpi.label}</p>
                    <div className="kpi-value-row">
                      <span className="kpi-value">{kpi.value}</span>
                      {kpi.subValue && <span className="kpi-subvalue">({kpi.subValue})</span>}
                    </div>
                    <div className="kpi-indicator"></div>
                  </div>
                ))}
              </div>

              <div className="summary-grid">
                <div className="summary-card">
                  <h3 className="section-title">Participation Rate</h3>
                  <div className="participation-content">
                    <div className="donut-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attemptData} cx="50%" cy="50%" innerRadius={35} outerRadius={48} paddingAngle={2} dataKey="value" stroke="none">
                            {attemptData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-center">{analytics.completionRate}%</div>
                    </div>
                    <div className="participation-stats">
                      <div className="stat-row">
                        <span className="stat-dot" style={{backgroundColor: '#8DC63F'}}></span>
                        <span className="stat-label">Attempted:</span>
                        <span className="stat-val">{analytics.attemptedStudents}</span>
                      </div>
                      <div className="stat-row">
                        <span className="stat-dot" style={{backgroundColor: '#94a3b8'}}></span>
                        <span className="stat-label">Pending:</span>
                        <span className="stat-val">{analytics.pendingStudents}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="summary-card">
                  <h3 className="section-title">Performance Snapshot</h3>
                  <div className="snapshot-stats">
                    <div className="snap-item">
                      <div className="snap-label">Average</div>
                      <div className="snap-value">{analytics.averageScore}%</div>
                    </div>
                    <div className="snap-item">
                      <div className="snap-label">Highest</div>
                      <div className="snap-value">{analytics.highestScore}%</div>
                    </div>
                    <div className="snap-item">
                      <div className="snap-label">Lowest</div>
                      <div className="snap-value">{lowestScore}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {analytics.sectionPerformance && analytics.sectionPerformance.length > 0 && (
                <>
                  <div className="section-panel">
                    <h2 className="section-title uppercase">TOPIC-WISE PERFORMANCE</h2>
                    <p className="section-subtitle">Cohort mastery and focus areas across individual assessment sections</p>
                    
                    <div className="topic-table">
                      <div className="topic-table-header">
                        <div className="col-topic">Topic</div>
                        <div className="col-accuracy">Accuracy</div>
                        <div className="col-correct">Correct / Questions</div>
                        <div className="col-status">Status</div>
                      </div>
                      {analytics.sectionPerformance.map((sec, sIdx) => {
                        const status = sec.accuracy >= 80 ? 'Strong' : sec.accuracy >= 60 ? 'Good' : 'Needs Attention';
                        const statusClass = status.replace(' ', '-').toLowerCase();
                        return (
                          <div className="topic-row" key={sIdx}>
                            <div className="col-topic">{sec.section}</div>
                            <div className="col-accuracy">
                              <div className="accuracy-val">{sec.accuracy}%</div>
                              <div className="progress-bar-bg">
                                <div className={`progress-bar-fill ${statusClass}`} style={{width: `${sec.accuracy}%`}}></div>
                              </div>
                            </div>
                            <div className="col-correct">{sec.correctCount} / {sec.totalCount}</div>
                            <div className="col-status">
                              <span className={`status-badge ${statusClass}`}>{status}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="section-panel">
                    <h2 className="section-title uppercase">TOPIC PERFORMANCE</h2>
                    <div className="horizontal-chart-container" style={{ height: `${Math.max(300, analytics.sectionPerformance.length * 40 + 40)}px` }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.sectionPerformance} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="section" type="category" axisLine={false} tickLine={false} tick={{ fill: '#0f172a', fontSize: 13, fontWeight: 500 }} width={120} />
                          <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={24}>
                            {analytics.sectionPerformance.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.accuracy >= 80 ? '#10b981' : entry.accuracy >= 60 ? '#8DC63F' : '#f59e0b'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {strongestArea && focusArea && (
                    <div className="section-panel insights-panel">
                      <h2 className="section-title uppercase">TRAINING INSIGHTS</h2>
                      <div className="insights-grid">
                        <div className="insight-item">
                          <div className="insight-label">Strongest Area</div>
                          <div className="insight-value">{strongestArea.section} — {strongestArea.accuracy}%</div>
                        </div>
                        <div className="insight-item">
                          <div className="insight-label">Focus Area</div>
                          <div className="insight-value">{focusArea.section} — {focusArea.accuracy}%</div>
                        </div>
                        <div className="insight-item">
                          <div className="insight-label">Overall Average</div>
                          <div className="insight-value">{analytics.averageScore}%</div>
                        </div>
                        <div className="insight-item">
                          <div className="insight-label">Recommended Focus</div>
                          <div className="insight-desc">Topics below 70% may require additional review.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Legacy tables styled to match */}
              <div className="section-panel">
                <h2 className="section-title uppercase">ITEM ANALYSIS</h2>
                <p className="section-subtitle">Detailed breakdown of question-level performance</p>
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
                          .filter(k => k !== 'NA' && q.options && q.options[k.charCodeAt(0) - 65] !== undefined)
                          .map((key, i) => {
                            const optIndex = key.charCodeAt(0) - 65;
                            const optText = q.options && q.options[optIndex] ? q.options[optIndex] : `Option ${key}`;
                            return {
                              name: `Opt ${key}`, 
                              fullname: `Option ${key}`, 
                              text: optText,
                              value: q.optionCounts[key], 
                              color: COLORS[i % COLORS.length]
                            };
                          });

                        return (
                          <React.Fragment key={idx}>
                            <tr className="table-row clickable" onClick={() => toggleRow(idx)}>
                              <td style={{textAlign: 'center'}} className="cell-secondary">{idx + 1}</td>
                              <td className="cell-primary" style={{maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                {q.question}
                              </td>
                              <td>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                  <span style={{fontFamily: 'monospace', fontWeight: '600', color: '#333', width: '40px', textAlign: 'right'}}>{q.accuracy}%</span>
                                  <div className="dist-bar-wrap" style={{flex: 1, backgroundColor: '#e2e8f0'}}>
                                    <div className="dist-bar-fill" style={{ width: `${q.accuracy}%`, backgroundColor: isPerfect ? '#10b981' : isWeak ? '#ef4444' : '#8DC63F' }}></div>
                                  </div>
                                </div>
                              </td>
                              <td style={{textAlign: 'center'}}>
                                {isWeak ? <span className="status-badge needs-attention">Critical</span> : 
                                 isPerfect ? <span className="status-badge strong">Mastered</span> : 
                                 <span className="status-badge good">Nominal</span>}
                              </td>
                              <td style={{textAlign: 'center'}}>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                  <span style={{fontSize: '0.75rem', color: '#64748b'}}>Ans: <span style={{color: '#10b981', fontWeight: '600'}}>{q.correctAnswer}</span></span>
                                  {q.mostSelected !== q.correctAnswer && q.mostSelected !== 'N/A' && (
                                    <span style={{fontSize: '0.65rem', color: '#ef4444', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px'}}>
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
                                                <div className="dist-item-left" style={{ maxWidth: '60%' }}>
                                                  <div className="dist-box">{opt.fullname.replace('Option ', '')}</div>
                                                  <span className={`dist-label ${isCorrect ? 'correct' : ''}`} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {isCorrect && <Check size={14} style={{ flexShrink: 0 }} />} 
                                                    {opt.text}
                                                  </span>
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
                                        </div>
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

              <div className="section-panel">
                <div className="table-header-row" style={{borderBottom: 'none'}}>
                  <div>
                    <h2 className="section-title uppercase">ASSESSMENT REPORT</h2>
                    <p className="section-subtitle">Individual performance records and submission timestamps</p>
                  </div>
                  <div className="table-controls">
                    <div className="control-input-wrap">
                      <Search className="control-icon" size={16} />
                      <input type="text" placeholder="Search report..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="control-input" />
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
                        <th>Candidate</th>
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
                                <span className="status-badge strong"><Check size={12} /> Passed</span> : 
                                <span className="status-badge needs-attention"><X size={12} /> Failed</span>
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
