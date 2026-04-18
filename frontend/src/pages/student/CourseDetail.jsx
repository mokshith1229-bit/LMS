import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import { Play, File, ClipboardList, ArrowLeft, CheckCircle, Lock } from 'lucide-react';

const TYPE_ICONS = {
  video: <Play size={16} />,
  ppt: <File size={16} />,
  quiz: <ClipboardList size={16} />,
};
const TYPE_CLASS = { video: 'module-type-video', ppt: 'module-type-ppt', quiz: 'module-type-quiz' };

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [activeModule, setActiveModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState(null);
  const [watchedModules, setWatchedModules] = useState(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/courses/${id}`);
        setCourse(data.course);
        if (data.course.modules?.length > 0) {
          setActiveModule(data.course.modules[0]);
        }
        // Check existing submission
        const sub = await api.get(`/submit/my/${id}`);
        if (sub.data.submission) setSubmission(sub.data.submission);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleModuleClick = (mod) => {
    setActiveModule(mod);
    if (mod.type !== 'quiz') {
      setWatchedModules((prev) => new Set([...prev, mod._id]));
    }
  };

  const handleVideoEnded = () => {
    if (activeModule) setWatchedModules((prev) => new Set([...prev, activeModule._id]));
  };

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="loading-spinner"><div className="spinner" /></div>
      </main>
    </div>
  );

  if (!course) return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="empty-state card"><h3>Course not found</h3></div>
      </main>
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="simulation-banner fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <button 
                onClick={() => navigate('/student')} 
                className="btn btn-secondary btn-sm" 
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', marginBottom: 20 }}
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </button>
              <h1>{course.title}</h1>
              <p>{course.description}</p>
              
              <div className="course-meta-pills">
                <span className="meta-pill">
                  <ClipboardList size={12} /> {course.modules?.length || 0} Modules
                </span>
                <span className="meta-pill">
                   {submission ? 'Assessment Completed' : 'Assessment Pending'}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 60 }}>
              <img src="/assets/cube_tech_logo.png" alt="Cube Highways Logo" style={{ height: 45, objectFit: 'contain' }} />
            </div>
          </div>
        </div>

        <div className="course-detail-layout fade-in">
          {/* Content Viewer */}
          <div className="card" style={{ minHeight: 600, padding: 0, overflow: 'hidden' }}>
            {activeModule ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                     <span className={`badge ${activeModule.type === 'quiz' ? 'badge-accent' : activeModule.type === 'video' ? 'badge-danger' : 'badge-warning'}`}>
                      {modIcon(activeModule.type)} {activeModule.type.toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent)' }}>{activeModule.title}</h2>
                </div>

                <div style={{ flex: 1, padding: activeModule.type === 'quiz' ? '48px' : '0' }}>
                  {activeModule.type === 'video' && (
                    <div className="video-player-wrap" style={{ height: '100%', background: '#000' }}>
                      {activeModule.url?.includes('youtube') || activeModule.url?.includes('youtu.be') ? (
                        <iframe
                          src={activeModule.url.replace('watch?v=', 'embed/')}
                          style={{ width: '100%', height: '540px', border: 'none' }}
                          allowFullScreen
                          title={activeModule.title}
                        />
                      ) : (
                        <video
                          controls
                          src={activeModule.url}
                          style={{ width: '100%', height: '100%' }}
                          onEnded={handleVideoEnded}
                        >
                          Your browser does not support the video tag.
                        </video>
                      )}
                    </div>
                  )}

                  {activeModule.type === 'ppt' && (
                    <iframe
                      src={
                        activeModule.url?.endsWith('.pdf')
                          ? activeModule.url
                          : `https://docs.google.com/viewer?url=${encodeURIComponent(activeModule.url)}&embedded=true`
                      }
                      style={{ width: '100%', height: '600px', border: 'none' }}
                      title={activeModule.title}
                    />
                  )}

                  {activeModule.type === 'quiz' && (
                    <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
                      <div className="assessment-header">
                        <ClipboardList size={64} strokeWidth={1} color="var(--accent-secondary)" style={{ margin: '0 auto 20px' }} />
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 8 }}>
                          Institutional Assessment
                        </h3>
                        <p style={{ color: 'var(--text-muted)' }}>{activeModule.quizId?.title || 'Course Final Evaluation'}</p>
                      </div>

                      {submission ? (
                        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                          <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                          <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>Submission Received</h4>
                          <p style={{ fontWeight: 600, marginBottom: 20 }}>
                            Score: {submission.score}/{submission.total} ({submission.percentage}%)
                          </p>
                          <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/student/result/${submission._id}`, { state: { submission } })}
                          >
                            Review Results
                          </button>
                        </div>
                      ) : (
                        <div>
                          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                            This assessment will evaluate your understanding of the course modules. 
                            Please ensure you have reviewed all content before proceeding.
                          </p>
                          <button
                            id="start-quiz-btn"
                            className="btn btn-assessment-start"
                            onClick={() => navigate(`/student/quiz/${activeModule.quizId?._id || activeModule._id}`, { state: { courseId: id } })}
                          >
                            Start Assessment
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 100 }}>
                <ClipboardList size={80} opacity={0.1} style={{ marginBottom: 24 }} />
                <h3>No Module Selected</h3>
                <p>Please select a content module from the syllabus to begin learning.</p>
              </div>
            )}
          </div>

          {/* Module Sidebar */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Course Syllabus
              </h3>
            </div>
            <div className="module-list">
              {course.modules?.map((mod, i) => (
                <div
                  key={mod._id}
                  className={`module-item ${activeModule?._id === mod._id ? 'active' : ''}`}
                  onClick={() => handleModuleClick(mod)}
                >
                  <div className="module-type-icon">
                    {modIcon(mod.type, 18)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 2 }}>
                      {mod.title}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {mod.type}
                    </p>
                  </div>
                  {watchedModules.has(mod._id) && <CheckCircle size={16} color="var(--success)" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper to render consistent icons
function modIcon(type, size = 16) {
  if (type === 'video') return <Play size={size} />;
  if (type === 'ppt') return <File size={size} />;
  return <ClipboardList size={size} />;
}
