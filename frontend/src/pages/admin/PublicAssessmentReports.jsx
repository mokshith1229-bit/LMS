import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart2, TrendingUp, Users, Award, Activity } from 'lucide-react';
import { getPublicAssessments, getPublicResults } from '../../api/publicAssessmentApi';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';

export default function PublicAssessmentReports() {
  const [assessments, setAssessments] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { assessments: list } = await getPublicAssessments();
        setAssessments(list || []);

        // Fetch results for each assessment
        const reports = await Promise.all(
          (list || []).map(async (a) => {
            try {
              const { submissions } = await getPublicResults(a._id, {});
              const total = submissions.length;
              const passed = submissions.filter(s => s.passed).length;
              const avgPct = total > 0
                ? (submissions.reduce((sum, s) => sum + s.percentage, 0) / total).toFixed(1)
                : 0;
              const avgCorrect = total > 0
                ? (submissions.reduce((sum, s) => sum + s.correct, 0) / total).toFixed(1)
                : 0;
              const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

              return {
                _id: a._id,
                title: a.title,
                token: a.token,
                isActive: a.isActive,
                totalQuestions: a.questions?.length || 0,
                total,
                passed,
                failed: total - passed,
                passRate,
                avgScore: avgPct,
                avgCorrect,
              };
            } catch {
              return { ...a, total: 0, passed: 0, failed: 0, passRate: 0, avgScore: 0, avgCorrect: 0 };
            }
          })
        );
        setReportData(reports);
      } catch {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalSubmissionsAll = reportData.reduce((s, r) => s + r.total, 0);
  const overallPassRate = totalSubmissionsAll > 0
    ? ((reportData.reduce((s, r) => s + r.passed, 0) / totalSubmissionsAll) * 100).toFixed(1)
    : 0;

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Link to="/admin/public-assessments" style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
                <ArrowLeft size={14} /> Public Assessments
              </Link>
            </div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={22} color="#4f46e5" />
              Public Assessment Reports
            </h1>
            <p>Aggregate performance overview across all public assessments</p>
          </div>
        </div>

        {/* Overall stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
          {[
            { label: 'Total Assessments', val: assessments.length, icon: <BarChart2 size={22} />, color: '#4f46e5' },
            { label: 'Total Participants', val: totalSubmissionsAll, icon: <Users size={22} />, color: '#10b981' },
            { label: 'Overall Pass Rate', val: `${overallPassRate}%`, icon: <TrendingUp size={22} />, color: '#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#1e293b' }}>{s.val}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Per-assessment report cards */}
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading reports...</div>
        ) : reportData.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
            <BarChart2 size={40} color="#e2e8f0" style={{ marginBottom: 12 }} />
            <p style={{ color: '#94a3b8' }}>No assessments yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reportData.map((r) => (
              <div key={r._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>{r.title}</h3>
                      <span style={{
                        fontSize: '0.7rem', padding: '2px 8px', borderRadius: 20, fontWeight: 800,
                        background: r.isActive ? '#d1fae5' : '#f1f5f9',
                        color: r.isActive ? '#065f46' : '#64748b',
                        textTransform: 'uppercase',
                      }}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      🔗 /{r.slug || r.token} · {r.totalQuestions} questions
                    </div>
                  </div>
                  <Link
                    to={`/admin/public-assessments/${r._id}/results`}
                    style={{
                      padding: '7px 16px', background: '#ede9fe', border: '1px solid #ddd6fe',
                      borderRadius: 7, color: '#4f46e5', fontWeight: 700, fontSize: '0.8rem',
                      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Users size={13} /> View Results
                  </Link>
                </div>

                {r.total === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>No submissions yet</p>
                ) : (
                  <>
                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
                      {[
                        { label: 'Participants', val: r.total, color: '#4f46e5' },
                        { label: 'Passed', val: r.passed, color: '#10b981' },
                        { label: 'Failed', val: r.failed, color: '#ef4444' },
                        { label: 'Avg Score', val: `${r.avgScore}%`, color: '#f59e0b' },
                      ].map(s => (
                        <div key={s.label} style={{ textAlign: 'center', padding: '12px', background: '#f8fafc', borderRadius: 8 }}>
                          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Pass rate bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        <span>Pass Rate</span>
                        <span style={{ color: parseFloat(r.passRate) >= 60 ? '#10b981' : '#ef4444' }}>{r.passRate}%</span>
                      </div>
                      <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${r.passRate}%`,
                          background: parseFloat(r.passRate) >= 60
                            ? 'linear-gradient(90deg, #10b981, #059669)'
                            : 'linear-gradient(90deg, #ef4444, #dc2626)',
                          borderRadius: 4,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
