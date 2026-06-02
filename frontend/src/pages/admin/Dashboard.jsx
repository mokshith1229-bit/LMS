import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import CourseCard from '../../components/CourseCard';
import {
  BookOpen, Users, ClipboardCheck, Plus, TrendingUp, UserPlus,
  BarChart2, Presentation, Radio, FileBarChart, ChevronRight,
  Activity, Clock, CheckCircle, AlertCircle, Calendar,
  GraduationCap, Target, Layers, ArrowUpRight, Monitor
} from 'lucide-react';

/* ─────────────────────────── helpers ─────────────────────────── */
function fmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function timeAgo(date) {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ─────────────────────────── sub-components ─────────────────────────── */

function KPICard({ icon: Icon, label, value, sub, color, trend }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8ecf0',
      borderRadius: '12px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: color,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '8px',
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={18} color={color} strokeWidth={2} />
        </div>
        {trend != null && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '3px',
            fontSize: '0.72rem', fontWeight: 600,
            color: trend >= 0 ? '#16a34a' : '#dc2626',
            background: trend >= 0 ? '#f0fdf4' : '#fef2f2',
            padding: '2px 8px', borderRadius: '20px',
          }}>
            <ArrowUpRight size={11} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub, to, linkLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {to && (
        <Link to={to} style={{
          display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '0.78rem', fontWeight: 600, color: '#2d7a3f',
          textDecoration: 'none',
        }}>
          {linkLabel || 'View all'} <ChevronRight size={13} />
        </Link>
      )}
    </div>
  );
}

function PanelCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e8ecf0',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </div>
  );
}

function ActivityRow({ label, sub, time, status }) {
  const statusColor = status === 'passed' ? '#16a34a' : status === 'failed' ? '#dc2626' : '#64748b';
  const statusBg = status === 'passed' ? '#f0fdf4' : status === 'failed' ? '#fef2f2' : '#f8fafc';
  const statusLabel = status === 'passed' ? 'Passed' : status === 'failed' ? 'Failed' : 'Completed';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.7rem 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.845rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '1rem' }}>
        <span style={{ fontSize: '0.7rem', background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
          {statusLabel}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#cbd5e1', minWidth: '50px', textAlign: 'right' }}>{time}</span>
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.875rem',
      padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '8px',
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={15} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{label}</div>
      </div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

function QuickActionBtn({ to, icon: Icon, label, desc, accent }) {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        padding: '0.875rem 1rem',
        border: '1px solid #e8ecf0',
        borderRadius: '10px',
        background: '#ffffff',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}20`; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8ecf0'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '8px',
          background: `${accent}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={16} color={accent} strokeWidth={2} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.845rem', fontWeight: 700, color: '#0f172a' }}>{label}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>{desc}</div>
        </div>
        <ChevronRight size={14} color="#cbd5e1" />
      </div>
    </Link>
  );
}

function TodayMetric({ icon: Icon, label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '1rem 0.5rem',
      flex: 1,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '8px',
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '0.5rem',
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

/* ─────────────────────────── main component ─────────────────────────── */

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalCourses: 0, totalStudents: 0, totalSubmissions: 0 });
  const [courses, setCourses] = useState([]);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [polls, setPolls] = useState([]);
  const [presentations, setPresentations] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [statsRes, coursesRes, quizzesRes] = await Promise.all([
        api.get('/courses/admin/stats'),
        api.get('/courses'),
        api.get('/quiz'),
      ]);
      setStats(statsRes.data.stats);
      setCourses(coursesRes.data.courses);
      setQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : quizzesRes.data.quizzes || []);

      // Load supplementary data — non-blocking
      try {
        const subRes = await api.get('/admin/results');
        setRecentSubmissions((subRes.data.results || []).slice(0, 6));
      } catch (_) {}

      try {
        const pollRes = await api.get('/poll/admin/all');
        setPolls(pollRes.data.polls || []);
      } catch (_) {}

      try {
        const presRes = await api.get('/presentation/all');
        setPresentations(presRes.data.presentations || []);
      } catch (_) {}

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDeleteCourse = async (id) => {
    try {
      await api.delete(`/courses/${id}`);
      setCourses(courses.filter(c => c._id !== id));
      const statsRes = await api.get('/courses/admin/stats');
      setStats(statsRes.data.stats);
    } catch (err) {
      console.error('Failed to delete course', err);
    }
  };

  /* ── derived metrics ── */
  const totalPollResponses = polls.reduce((acc, p) => acc + (p.responses?.length || 0), 0);
  const activePolls = polls.filter(p => !p.isExpired).length;

  // Completion rate: cap at 100%
  const completionRate = stats.totalStudents > 0
    ? Math.min(100, Math.round((stats.totalSubmissions / Math.max(stats.totalStudents * Math.max(stats.totalCourses, 1), 1)) * 100))
    : 0;

  const passedCount = recentSubmissions.filter(s => s.passed).length;
  const avgScore = recentSubmissions.length > 0
    ? Math.round(recentSubmissions.reduce((a, s) => a + (s.percentage || 0), 0) / recentSubmissions.length)
    : 0;

  // Today's activity
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todaySubmissions = recentSubmissions.filter(s => new Date(s.submittedAt) >= todayStart).length;
  const todayPolls = polls.filter(p => new Date(p.createdAt) >= todayStart).length;

  /* ── palette ── */
  const GREEN = '#2d7a3f';
  const BLUE  = '#1e40af';
  const TEAL  = '#0f766e';
  const AMBER = '#b45309';
  const SLATE = '#475569';

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ background: '#f4f6f8' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 0 2rem' }}>

          {/* ── Welcome Banner ── */}
          <div style={{
            background: 'linear-gradient(135deg, #1a3a2a 0%, #2d7a3f 60%, #3da055 100%)',
            borderRadius: '14px',
            padding: '1.75rem 2rem',
            marginBottom: '1.75rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 16px rgba(45,122,63,0.22)',
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#a7d9b5', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Training Management
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', margin: '0 0 4px' }}>
                {getGreeting()}, {user?.name?.split(' ')[0] || 'Administrator'}
              </h1>
              <p style={{ fontSize: '0.85rem', color: '#c8e6cb', margin: 0 }}>
                Your training platform is active — {stats.totalStudents} learners enrolled across {stats.totalCourses} courses.
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', marginBottom: '6px' }}>
                <img src="/assets/minds_logo.png" alt="Logo" style={{ height: 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.85 }} onError={e => e.currentTarget.style.display = 'none'} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={13} color="#a7d9b5" />
                <span style={{ fontSize: '0.78rem', color: '#a7d9b5' }}>{formatDate()}</span>
              </div>
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
            <KPICard
              icon={BookOpen} label="Total Courses" value={fmt(stats.totalCourses)}
              sub={`${quizzes.length} assessments linked`}
              color={GREEN} trend={null}
            />
            <KPICard
              icon={GraduationCap} label="Enrolled Learners" value={fmt(stats.totalStudents)}
              sub="Active student accounts"
              color={BLUE} trend={null}
            />
            <KPICard
              icon={ClipboardCheck} label="Submissions" value={fmt(stats.totalSubmissions)}
              sub={`Avg score ${avgScore}%`}
              color={TEAL} trend={null}
            />
            <KPICard
              icon={Target} label="Completion Rate" value={`${completionRate}%`}
              sub={`${passedCount} of ${recentSubmissions.length} recent passed`}
              color={AMBER} trend={null}
            />
          </div>

          {/* ── Today's Overview strip ── */}
          <PanelCard style={{ marginBottom: '1.75rem', padding: '0.5rem 1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '1.5rem', borderRight: '1px solid #f1f5f9' }}>
                <Activity size={14} color={GREEN} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>Today's Overview</span>
              </div>
              <div style={{ display: 'flex', flex: 1, justifyContent: 'space-around' }}>
                <TodayMetric icon={ClipboardCheck} label="Submissions Today" value={todaySubmissions} color={GREEN} />
                <TodayMetric icon={Radio} label="Polls Created Today" value={todayPolls} color={TEAL} />
                <TodayMetric icon={Monitor} label="Presentations" value={presentations.length} color={BLUE} />
                <TodayMetric icon={Users} label="Total Learners" value={fmt(stats.totalStudents)} color={AMBER} />
              </div>
            </div>
          </PanelCard>

          {/* ── Main 2-col grid: Activity + Insights + Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.25rem', marginBottom: '1.75rem' }}>

            {/* Recent Activity */}
            <PanelCard>
              <SectionHeader
                title="Recent Assessment Activity"
                sub="Latest learner submissions across all assessments"
                to="/admin/results" linkLabel="View all results"
              />
              {recentSubmissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: '#94a3b8' }}>
                  <ClipboardCheck size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>No submissions recorded yet.</p>
                </div>
              ) : (
                recentSubmissions.map((s, i) => (
                  <ActivityRow
                    key={i}
                    label={s.userName || 'Student'}
                    sub={`${s.quizTitle || 'Assessment'} · ${s.percentage}%`}
                    time={timeAgo(s.submittedAt)}
                    status={s.passed ? 'passed' : 'failed'}
                  />
                ))
              )}
            </PanelCard>

            {/* Live Training Insights */}
            <PanelCard>
              <SectionHeader
                title="Live Training Insights"
                sub="Platform-wide engagement metrics"
                to="/admin/polls" linkLabel="Manage polls"
              />
              <InsightItem icon={Radio} label="Total Polls Created" value={polls.length} color={GREEN} />
              <InsightItem icon={Activity} label="Poll Responses Collected" value={fmt(totalPollResponses)} color={TEAL} />
              <InsightItem icon={CheckCircle} label="Active Polls" value={activePolls} color={BLUE} />
              <InsightItem icon={Presentation} label="Presentations Created" value={presentations.length} color={AMBER} />
              <InsightItem icon={Layers} label="Total Assessments" value={quizzes.length} color={SLATE} />
            </PanelCard>
          </div>

          {/* ── Quick Actions ── */}
          <PanelCard style={{ marginBottom: '1.75rem' }}>
            <SectionHeader
              title="Quick Actions"
              sub="Jump to key management tasks"
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <QuickActionBtn to="/admin/create-course" icon={Plus} label="Create Course" desc="Add a new training course" accent={GREEN} />
              <QuickActionBtn to="/admin/add-quiz" icon={ClipboardCheck} label="Create Assessment" desc="Build a quiz or test" accent={BLUE} />
              <QuickActionBtn to="/admin/presentations" icon={Presentation} label="Start Presentation" desc="Launch a slide presentation" accent={TEAL} />
              <QuickActionBtn to="/admin/polls" icon={Radio} label="Create Live Poll" desc="Run a real-time poll session" accent={AMBER} />
              <QuickActionBtn to="/admin/results" icon={FileBarChart} label="View Reports" desc="Browse all submission results" accent={SLATE} />
              <QuickActionBtn to="/admin/analytics" icon={BarChart2} label="Analytics" desc="Deep-dive performance data" accent="#7c3aed" />
            </div>
          </PanelCard>

          {/* ── Course Catalogue ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Course Catalogue</h2>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                {courses.length} course{courses.length !== 1 ? 's' : ''} published on the platform
              </p>
            </div>
            <Link to="/admin/create-course" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: GREEN, color: '#fff',
              fontSize: '0.8rem', fontWeight: 700,
              padding: '7px 16px', borderRadius: '8px',
              textDecoration: 'none',
            }}>
              <Plus size={14} /> New Course
            </Link>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : courses.length === 0 ? (
            <PanelCard style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <BookOpen size={40} color="#cbd5e1" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', margin: '0 0 6px' }}>No courses yet</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 20px' }}>Create your first course to get started</p>
              <Link to="/admin/create-course" style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                background: GREEN, color: '#fff',
                fontSize: '0.85rem', fontWeight: 700,
                padding: '9px 20px', borderRadius: '8px', textDecoration: 'none',
              }}>
                <Plus size={15} /> Create Course
              </Link>
            </PanelCard>
          ) : (
            <div className="courses-grid">
              {courses.map((course, _i) => (
                <CourseCard key={course._id} course={course} index={_i} onDelete={handleDeleteCourse} />
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
