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

// Premium Color Palette
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

  // Table filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PASS, FAIL

  // 1. Load batches on mount
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

  // 2. Load quizzes when a batch is selected
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

  // 3. Load analytics when both are selected
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

  // Filtered Student Table Data
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

  // Derived Chart Data
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
        <div className="bg-[#0f172a] border border-[#1e293b] p-3 rounded-lg shadow-xl shadow-black/50">
          <p className="text-[#94a3b8] text-xs font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-white text-sm font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }}></span>
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-300 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="p-8 max-w-[1600px] mx-auto min-h-full relative z-10">
          
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
            <div>
              <button 
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3 text-sm font-medium group"
              >
                <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                <Activity className="text-blue-500" size={32} />
                Intelligence Hub
              </h1>
              <p className="text-slate-400 mt-2 text-sm max-w-2xl">
                Real-time assessment analytics and batch performance metrics.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={fetchAnalytics}
                disabled={!selectedBatch || !selectedQuiz || loadingAnalytics}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0f172a] border border-[#1e293b] text-slate-300 rounded-lg hover:bg-[#1e293b] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <RefreshCw size={16} className={loadingAnalytics ? "animate-spin" : ""} />
                Refresh
              </button>
              <button 
                disabled={!analytics || analytics.attemptedStudents === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none text-sm font-medium"
              >
                <Download size={16} />
                Export Report
              </button>
            </div>
          </div>
      
          {/* Sticky Filter Bar */}
          <div className="sticky top-0 z-40 bg-[#020617]/80 backdrop-blur-xl border border-[#1e293b] p-4 rounded-2xl mb-8 shadow-2xl flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Users size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <select 
                value={selectedBatch} 
                onChange={(e) => setSelectedBatch(e.target.value)}
                disabled={loadingBatches}
                className="w-full bg-[#0f172a] border border-[#1e293b] text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-11 p-3.5 transition-all outline-none appearance-none disabled:opacity-50"
              >
                <option value="" className="text-slate-500">{loadingBatches ? 'Loading workspace...' : 'Select Target Batch'}</option>
                {batches.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-slate-500" />
              </div>
            </div>

            <div className="flex-1 relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <FileText size={16} className="text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <select 
                value={selectedQuiz} 
                onChange={(e) => setSelectedQuiz(e.target.value)}
                disabled={!selectedBatch || loadingQuizzes || quizzes.length === 0}
                className="w-full bg-[#0f172a] border border-[#1e293b] text-white text-sm rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 block pl-11 p-3.5 transition-all outline-none appearance-none disabled:opacity-50"
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
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <ChevronDown size={16} className="text-slate-500" />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingAnalytics && (
            <div className="flex flex-col justify-center items-center py-32 space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin opacity-70"></div>
              </div>
              <p className="text-slate-400 font-medium tracking-wide animate-pulse">Aggregating Intelligence...</p>
            </div>
          )}

          {/* Empty States */}
          {!loadingAnalytics && !analytics && selectedBatch && selectedQuiz && (
            <div className="flex flex-col items-center justify-center py-24 px-4 bg-[#0f172a] border border-[#1e293b] rounded-3xl shadow-lg">
              <AlertCircle size={48} className="text-slate-600 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">No Data Signals Detected</h3>
              <p className="text-slate-400 max-w-md text-center">
                The analytics engine could not retrieve data for this selection. Verify assessment status.
              </p>
            </div>
          )}

          {!loadingAnalytics && analytics && analytics.attemptedStudents === 0 && (
            <div className="flex flex-col items-center justify-center py-24 px-4 bg-[#0f172a] border border-[#1e293b] rounded-3xl shadow-lg">
              <div className="w-20 h-20 bg-[#1e293b] rounded-full flex items-center justify-center mb-6">
                <Clock size={32} className="text-slate-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Awaiting Submissions</h3>
              <p className="text-slate-400 max-w-md text-center leading-relaxed">
                The selected batch has not initiated this assessment. Metrics will populate in real-time as submissions stream in.
              </p>
            </div>
          )}

          {/* Main Analytics Dashboard */}
          {!loadingAnalytics && analytics && analytics.attemptedStudents > 0 && (
            <div className="space-y-8 animate-fade-in pb-12">
              
              {/* Executive KPI Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  { label: 'Total Cohort', value: analytics.totalStudents, icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { label: 'Attempted', value: analytics.attemptedStudents, subValue: `${analytics.completionRate}%`, icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                  { label: 'Pending', value: analytics.pendingStudents, icon: Clock, color: 'text-slate-400', bg: 'bg-slate-400/10' },
                  { label: 'Avg Score', value: `${analytics.averageScore}%`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                  { label: 'Pass Rate', value: `${analytics.passPercentage}%`, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Highest Score', value: `${analytics.highestScore}%`, icon: Award, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                ].map((kpi, idx) => (
                  <div key={idx} className="bg-[#0f172a] border border-[#1e293b] p-5 rounded-2xl shadow-lg hover:border-slate-700 transition-colors group relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <kpi.icon size={48} className={kpi.color} />
                    </div>
                    <div className="relative z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${kpi.bg}`}>
                        <kpi.icon size={20} className={kpi.color} />
                      </div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{kpi.label}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-white">{kpi.value}</p>
                        {kpi.subValue && <span className="text-sm font-medium text-slate-400">({kpi.subValue})</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced Charting Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Performance Distribution */}
                <div className="lg:col-span-2 bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl shadow-lg">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-lg font-bold text-white">Score Distribution Trajectory</h2>
                      <p className="text-sm text-slate-400 mt-1">Individual performance across the assessment lifecycle</p>
                    </div>
                    <div className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-semibold flex items-center gap-1">
                      <TrendingUp size={12} /> Live
                    </div>
                  </div>
                  
                  <div className="h-[350px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.studentScores} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                        <XAxis 
                          dataKey="name" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          dy={10}
                          tickFormatter={(val) => val.split(' ')[0]}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          domain={[0, 100]}
                          tickFormatter={(val) => `${val}%`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          name="Score"
                          stroke={CHART_COLORS.primary} 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorScore)" 
                          activeDot={{ r: 6, strokeWidth: 0, fill: '#60a5fa' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Status Widgets */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Pass/Fail Widget */}
                  <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl shadow-lg flex flex-col">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 tracking-wide uppercase">Outcome Matrix</h3>
                    <div className="flex-1 flex items-center justify-between">
                      <div className="w-32 h-32 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={passFailData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                            >
                              {passFailData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-white">{analytics.passPercentage}%</span>
                        </div>
                      </div>
                      <div className="space-y-4 flex-1 pl-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <span className="text-slate-300">Passed</span>
                          </div>
                          <span className="font-bold text-white">{analytics.passCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full bg-red-500"></span>
                            <span className="text-slate-300">Failed</span>
                          </div>
                          <span className="font-bold text-white">{analytics.failCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Completion Widget */}
                  <div className="bg-[#0f172a] border border-[#1e293b] p-6 rounded-2xl shadow-lg flex flex-col">
                    <h3 className="text-sm font-bold text-slate-300 mb-4 tracking-wide uppercase">Cohort Engagement</h3>
                    <div className="flex-1 flex items-center justify-between">
                      <div className="w-32 h-32 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={attemptData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={60}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                            >
                              {attemptData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-xl font-bold text-white">{analytics.completionRate}%</span>
                        </div>
                      </div>
                      <div className="space-y-4 flex-1 pl-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <span className="text-slate-300">Attempted</span>
                          </div>
                          <span className="font-bold text-white">{analytics.attemptedStudents}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full bg-slate-500"></span>
                            <span className="text-slate-300">Pending</span>
                          </div>
                          <span className="font-bold text-white">{analytics.pendingStudents}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Level Diagnostics */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-lg overflow-hidden">
                <div className="p-6 border-b border-[#1e293b] flex items-center justify-between bg-gradient-to-r from-[#0f172a] to-[#162032]">
                  <div>
                    <h2 className="text-xl font-bold text-white">Item Analysis Matrix</h2>
                    <p className="text-sm text-slate-400 mt-1">Detailed breakdown of question-level performance</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#162032] text-xs uppercase text-slate-400 font-semibold tracking-wider">
                      <tr>
                        <th className="px-6 py-4 w-12 text-center">#</th>
                        <th className="px-6 py-4">Question Parameter</th>
                        <th className="px-6 py-4 w-48">Accuracy Rate</th>
                        <th className="px-6 py-4 text-center w-32">Status</th>
                        <th className="px-6 py-4 text-center w-32">Variance</th>
                        <th className="px-6 py-4 text-right w-24">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]">
                      {analytics.questions.map((q, idx) => {
                        const isWeak = q.accuracy < 50;
                        const isPerfect = q.accuracy === 100;
                        
                        // Prepare chart data
                        const optionData = Object.keys(q.optionCounts)
                          .filter(k => k !== 'NA' && q.optionCounts[k] > 0)
                          .map((key, i) => ({
                            name: `Opt ${key}`,
                            fullname: `Option ${key}`,
                            value: q.optionCounts[key],
                            color: COLORS[i % COLORS.length]
                          }));

                        return (
                          <React.Fragment key={idx}>
                            <tr className="hover:bg-[#162032] transition-colors group cursor-pointer" onClick={() => toggleRow(idx)}>
                              <td className="px-6 py-4 text-center font-mono text-slate-500">{idx + 1}</td>
                              <td className="px-6 py-4 text-slate-200 font-medium truncate max-w-md">
                                {q.question}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-white w-10 text-right">{q.accuracy}%</span>
                                  <div className="flex-1 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full ${isPerfect ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : isWeak ? 'bg-red-500' : 'bg-blue-500'}`}
                                      style={{ width: `${q.accuracy}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                {isWeak ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wide">
                                    Critical
                                  </span>
                                ) : isPerfect ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                                    Mastered
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                                    Nominal
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <div className="flex flex-col items-center">
                                  <span className="text-xs text-slate-500">Ans: <span className="text-emerald-400 font-bold">{q.correctAnswer}</span></span>
                                  {q.mostSelected !== q.correctAnswer && q.mostSelected !== 'N/A' && (
                                    <span className="text-[10px] text-red-400 mt-0.5 flex items-center gap-1">
                                      <ArrowUpRight size={10} /> Shifted to {q.mostSelected}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className={`p-1.5 rounded-lg inline-flex items-center justify-center transition-colors ${expandedRow === idx ? 'bg-blue-500/20 text-blue-400' : 'bg-[#1e293b] text-slate-400 group-hover:text-white'}`}>
                                  {expandedRow === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                              </td>
                            </tr>

                            {/* Drill-down Analytics */}
                            {expandedRow === idx && (
                              <tr className="bg-[#0b1121] border-y border-[#1e293b]">
                                <td colSpan="6" className="p-0">
                                  <div className="p-8 animate-fade-in">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                      {/* Distribution Info */}
                                      <div className="space-y-6">
                                        <div>
                                          <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-[#1e293b] pb-2">Response Distribution</h4>
                                          <div className="space-y-3">
                                            {optionData.map((opt, i) => {
                                              const isCorrect = opt.fullname.replace('Option ', '') === q.correctAnswer;
                                              const pct = ((opt.value / analytics.attemptedStudents) * 100).toFixed(1);
                                              return (
                                                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                                                  <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner" style={{ backgroundColor: `${opt.color}20`, color: opt.color }}>
                                                      {opt.fullname.replace('Option ', '')}
                                                    </div>
                                                    <span className={`font-medium text-sm ${isCorrect ? 'text-emerald-400 flex items-center gap-1' : 'text-slate-300'}`}>
                                                      {isCorrect && <Check size={14} />} Selected
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-4">
                                                    <div className="w-24 h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: opt.color }}></div>
                                                    </div>
                                                    <span className="font-mono text-white text-sm w-12 text-right">{pct}%</span>
                                                    <span className="text-slate-500 text-xs w-8 text-right">({opt.value})</span>
                                                  </div>
                                                </div>
                                              )
                                            })}
                                            {q.optionCounts['NA'] > 0 && (
                                              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] border border-[#1e293b] border-dashed">
                                                <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs bg-slate-800 text-slate-400">
                                                    --
                                                  </div>
                                                  <span className="font-medium text-sm text-slate-400">Unattempted</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                  <span className="font-mono text-slate-300 text-sm">{((q.optionCounts['NA'] / analytics.attemptedStudents) * 100).toFixed(1)}%</span>
                                                  <span className="text-slate-500 text-xs w-8 text-right">({q.optionCounts['NA']})</span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Chart Visualization */}
                                      <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 flex flex-col items-center justify-center relative min-h-[300px]">
                                        <h4 className="absolute top-6 left-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Visual Hierarchy</h4>
                                        {optionData.length > 0 ? (
                                          <div className="w-full h-full pt-8">
                                            <ResponsiveContainer width="100%" height="100%">
                                              <BarChart data={optionData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                                                <Tooltip 
                                                  cursor={{ fill: '#1e293b' }} 
                                                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                                  itemStyle={{ color: '#fff' }}
                                                />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                                                  {optionData.map((entry, i) => (
                                                    <Cell key={`cell-${i}`} fill={entry.color} />
                                                  ))}
                                                </Bar>
                                              </BarChart>
                                            </ResponsiveContainer>
                                          </div>
                                        ) : (
                                          <p className="text-slate-500 text-sm">Insufficient data for visualization</p>
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

              {/* Enterprise Data Table */}
              <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl shadow-lg overflow-hidden flex flex-col">
                {/* Table Header & Controls */}
                <div className="p-6 border-b border-[#1e293b] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#0f172a] to-[#162032]">
                  <div>
                    <h2 className="text-xl font-bold text-white">Student Roster Metrics</h2>
                    <p className="text-sm text-slate-400 mt-1">Individual performance records and submission timestamps</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search roster..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-[#162032] border border-[#1e293b] text-sm text-white rounded-lg pl-9 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-full md:w-64 transition-all placeholder:text-slate-600"
                      />
                    </div>
                    
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-[#162032] border border-[#1e293b] text-sm text-white rounded-lg pl-9 pr-8 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                      >
                        <option value="ALL">All Status</option>
                        <option value="PASS">Passed Only</option>
                        <option value="FAIL">Failed Only</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Scrollable Table Content */}
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar relative">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-[#162032] sticky top-0 z-10 text-xs uppercase text-slate-400 font-semibold tracking-wider shadow-sm">
                      <tr>
                        <th className="px-6 py-4">Identity</th>
                        <th className="px-6 py-4">Score</th>
                        <th className="px-6 py-4 text-center">Correct</th>
                        <th className="px-6 py-4 text-center">Incorrect</th>
                        <th className="px-6 py-4">Outcome</th>
                        <th className="px-6 py-4 text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((student, idx) => (
                          <tr key={idx} className="hover:bg-[#162032]/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{student.name}</div>
                              <div className="text-xs text-slate-500 mt-1 font-mono">{student.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold text-lg ${student.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {student.percentage}%
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 items-center justify-center font-bold text-xs">
                                {student.correct}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex w-8 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 items-center justify-center font-bold text-xs">
                                {student.wrong}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {student.passed ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                                  <Check size={12} /> Certified
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wide">
                                  <X size={12} /> Failed
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs text-slate-400 font-mono">
                                {new Date(student.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1 uppercase">
                                {new Date(student.submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute:'2-digit' })}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-500">
                              <Search size={32} className="mb-3 opacity-50" />
                              <p className="text-sm font-medium">No records match your criteria.</p>
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

      {/* Global Custom Scrollbar Styles embedded */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #020617; 
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b; 
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155; 
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
