import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Users, ChevronRight, Trash2 } from 'lucide-react';

const EMOJIS = ['🚀', '🎯', '💡', '🔬', '🎨', '📊', '🧠', '⚡', '🌐', '🛠️'];

export default function CourseCard({ course, _index = 0, onDelete }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleClick = (e) => {
    if (user?.role === 'admin') return;
    navigate(`/student/courses/${course._id}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${course.title}"?`)) {
      onDelete(course._id);
    }
  };

  return (
    <div className="course-card" onClick={handleClick}>
      <div className="course-card-thumb">
        <BookOpen size={48} strokeWidth={1.5} opacity={0.8} />
        {user?.role === 'admin' && (
          <button
            className="delete-card-btn"
            onClick={handleDelete}
            title="Delete Course"
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'rgba(239, 68, 68, 0.09)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: 6,
              borderRadius: 6,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
              e.currentTarget.style.color = '#dc2626';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.09)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#ef4444';
            }}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="course-card-body">
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-desc">{course.description}</p>
      </div>
      <div className="course-card-footer">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="course-card-meta">
            <BookOpen size={14} />
            {course.modules?.length || 0}
          </span>
          <span className="course-card-meta">
            <Users size={14} />
            {course.enrolledStudents?.length || 0}
          </span>
        </div>
        {user?.role === 'student' && (
          <button className="btn btn-action-sm">
            Open Assessment
          </button>
        )}
      </div>
    </div>
  );
}
