import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { RefreshCw, BarChart2, CheckCircle, XCircle, FileDown, ArrowLeft } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

export default function AdminResults() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterExam, setFilterExam] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const loadResults = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/results');
      setResults(data.results || []);
    } catch (err) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = () => {
    const filteredResults = results.filter(r => filterExam === '' || r.quizTitle === filterExam);
    const selectedData = filteredResults.filter(r => selectedIds.includes(r.submissionId));
    
    if (selectedData.length === 0) {
      toast.error('Please select students to export');
      return;
    }

    // Define headers
    const headers = [
      'Student Name', 'Correct Answers', 'Wrong Answers', 'Unattempted', 
      'Theoretical Marks', 'Total Theoretical', 'Total Questions', 
      'Percentage (%)', 'Result'
    ];

    // Create data rows
    const rows = selectedData.map(r => [
      r.userName,
      r.correct,
      r.wrong,
      r.unattempted,
      '', // Theoretical Marks (Blank as requested)
      '', // Total Theoretical (Blank as requested)
      r.total,
      r.percentage,
      r.passed ? 'PASS' : 'FAIL'
    ]);

    // Combine headers and rows
    const worksheetData = [headers, ...rows];

    // Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Apply styles
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Style headers (row 0)
    for (let c = range.s.c; c <= range.e.c; c++) {
      const address = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "1e293b" } }, // Dark theme header
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" }
        }
      };
    }

    // Style data rows
    for (let r = 1; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        if (!ws[address]) ws[address] = { v: "" };
        
        ws[address].s = {
          border: {
            top: { style: "thin" },
            bottom: { style: "thin" },
            left: { style: "thin" },
            right: { style: "thin" }
          },
          alignment: { horizontal: "center" }
        };

        // Result column (index 8)
        if (c === 8) {
          const value = ws[address].v;
          ws[address].s.font = { 
            bold: true, 
            color: { rgb: value === 'PASS' ? "2f9e44" : "c92a2a" } 
          };
        }
      }
    }

    // Auto width
    const wscols = headers.map((h, i) => {
      const maxLen = Math.max(
        h.length,
        ...rows.map(row => (row[i] ? row[i].toString().length : 0))
      );
      return { wch: maxLen + 5 };
    });
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");

    try {
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const finalData = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" });
      saveAs(finalData, `Selected_Results_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel file exported successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export Excel file');
    }
  };

  const handleSelectAll = (e) => {
    const filtered = results.filter(r => filterExam === '' || r.quizTitle === filterExam);
    if (e.target.checked) {
      setSelectedIds(filtered.map(r => r.submissionId));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  useEffect(() => { loadResults(); }, []);

  const statusColors = {
    COMPLETED:  { bg: '#ebfbee', color: '#2f9e44' },
    TERMINATED: { bg: '#fff5f5', color: '#c92a2a' },
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: 30, display: 'block' }}>
          <button 
            onClick={() => navigate('/admin/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '1rem', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
            onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Assessment Results</h1>
              <p>View all student submission results and scores.</p>
            </div>
            <img src="/assets/minds_logo.png" alt="Minds Logo" style={{ height: 45, objectFit: 'contain' }} />
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 className="title-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart2 size={20} /> All Submissions
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select 
                className="input" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minWidth: 150 }}
                value={filterExam}
                onChange={(e) => setFilterExam(e.target.value)}
              >
                <option value="">All Exams</option>
                {[...new Set(results.map(r => r.quizTitle))].sort().map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={handleExportExcel}
                disabled={selectedIds.length === 0}
              >
                <FileDown size={14} /> Export Selected ({selectedIds.length})
              </button>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={loadResults}
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : results.length === 0 ? (
            <div className="empty-state">
              <BarChart2 size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <p>No submissions yet</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '10px 12px' }}>
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={
                          results.length > 0 && 
                          selectedIds.length === results.filter(r => filterExam === '' || r.quizTitle === filterExam).length
                        }
                      />
                    </th>
                    {['Student', 'Quiz', 'Score', 'Correct', 'Wrong', 'Percentage', 'Result', 'Status', 'Submitted', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results
                    .filter(r => filterExam === '' || r.quizTitle === filterExam)
                    .map((r) => {
                    const s = statusColors[r.status] || statusColors.COMPLETED;
                    const isSelected = selectedIds.includes(r.submissionId);
                    return (
                      <tr key={r.submissionId} style={{ borderBottom: '1px solid var(--border)', background: isSelected ? '#f8fafc' : 'transparent' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => handleSelectRow(r.submissionId)}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{r.userName}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.userEmail || r.userMobile || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{r.quizTitle}</div>
                          {r.courseTitle && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{r.courseTitle}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.correct}/{r.total}</td>
                        <td style={{ padding: '10px 12px', color: '#2f9e44', fontWeight: 600 }}>{r.correct}</td>
                        <td style={{ padding: '10px 12px', color: '#c92a2a', fontWeight: 600 }}>{r.wrong}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700 }}>{r.percentage}%</td>
                        <td style={{ padding: '10px 12px' }}>
                          {r.passed
                            ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2f9e44' }}><CheckCircle size={14} /> Pass</span>
                            : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#c92a2a' }}><XCircle size={14} /> Fail</span>
                          }
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 100, fontWeight: 600, fontSize: '0.78rem' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {r.submittedAt ? new Date(r.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <a 
                            href={`/admin/results/${r.submissionId}`}
                            className="btn btn-secondary"
                            style={{ 
                              padding: '4px 8px', 
                              fontSize: '0.75rem', 
                              textDecoration: 'none',
                              display: 'inline-block'
                            }}
                          >
                            View Answers
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
