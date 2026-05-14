import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, Award, CheckCircle, ChevronDown, ChevronUp, ArrowLeft, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

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
      setSelectedQuiz(''); // Reset quiz selection
      setAnalytics(null);  // Clear previous analytics
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

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="p-8 bg-transparent min-h-screen font-sans">
          <div className="max-w-7xl mx-auto">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '1.5rem', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
              onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
              onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
            >
              <ArrowLeft size={18} />
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-semibold text-gray-900 mb-8 tracking-tight">Batch Analytics</h1>
        
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Batch</label>
                <select 
                  value={selectedBatch} 
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  disabled={loadingBatches}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors disabled:bg-gray-100"
                >
                  <option value="">{loadingBatches ? 'Loading batches...' : '-- Choose Batch --'}</option>
                  {batches.map(b => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">2. Select Assessment</label>
                <select 
                  value={selectedQuiz} 
                  onChange={(e) => setSelectedQuiz(e.target.value)}
                  disabled={!selectedBatch || loadingQuizzes || quizzes.length === 0}
                  className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors disabled:bg-gray-100"
                >
                  <option value="">
                    {!selectedBatch 
                      ? 'Select a batch first' 
                      : loadingQuizzes 
                        ? 'Loading assessments...' 
                        : quizzes.length === 0 
                          ? 'No assessments assigned' 
                          : '-- Choose Assessment --'}
                  </option>
                  {quizzes.map(q => (
                    <option key={q._id} value={q._id}>{q.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {loadingAnalytics && (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {!loadingAnalytics && !analytics && selectedBatch && selectedQuiz && (
               <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center">
                 <AlertCircle size={40} className="text-gray-400 mb-3" />
                 <p className="text-lg font-medium text-gray-600">No analytics data available.</p>
                 <p className="text-sm">There might be an issue fetching the data.</p>
               </div>
            )}

            {!loadingAnalytics && analytics && analytics.attemptedStudents === 0 && (
               <div className="text-center text-gray-500 py-16 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center">
                 <Clock size={48} className="text-gray-400 mb-4" />
                 <h3 className="text-xl font-semibold text-gray-700 mb-2">No attempts yet</h3>
                 <p className="text-sm max-w-md">Students in this batch have not started or completed this assessment. Check back later for analytics.</p>
               </div>
            )}

            {!loadingAnalytics && analytics && analytics.attemptedStudents > 0 && (
              <div className="space-y-8 animate-fade-in">
                {/* Top Metrics Cards - Row 1 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Students</p>
                      <p className="text-xl font-bold text-[#0A1128]">{analytics.totalStudents}</p>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Attempted</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-xl font-bold text-[#0A1128]">{analytics.attemptedStudents}</p>
                        <p className="text-xs text-gray-500">({analytics.completionRate}%)</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pending</p>
                      <p className="text-xl font-bold text-[#0A1128]">{analytics.pendingStudents}</p>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Activity size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Score</p>
                      <p className="text-xl font-bold text-[#0A1128]">{analytics.averageScore}%</p>
                    </div>
                  </div>
                </div>

                {/* Top Metrics Cards - Row 2 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Pass Rate</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-green-600">{analytics.passPercentage}%</p>
                      <span className="text-xs text-gray-500">({analytics.passCount} passed)</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Fail Rate</p>
                    <div className="flex items-center gap-2">
                      <p className="text-2xl font-bold text-red-600">{analytics.failPercentage}%</p>
                      <span className="text-xs text-gray-500">({analytics.failCount} failed)</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Highest Score</p>
                    <p className="text-2xl font-bold text-[#0A1128]">{analytics.highestScore}%</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Lowest Score</p>
                    <p className="text-2xl font-bold text-[#0A1128]">{analytics.lowestScore}%</p>
                  </div>
                </div>

                {/* AI Insights Section */}
                <div className="bg-[#f8fafc] p-6 rounded-xl border border-blue-100 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1e3a8a] mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={16} /> Key Insights
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Most Difficult Question</p>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">
                        {analytics.questions?.length > 0 
                          ? analytics.questions.reduce((prev, curr) => (prev.accuracy < curr.accuracy ? prev : curr)).question 
                          : 'N/A'}
                      </p>
                      {analytics.questions?.length > 0 && (
                        <p className="text-xs text-red-600 font-bold mt-2">
                          {analytics.questions.reduce((prev, curr) => (prev.accuracy < curr.accuracy ? prev : curr)).accuracy}% Accuracy
                        </p>
                      )}
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Overall Class Performance</p>
                      <p className="text-lg font-bold" style={{
                        color: analytics.averageScore >= 80 ? '#16a34a' : analytics.averageScore >= 60 ? '#ca8a04' : '#dc2626'
                      }}>
                        {analytics.averageScore >= 80 ? 'Excellent' : analytics.averageScore >= 60 ? 'Good / Satisfactory' : 'Needs Improvement'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Based on the average score of {analytics.averageScore}%</p>
                    </div>
                  </div>
                </div>

                {/* Student Insights Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-900">Student Insights</h2>
                    <span className="text-sm text-gray-500">{analytics.studentTable?.length || 0} Attempts</span>
                  </div>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-gray-600 relative">
                      <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs uppercase text-gray-500 font-medium">
                        <tr>
                          <th className="px-6 py-4">Student</th>
                          <th className="px-6 py-4">Score</th>
                          <th className="px-6 py-4 text-center">Correct</th>
                          <th className="px-6 py-4 text-center">Wrong</th>
                          <th className="px-6 py-4">Result</th>
                          <th className="px-6 py-4">Submitted At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {analytics.studentTable?.map((student, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{student.name}</div>
                              <div className="text-xs text-gray-400 mt-0.5">{student.email}</div>
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              {student.percentage}%
                            </td>
                            <td className="px-6 py-4 text-center text-green-600 font-medium">{student.correct}</td>
                            <td className="px-6 py-4 text-center text-red-500 font-medium">{student.wrong}</td>
                            <td className="px-6 py-4">
                              {student.passed ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Fail
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(student.submittedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Question Analytics Table */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-900">Question Analysis</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-white text-xs uppercase text-gray-500 font-medium">
                        <tr>
                          <th className="px-6 py-4">Question</th>
                          <th className="px-6 py-4">Accuracy</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-center">Correct Answer</th>
                          <th className="px-6 py-4 text-center">Most Selected</th>
                          <th className="px-6 py-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {analytics.questions.map((q, idx) => {
                          const isWeak = q.accuracy < 50;
                          
                          // Prepare pie data
                          const pieData = Object.keys(q.optionCounts)
                            .filter(key => key !== 'NA' && q.optionCounts[key] > 0)
                            .map(key => ({
                              name: `Option ${key}`,
                              value: q.optionCounts[key]
                            }));
                            
                          const unattempted = q.optionCounts['NA'] || 0;
                          if (unattempted > 0) {
                            pieData.push({ name: 'Unattempted', value: unattempted });
                          }

                          return (
                            <React.Fragment key={idx}>
                              <tr className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4 max-w-md truncate font-medium text-gray-900" title={q.question}>
                                  {idx + 1}. {q.question}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center space-x-2 w-32">
                                    <span className="font-semibold text-gray-900 w-10">{q.accuracy}%</span>
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${isWeak ? 'bg-red-500' : 'bg-green-500'}`} 
                                        style={{ width: `${q.accuracy}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  {isWeak ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      Weak
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      Good
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 font-semibold text-gray-900 text-center">
                                  {q.correctAnswer}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`font-semibold ${q.mostSelected === q.correctAnswer ? 'text-green-600' : 'text-red-500'}`}>
                                    {q.mostSelected}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <button 
                                    onClick={() => toggleRow(idx)}
                                    className="text-gray-400 hover:text-blue-600 transition-colors focus:outline-none"
                                  >
                                    {expandedRow === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                  </button>
                                </td>
                              </tr>
                              
                              {/* Expanded Row for Pie Chart */}
                              {expandedRow === idx && (
                                <tr className="bg-gray-50/80">
                                  <td colSpan="6" className="px-6 py-6">
                                    <div className="flex flex-col md:flex-row items-center justify-between max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                                      <div className="flex-1 min-w-[300px]">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4">Option Distribution</h4>
                                        <div className="space-y-3">
                                          {pieData.length > 0 ? pieData.map((entry, i) => {
                                            const isCorrect = entry.name.replace('Option ', '') === q.correctAnswer;
                                            return (
                                              <div key={i} className="flex items-center justify-between text-sm">
                                                <div className="flex items-center space-x-3">
                                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                                  <span className={`font-medium ${isCorrect ? 'text-green-600' : 'text-gray-600'}`}>
                                                    {entry.name} {isCorrect && '(Correct)'}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div 
                                                      className="h-full rounded-full" 
                                                      style={{ 
                                                        backgroundColor: COLORS[i % COLORS.length],
                                                        width: `${(entry.value / analytics.attemptedStudents) * 100}%` 
                                                      }}
                                                    ></div>
                                                  </div>
                                                  <span className="font-semibold text-gray-900 w-8 text-right">{entry.value}</span>
                                                </div>
                                              </div>
                                            );
                                          }) : (
                                            <p className="text-sm text-gray-500">No data available.</p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      <div className="w-64 h-64 mt-6 md:mt-0 md:ml-8">
                                        {pieData.length > 0 && (
                                          <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                              <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={65}
                                                outerRadius={85}
                                                paddingAngle={2}
                                                dataKey="value"
                                                stroke="none"
                                              >
                                                {pieData.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                              </Pie>
                                              <Tooltip 
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                                formatter={(value, name) => [value, name]}
                                              />
                                            </PieChart>
                                          </ResponsiveContainer>
                                        )}
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

                {/* Performance Chart */}
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Score Distribution</h2>
                  {analytics.studentScores && analytics.studentScores.length > 0 ? (
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.studentScores} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            domain={[0, 100]}
                            tickFormatter={(val) => `${val}%`}
                          />
                          <Tooltip 
                            cursor={{ fill: '#F3F4F6' }}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value) => [`${value}%`, 'Score']}
                          />
                          <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40}>
                            {analytics.studentScores.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.score >= 60 ? '#10B981' : '#EF4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
