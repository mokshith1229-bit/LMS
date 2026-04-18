import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import CourseCard from '../../components/CourseCard';
import { BookOpen, Search } from 'lucide-react';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/courses')
      .then(({ data }) => setCourses(data.courses))
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="simulation-banner fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1>Welcome {user?.name} 👋</h1>
              <p>Explore assessment modules and track your progress.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 60 }}>
              <img src="/assets/cube_tech_logo.png" alt="Cube Highways Logo" style={{ height: 45, objectFit: 'contain' }} />
            </div>
          </div>
        </div>


        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 420, marginBottom: 28 }} className="fade-in">
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="course-search"
            className="form-input"
            style={{ paddingLeft: 40 }}
            placeholder="Search courses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state card">
            <BookOpen size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
            <h3>{search ? 'No courses match your search' : 'No courses available'}</h3>
            <p>{search ? 'Try a different search term' : 'Check back soon for new content'}</p>
          </div>
        ) : (
          <div className="courses-grid fade-in">
            {filtered.map((course, i) => (
              <CourseCard key={course._id} course={course} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
