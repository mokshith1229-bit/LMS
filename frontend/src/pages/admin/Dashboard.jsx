import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import CourseCard from '../../components/CourseCard';
import { BookOpen, Users, ClipboardCheck, Plus, TrendingUp, UserPlus, BarChart2, Filter, Clock, Award } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, totalSubmissions: 0 });
  const [courses, setCourses] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsRes, coursesRes, quizzesRes] = await Promise.all([
        api.get('/courses/admin/stats'),
        api.get('/courses'),
        api.get('/quiz')
      ]);
      setStats(statsRes.data.stats);
      setCourses(coursesRes.data.courses);
      setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : quizzesRes.data.quizzes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteCourse = async (id) => {
    try {
      await api.delete(`/courses/${id}`);
      setCourses(courses.filter(c => c._id !== id));
      // Refresh stats to reflect the change
      const statsRes = await api.get('/courses/admin/stats');
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Failed to delete course', err);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Admin Dashboard</h1>
            <p>Manage courses, students, and assessment data.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/assets/minds_logo.png" alt="Logo" style={{ height: 45, objectFit: 'contain' }} />
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-item">
            <BookOpen className="stat-item-icon" size={20} />
            <span className="stat-item-val">{stats.totalCourses}</span>
            <span className="stat-item-lbl">Total Courses</span>
          </div>
          <div className="stat-item">
            <Users className="stat-item-icon" size={20} />
            <span className="stat-item-val">{stats.totalStudents}</span>
            <span className="stat-item-lbl">Total Students</span>
          </div>
          <div className="stat-item">
            <ClipboardCheck className="stat-item-icon" size={20} />
            <span className="stat-item-val">{stats.totalSubmissions}</span>
            <span className="stat-item-lbl">Total Submissions</span>
          </div>
          <div className="stat-item">
            <TrendingUp className="stat-item-icon" size={20} />
            <span className="stat-item-val">
              {stats.totalCourses > 0 ? Math.round((stats.totalSubmissions / Math.max(stats.totalStudents, 1)) * 100 || 0) : 0}%
            </span>
            <span className="stat-item-lbl">Completion Rate</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card mb-32">
          <div className="flex-between mb-20">
            <h2 className="title-sm">Quick Actions</h2>
          </div>
          <div className="flex gap-12 wrap">
            <Link to="/admin/create-course" className="btn btn-primary">
              <Plus size={16} /> New Course
            </Link>
            <Link to="/admin/upload" className="btn btn-secondary">
              <BookOpen size={16} /> Upload Content
            </Link>
            <Link to="/admin/add-quiz" className="btn btn-secondary">
              <ClipboardCheck size={16} /> Add Quiz
            </Link>
            <Link to="/admin/assign" className="btn btn-secondary">
              <UserPlus size={16} /> Assign Quiz
            </Link>
            <Link to="/admin/results" className="btn btn-secondary">
              <BarChart2 size={16} /> View Results
            </Link>
          </div>
        </div>


        {/* Courses */}
        <div className="page-header fade-in" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>All Courses</h2>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : courses.length === 0 ? (
          <div className="empty-state card">
            <BookOpen size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3>No courses yet</h3>
            <p>Create your first course to get started</p>
            <Link to="/admin/create-course" className="btn btn-primary" style={{ marginTop: 16 }}>
              <Plus size={16} /> Create Course
            </Link>
          </div>
        ) : (
          <div className="courses-grid">
            {courses.map((course, _i) => (
              <CourseCard key={course._id} course={course} index={_i} onDelete={handleDeleteCourse} />
            ))}
          </div>
        )}

        {/* Assessments & Quizzes */}
        <div className="page-header fade-in" style={{ marginTop: 40, marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Active Quizzes & Assessments</h2>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : quizzes.length === 0 ? (
          <div className="empty-state card">
            <ClipboardCheck size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3>No quizzes yet</h3>
            <p>Create your first quiz to get started</p>
            <Link to="/admin/add-quiz" className="btn btn-primary" style={{ marginTop: 16 }}>
              <Plus size={16} /> Add Quiz
            </Link>
          </div>
        ) : (
          <div className="courses-grid mb-32" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {quizzes.map((quiz) => (
              <div 
                key={quiz._id} 
                className="card" 
                style={{ 
                  padding: 24, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  minHeight: 200,
                  position: 'relative',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = '#93c5fd';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 600, 
                      color: '#4f46e5', 
                      background: '#e0e7ff', 
                      padding: '4px 10px', 
                      borderRadius: 12 
                    }}>
                      {quiz.courseId?.title || 'General'}
                    </span>
                    {quiz.questionsPerStudent && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        color: '#0891b2', 
                        background: '#ecfeff', 
                        padding: '4px 10px', 
                        borderRadius: 12 
                      }}>
                        Randomized
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginBottom: 8, lineHeight: 1.4 }}>
                    {quiz.title}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#64748b' }}>
                      <ClipboardCheck size={14} />
                      <span>{quiz.questions?.length || 0} Questions</span>
                    </div>
                    {quiz.timeLimitMinutes && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#64748b' }}>
                        <Clock size={14} />
                        <span>{quiz.timeLimitMinutes} mins</span>
                      </div>
                    )}
                    {quiz.passingScore && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: '#64748b' }}>
                        <Award size={14} />
                        <span>{quiz.passingScore}% Pass</span>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Link 
                    to={`/admin/question-bank?quizId=${quiz._id}`} 
                    className="btn btn-secondary"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: '0.8rem', 
                      fontWeight: 600, 
                      padding: '6px 14px',
                      borderRadius: 8,
                      margin: 0
                    }}
                  >
                    <Filter size={12} />
                    Filter Questions
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
