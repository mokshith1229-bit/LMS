import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, Award, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ff6b6b'];

export default function AdminAnalytics() {
  const [batches, setBatches] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState('');
  
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);

  useEffect(() => {
    fetchFilters();
  }, []);

  const fetchFilters = async () => {
    try {
      const token = localStorage.getItem('token');
      const [batchRes, quizRes] = await Promise.all([
        axios.get('http://localhost:5000/api/batch', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/quiz', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      setBatches(batchRes.data.batches || []);
      setQuizzes(batchRes.data.quizzes || quizRes.data || []); 
    } catch (error) {
      toast.error('Failed to load filters');
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedBatch || !selectedQuiz) return;
    
    setLoading(true);
    setAnalytics(null);
    setExpandedRow(null);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/admin/analytics?batchId=${selectedBatch}&quizId=${selectedQuiz}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(res.data.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedBatch, selectedQuiz]);

  const toggleRow = (index) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  return (
    <div className="p-8 bg-white min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-8 tracking-tight">Admin Analytics</h1>
        
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Batch</label>
            <select 
              value={selectedBatch} 
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors"
            >
              <option value="">-- Choose Batch --</option>
              {batches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Quiz</label>
            <select 
              value={selectedQuiz} 
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 transition-colors"
            >
              <option value="">-- Choose Quiz --</option>
              {quizzes.map(q => (
                <option key={q._id} value={q._id}>{q.title}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {!loading && analytics && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Students</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.totalStudents}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-green-50 text-green-600 rounded-lg">
                  <Activity size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.averageScore}%</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.completionRate}%</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
                  <Award size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Highest Score</p>
                  <p className="text-2xl font-bold text-gray-900">{analytics.highestScore}%</p>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Student Performance</h2>
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
                      />
                      <Bar dataKey="score" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg">
                  No submissions yet.
                </div>
              )}
            </div>

            {/* Question Analytics Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Question Analytics</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Question</th>
                      <th className="px-6 py-4">Accuracy</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Correct Answer</th>
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
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-900">{q.accuracy}%</span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
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
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              {q.correctAnswer}
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
                            <tr className="bg-gray-50">
                              <td colSpan="5" className="px-6 py-6">
                                <div className="flex flex-col md:flex-row items-center justify-between max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                                  <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-gray-900 mb-4">Option Distribution</h4>
                                    <div className="space-y-2">
                                      {pieData.length > 0 ? pieData.map((entry, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                            <span className="text-gray-600">{entry.name}</span>
                                          </div>
                                          <span className="font-semibold text-gray-900">{entry.value}</span>
                                        </div>
                                      )) : (
                                        <p className="text-sm text-gray-500">No data available.</p>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <div className="w-64 h-64">
                                    {pieData.length > 0 && (
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                          >
                                            {pieData.map((entry, index) => (
                                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                          </Pie>
                                          <Tooltip 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
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
            
          </div>
        )}
        
        {!loading && !analytics && selectedBatch && selectedQuiz && (
           <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-xl">
             No analytics data found for this selection.
           </div>
        )}

      </div>
    </div>
  );
}
