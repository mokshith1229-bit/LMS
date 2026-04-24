import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import CourseCard from '../../components/CourseCard';
import { BookOpen, Users, ClipboardCheck, Plus, TrendingUp, UserPlus, BarChart2 } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, totalSubmissions: 0 });
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsRes, coursesRes] = await Promise.all([
        api.get('/courses/admin/stats'),
        api.get('/courses'),
      ]);
      setStats(statsRes.data.stats);
      setCourses(coursesRes.data.courses);
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
            <img src="/assets/cube_tech_logo.png" alt="Cube Highways Logo" style={{ height: 45, objectFit: 'contain' }} />
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
      </main>
    </div>
  );
}
