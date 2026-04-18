import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Users, ChevronRight } from 'lucide-react';

const EMOJIS = ['🚀', '🎯', '💡', '🔬', '🎨', '📊', '🧠', '⚡', '🌐', '🛠️'];

export default function CourseCard({ course, index = 0 }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const emoji = EMOJIS[index % EMOJIS.length];

  const handleClick = () => {
    if (user?.role === 'admin') return;
    navigate(`/student/courses/${course._id}`);
  };

  return (
    <div className="course-card" onClick={handleClick}>
      <div className="course-card-thumb">
        <BookOpen size={48} strokeWidth={1.5} opacity={0.8} />
      </div>
      <div className="course-card-body">
        <h3 className="course-card-title">{course.title}</h3>
        <p className="course-card-desc">{course.description}</p>
      </div>
      <div className="course-card-footer">
        <div style={{ display: 'flex', gap: 12 }}>
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
