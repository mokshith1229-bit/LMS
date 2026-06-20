import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Plus, Activity, Users, ToggleRight, ToggleLeft, Trash2, ExternalLink, Copy, ChevronRight, BarChart2 } from 'lucide-react';
import { getPublicAssessments, getPublicStats, deletePublicAssessment, updatePublicAssessment } from '../../api/publicAssessmentApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';

const BASE_URL = window.location.origin;

export default function PublicAssessments() {
  const [assessments, setAssessments] = useState([]);
  const [stats, setStats] = useState({ totalAssessments: 0, activeAssessments: 0, totalSubmissions: 0 });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    try {
      const [listRes, statsRes] = await Promise.all([
        getPublicAssessments(),
        getPublicStats(),
      ]);
      setAssessments(listRes.assessments || []);
      setStats(statsRes.stats || {});
    } catch {
      toast.error('Failed to load public assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copyLink = (identifier) => {
    const url = `${BASE_URL}/${identifier}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const handleToggle = async (assessment) => {
    try {
      const fd = new FormData();
      fd.append('data', JSON.stringify({ isActive: !assessment.isActive }));
      await updatePublicAssessment(assessment._id, fd);
      toast.success(assessment.isActive ? 'Assessment deactivated' : 'Assessment activated');
      load();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assessment and all its submissions? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await deletePublicAssessment(id);
      toast.success('Assessment deleted');
      load();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Globe size={22} color="#4f46e5" />
              Public Assessments
            </h1>
            <p>Create shareable assessments — no login required for candidates</p>
          </div>
          <Link
            to="/admin/public-assessments/create"
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none', padding: '10px 22px', fontWeight: 700 }}
          >
            <Plus size={16} /> Create Assessment
          </Link>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
          {[
            { label: 'Total Assessments', value: stats.totalAssessments, icon: <Globe size={22} />, color: '#4f46e5' },
            { label: 'Active Now', value: stats.activeAssessments, icon: <Activity size={22} />, color: '#10b981' },
            { label: 'Total Submissions', value: stats.totalSubmissions, icon: <Users size={22} />, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e293b' }}>{s.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Sub-navigation */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {[
            { to: '/admin/public-assessments/results', label: 'All Results', icon: <BarChart2 size={15} /> },
            { to: '/admin/public-assessments/reports', label: 'Reports', icon: <Activity size={15} /> },
          ].map(nav => (
            <Link key={nav.to} to={nav.to} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 18px', borderRadius: 6, background: '#fff',
              border: '1px solid #e2e8f0', fontSize: '0.875rem', fontWeight: 600,
              color: '#4f46e5', textDecoration: 'none', transition: 'all 0.18s'
            }}>
              {nav.icon} {nav.label} <ChevronRight size={14} />
            </Link>
          ))}
        </div>

        {/* Assessments List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading...</div>
        ) : assessments.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 40px',
            background: '#fff', border: '2px dashed #e2e8f0', borderRadius: 12
          }}>
            <Globe size={48} color="#e2e8f0" style={{ marginBottom: 16 }} />
            <h3 style={{ color: '#64748b', marginBottom: 8 }}>No public assessments yet</h3>
            <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: '0.9rem' }}>
              Create your first public assessment and share it with anyone via link or QR code
            </p>
            <Link to="/admin/public-assessments/create" className="btn btn-primary"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', border: 'none' }}>
              <Plus size={16} /> Create First Assessment
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {assessments.map(a => (
              <div key={a._id} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: 16, transition: 'box-shadow 0.2s',
              }}>
                {/* Color indicator */}
                <div style={{
                  width: 4, height: 56, borderRadius: 4,
                  background: a.isActive ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1',
                  flexShrink: 0
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{a.title}</h3>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                      background: a.isActive ? '#d1fae5' : '#f1f5f9',
                      color: a.isActive ? '#065f46' : '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 20, fontSize: '0.8rem', color: '#64748b' }}>
                    <span>🔗 /{a.slug || a.token}</span>
                    <span>📝 {a.questions?.length || 0} questions</span>
                    <span>👥 {a.submissionCount || 0} submissions</span>
                    <span>⏱ {Math.floor(a.duration / 60)} min</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button
                    onClick={() => copyLink(a.slug || a.token)}
                    title="Copy public link"
                    style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '6px 12px', color: '#0284c7', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={13} /> Copy Link
                  </button>

                  <a
                    href={`/${a.slug || a.token}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open public page"
                    style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '6px 12px', color: '#7c3aed', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} /> Preview
                  </a>

                  <Link
                    to={`/admin/public-assessments/${a._id}/results`}
                    style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '6px 12px', color: '#ea580c', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                  >
                    <BarChart2 size={13} /> Results
                  </Link>

                  <button
                    onClick={() => handleToggle(a)}
                    title={a.isActive ? 'Deactivate' : 'Activate'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: a.isActive ? '#10b981' : '#94a3b8', padding: 4 }}
                  >
                    {a.isActive ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                  </button>

                  <button
                    onClick={() => handleDelete(a._id)}
                    disabled={deleting === a._id}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                    title="Delete assessment"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
