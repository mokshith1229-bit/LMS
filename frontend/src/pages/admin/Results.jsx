import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { RefreshCw, BarChart2, CheckCircle, XCircle, FileDown, ArrowLeft, FileText, Trash2, Save } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';

export default function AdminResults() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [filterExam, setFilterExam] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchPdfLoading, setBatchPdfLoading] = useState(false);
  const [theoryMarksUpdates, setTheoryMarksUpdates] = useState({});
  const [savingMarks, setSavingMarks] = useState(false);

  const handleDownloadBatchPDF = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select students to download Batch PDF');
      return;
    }

    // Get the selected rows data
    const selectedData = results.filter(r => selectedIds.includes(r.submissionId));

    // Validate that all selected submissions are from the same quiz
    const uniqueQuizIds = [...new Set(selectedData.map(r => r.quizId).filter(Boolean))];
    if (uniqueQuizIds.length > 1) {
      toast.error('Select submissions from a single assessment for Batch PDF');
      return;
    }

    if (uniqueQuizIds.length === 0) {
      toast.error('Invalid quiz selection');
      return;
    }

    const quizId = uniqueQuizIds[0];
    const firstSelected = selectedData[0];
    const quizTitle = firstSelected?.quizTitle || 'Assessment';
    const batchName = filterExam || 'Batch';

    setBatchPdfLoading(true);
    const loadingToast = toast.loading('Generating consolidated Batch PDF... This may take a while.');

    try {
      const response = await api.post(`/admin/batch-pdf/${quizId}`, {
        submissionIds: selectedIds,
        batchName: batchName
      }, {
        responseType: 'blob',
        timeout: 180000 // 3 minutes timeout for this large generation
      });

      // Check if response is JSON (error case) instead of PDF
      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        const errObj = JSON.parse(text);
        throw new Error(errObj.message || 'Server error generating PDF');
      }

      const fileBlob = new Blob([response.data], { type: 'application/pdf' });
      const safeTitle = quizTitle.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/ /g, '_');
      const safeBatch = batchName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().replace(/ /g, '_');
      const filename = `${safeTitle}_${safeBatch}_Report.pdf`;

      saveAs(fileBlob, filename);
      toast.success('Batch PDF downloaded successfully!', { id: loadingToast });
    } catch (err) {
      console.error('[Batch PDF Error]', err);
      toast.error(err.message || 'Failed to download Batch PDF', { id: loadingToast });
    } finally {
      setBatchPdfLoading(false);
    }
  };

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

  const loadCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data.courses || []);
    } catch (err) {
      console.error('Failed to load courses', err);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleExportExcel = () => {
    const filteredResults = results.filter(r => 
      (filterExam === '' || r.quizTitle === filterExam) &&
      (filterCourse === '' || r.courseTitle === filterCourse)
    );
    const selectedData = filteredResults.filter(r => selectedIds.includes(r.submissionId));
    
    if (selectedData.length === 0) {
      toast.error('Please select students to export');
      return;
    }

    // Sort selected data by percentage desc
    const sortedData = [...selectedData].sort((a, b) => b.percentage - a.percentage);

    // Define main headers
    const headers = [
      'Student Name', 'Correct Answers', 'Wrong Answers', 'Unattempted', 
      'Theoretical Marks', 'Total Theoretical', 
      'Percentage (%)', 'Result'
    ];

    // Create main data rows
    const rows = sortedData.map(r => [
      r.userName,
      r.correct,
      r.wrong,
      r.unattempted,
      r.theoryMarks || 0,
      20,
      r.percentage,
      r.passed ? 'PASS' : 'FAIL'
    ]);

    // Summary calculations
    let count90 = 0, count80 = 0, count70 = 0, count60 = 0, countBelow = 0;
    let passCount = 0;
    let sumPercentage = 0;
    let highest = -Infinity;
    let lowest = Infinity;

    sortedData.forEach(r => {
      const p = r.percentage;
      if (p >= 90) count90++;
      else if (p >= 80) count80++;
      else if (p >= 70) count70++;
      else if (p >= 60) count60++;
      else countBelow++;

      if (r.passed) passCount++;
      sumPercentage += p;
      if (p > highest) highest = p;
      if (p < lowest) lowest = p;
    });

    const totalStudents = sortedData.length;
    const avg = totalStudents ? (sumPercentage / totalStudents).toFixed(2) + '%' : '0%';
    if (highest === -Infinity) highest = 0;
    if (lowest === Infinity) lowest = 0;

    const summaryData = [
      ['Summary', ''], // J2:K2 (merge later)
      ['Score Distribution', 'Count'], // J3:K3
      ['90% and Above', count90],
      ['80% to 89.99%', count80],
      ['70% to 79.99%', count70],
      ['60% to 69.99%', count60],
      ['Below 60%', countBelow],
      [],
      ['Overall Metrics', 'Value'], // J10:K10
      ['Total Students', totalStudents],
      ['Total Pass', passCount],
      ['Total Fail', totalStudents - passCount],
      ['Highest Percentage', highest + '%'],
      ['Lowest Percentage', lowest + '%'],
      ['Average Percentage', avg]
    ];

    // Build worksheet data with padding
    const maxRows = Math.max(rows.length + 1, summaryData.length + 1);
    const worksheetData = Array(maxRows).fill(null).map(() => Array(11).fill('')); // up to column K (index 10)

    // Fill main table
    worksheetData[0].splice(0, headers.length, ...headers);
    rows.forEach((r, i) => {
      worksheetData[i + 1].splice(0, r.length, ...r);
    });

    // Fill summary table starting at row 2 (index 1), col J (index 9)
    summaryData.forEach((r, i) => {
      worksheetData[i + 1].splice(9, r.length, ...r);
    });

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Merge Summary title
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 1, c: 9 }, e: { r: 1, c: 10 } }); // J2:K2

    // Apply styles to all cells
    const fullRange = XLSX.utils.decode_range(ws['!ref']);
    for (let r = fullRange.s.r; r <= fullRange.e.r; r++) {
      for (let c = fullRange.s.c; c <= fullRange.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        if (!ws[address] || ws[address].v === '') continue; // skip empty cells

        // Main table styling
        if (c < headers.length) {
          if (r === 0) { // Main headers
            ws[address].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "1e293b" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
          } else { // Main data rows
            ws[address].s = {
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { horizontal: "center" }
            };
            if (c === 7) { // Result column
              const value = ws[address].v;
              ws[address].s.font = { bold: true, color: { rgb: value === 'PASS' ? "2f9e44" : "c92a2a" } };
            }
          }
        }

        // Summary table styling
        if (c === 9 || c === 10) {
          if (r === 1 || r === 2 || r === 9) {
            ws[address].s = {
              font: { bold: true, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "4f46e5" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
            };
          } else if (r >= 3 && r <= 7) { // Distribution data
            ws[address].s = {
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { horizontal: c === 9 ? "left" : "center" }
            };
          } else if (r >= 10 && r <= 15) { // Overall data
            ws[address].s = {
              border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
              alignment: { horizontal: c === 9 ? "left" : "center" },
              font: { bold: c === 10 }
            };
          }
        }
      }
    }

    // Column widths
    const wscols = [];
    for (let i = 0; i < 11; i++) {
      if (i < headers.length) {
        const maxLen = Math.max(headers[i].length, ...rows.map(row => (row[i] ? row[i].toString().length : 0)));
        wscols.push({ wch: maxLen + 5 });
      } else if (i === 8) { // gap
        wscols.push({ wch: 3 });
      } else if (i === 9) { // summary label
        wscols.push({ wch: 22 });
      } else if (i === 10) { // summary value
        wscols.push({ wch: 15 });
      }
    }
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
    const filtered = results.filter(r => 
      (filterExam === '' || r.quizTitle === filterExam) &&
      (filterCourse === '' || r.courseTitle === filterCourse)
    );
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

  const handleDeleteSubmission = async (submissionId) => {
    const isConfirmed = window.confirm(
      "Are you sure you want to delete this result? This will permanently remove the score record and reset the student's assignment to let them retake the exam."
    );
    if (!isConfirmed) return;

    const loadingToast = toast.loading('Deleting submission...');
    try {
      await api.delete(`/admin/results/${submissionId}`);
      toast.success('Submission deleted successfully', { id: loadingToast });
      loadResults(); // Reload the table
      // If the deleted submission was in selectedIds, remove it
      setSelectedIds(prev => prev.filter(id => id !== submissionId));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to delete submission', { id: loadingToast });
    }
  };

  const handleSaveMarks = async () => {
    const updates = Object.keys(theoryMarksUpdates).map(id => ({
      submissionId: id,
      theoryMarks: theoryMarksUpdates[id]
    }));
    if (updates.length === 0) return;

    setSavingMarks(true);
    try {
      await api.put('/admin/results/theory-marks', { marksData: updates });
      toast.success('Theory marks updated successfully');
      setTheoryMarksUpdates({});
      loadResults(); // Refresh table
    } catch (err) {
      toast.error('Failed to update theory marks');
    } finally {
      setSavingMarks(false);
    }
  };

  useEffect(() => { 
    loadResults(); 
    loadCourses();
  }, []);

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
              {selectedIds.length > 0 && (
                <span style={{ fontSize: '0.8rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  {selectedIds.length} Selected
                </span>
              )}
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Course Filter */}
              <select 
                className="input" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minWidth: 150 }}
                value={filterCourse}
                onChange={(e) => {
                  setFilterCourse(e.target.value);
                  setFilterExam(''); // Reset quiz filter when course changes
                }}
              >
                <option value="">All Courses</option>
                {courses.length > 0 ? (
                  courses.map(c => (
                    <option key={c._id} value={c.title}>{c.title}</option>
                  ))
                ) : (
                  [...new Set(results.map(r => r.courseTitle).filter(Boolean))].sort().map(title => (
                    <option key={title} value={title}>{title}</option>
                  ))
                )}
              </select>

              {/* Quiz Filter */}
              <select 
                className="input" 
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', minWidth: 150 }}
                value={filterExam}
                onChange={(e) => setFilterExam(e.target.value)}
              >
                <option value="">All Exams</option>
                {[...new Set(
                  results
                    .filter(r => filterCourse === '' || r.courseTitle === filterCourse)
                    .map(r => r.quizTitle)
                )].sort().map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
              {selectedIds.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                  onClick={() => setSelectedIds([])}
                >
                  Deselect All
                </button>
              )}
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={() => {
                  const filtered = results.filter(r => 
                    (filterExam === '' || r.quizTitle === filterExam) &&
                    (filterCourse === '' || r.courseTitle === filterCourse)
                  );
                  setSelectedIds(filtered.map(r => r.submissionId));
                }}
              >
                Select All
              </button>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={handleExportExcel}
                disabled={selectedIds.length === 0}
              >
                <FileDown size={14} /> Get Excel Report ({selectedIds.length})
              </button>
              <button
                className="btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  fontSize: '0.85rem',
                  background: 'var(--bg-sidebar)',
                  color: '#fff',
                  border: 'none',
                  opacity: selectedIds.length === 0 || batchPdfLoading ? 0.6 : 1,
                  cursor: selectedIds.length === 0 || batchPdfLoading ? 'not-allowed' : 'pointer'
                }}
                onClick={handleDownloadBatchPDF}
                disabled={selectedIds.length === 0 || batchPdfLoading}
              >
                {batchPdfLoading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Generating Batch PDF...
                  </>
                ) : (
                  <>
                    <FileText size={14} />
                    Download Batch PDF ({selectedIds.length})
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem' }}
                onClick={loadResults}
              >
                <RefreshCw size={14} /> Refresh
              </button>
              {Object.keys(theoryMarksUpdates).length > 0 && (
                <button
                  className="btn btn-primary"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: '0.85rem',
                    background: '#4f46e5', borderColor: '#4f46e5'
                  }}
                  onClick={handleSaveMarks}
                  disabled={savingMarks}
                >
                  <Save size={14} /> {savingMarks ? 'Saving...' : 'Save Marks'}
                </button>
              )}
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
                          selectedIds.length === results.filter(r => 
                            (filterExam === '' || r.quizTitle === filterExam) &&
                            (filterCourse === '' || r.courseTitle === filterCourse)
                          ).length
                        }
                      />
                    </th>
                    {['Student', 'Quiz', 'Score', 'Theory', 'Correct', 'Wrong', 'Percentage', 'Result', 'Status', 'Submitted', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                   {results
                    .filter(r => 
                      (filterExam === '' || r.quizTitle === filterExam) &&
                      (filterCourse === '' || r.courseTitle === filterCourse)
                    )
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
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={theoryMarksUpdates[r.submissionId] !== undefined ? theoryMarksUpdates[r.submissionId] : (r.theoryMarks || 0)}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTheoryMarksUpdates(prev => ({ ...prev, [r.submissionId]: val }));
                            }}
                            style={{
                              width: 50, padding: '4px', border: '1px solid #e2e8f0', borderRadius: 4,
                              textAlign: 'center', fontWeight: 600, color: '#374151'
                            }}
                          />
                        </td>
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
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <a 
                              href={`/admin/results/${r.submissionId}`}
                              className="btn btn-secondary"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.75rem', 
                                textDecoration: 'none',
                                display: 'inline-block',
                                margin: 0
                              }}
                            >
                              View Answers
                            </a>
                            <button 
                              onClick={() => handleDeleteSubmission(r.submissionId)}
                              className="btn"
                              title="Delete Submission"
                              style={{ 
                                padding: '6px', 
                                background: '#fff5f5', 
                                color: '#c92a2a', 
                                border: '1px solid #ffc9c9',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                width: '30px',
                                height: '30px'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#c92a2a';
                                e.currentTarget.style.color = '#fff';
                                e.currentTarget.style.borderColor = '#c92a2a';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = '#fff5f5';
                                e.currentTarget.style.color = '#c92a2a';
                                e.currentTarget.style.borderColor = '#ffc9c9';
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
