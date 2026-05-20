import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import { ChevronLeft, Download, CheckCircle2, XCircle, User, Mail, BookOpen, Clock, BarChart3, ArrowLeft, Shuffle, Layers } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

export default function AdminSubmissionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);
  const reportRef = useRef(null);

  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const res = await api.get(`/admin/submissions/${id}`);
        if (res.data.success) {
          setData(res.data);
        } else {
          setError(res.data.message || 'Failed to fetch submission');
          toast.error(res.data.message || 'Failed to fetch submission');
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Error fetching submission details';
        console.error('Error fetching submission:', err);
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [id]);

  const handleDownloadPDF = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `Assessment_Report_${data?.user?.name.split(' ')[0]}_${id.substring(0, 5)}`,
    onBeforePrint: async () => {
      setDownloading(true);
      return Promise.resolve();
    },
    onAfterPrint: () => {
      setDownloading(false);
      toast.success('Report generated successfully!');
    },
    onPrintError: () => {
      setDownloading(false);
      toast.error('Failed to generate report');
    }
  });

  if (loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="view-loading">
            <div className="view-spinner"></div>
            <p>Loading submission details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="view-error">
            <XCircle size={48} color="#ef4444" />
            <h2 style={{ color: '#1e293b', margin: 0 }}>Submission Not Found</h2>
            <p style={{ color: '#64748b', maxWidth: 480, textAlign: 'center', margin: 0 }}>
              {error || 'This submission record could not be loaded. It may have been deleted or the ID is invalid.'}
            </p>
            <button onClick={() => navigate('/admin/results')} className="view-btn-back" style={{ border: '1px solid #e2e8f0', padding: '0.6rem 1.2rem', borderRadius: 8 }}>
              <ChevronLeft size={18} /> Back to Results
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="admin-submission-view">
      {/* Header Controls */}
      <div className="view-controls">
        <button 
          onClick={() => navigate('/admin/results')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '0.9rem', fontWeight: 600 }}
          onMouseOver={(e) => e.currentTarget.style.color = '#1e293b'}
          onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
        >
          <ArrowLeft size={18} />
          Back to Results
        </button>
        
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="view-btn-download"
        >
          <Download size={18} /> {downloading ? 'Processing...' : 'Download Report'}
        </button>
      </div>

      {/* Main Report Container */}
      <div id="report-wrapper" ref={reportRef} className="report-wrapper">
        <div className="report-container">
          {/* Brand Header */}
          <header className="report-header">
            <div className="header-info">
              <span className="report-badge">Official Assessment Record</span>
              <h1>Detailed Report</h1>
              <p className="quiz-name">{data.quizTitle}</p>

            </div>
          </header>

          {/* Student & Summary Card */}
          <section className="info-section">
            <div className="info-card">
              <div className="info-item">
                <div className="icon-box blue"><User size={18} /></div>
                <div>
                  <label>Student Name</label>
                  <span>{data.user.name}</span>
                </div>
              </div>
              <div className="info-item">
                <div className="icon-box indigo"><Mail size={18} /></div>
                <div>
                  <label>Email Address</label>
                  <span>{data.user.email}</span>
                </div>
              </div>
              <div className="info-item">
                <div className="icon-box emerald"><BookOpen size={18} /></div>
                <div>
                  <label>Assessment</label>
                  <span>{data.quizTitle}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Detailed Answers */}
          <section className="answers-section">
            <h3 className="section-title">
              <BarChart3 size={20} /> Question-by-Question Analysis

            </h3>
            
            <div className="questions-list">
              {data.answers.map((item, idx) => {
                // isCorrect and isUnattempted are pre-computed server-side
                // For randomized quizzes: correctAnswer is index into item.options (shuffledOptions)
                const isCorrect = item.isCorrect !== undefined
                  ? item.isCorrect
                  : item.userAnswer !== null && item.userAnswer.toString() === item.correctAnswer.toString();
                const isUnattempted = item.isUnattempted !== undefined ? item.isUnattempted : item.userAnswer === null;

                return (
                  <div key={idx} className="question-item">
                    <div className="question-header">
                      <div className="q-index">Q{idx + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div className="q-text">{item.question}</div>
                        {/* Show question image if any */}
                        {item.imageUrl && (
                          <img src={item.imageUrl} alt="" style={{ maxWidth: 320, maxHeight: 200, borderRadius: 8, marginTop: 8, border: '1px solid #e2e8f0' }}
                            onError={e => e.target.style.display = 'none'} />
                        )}
                      </div>
                      <div className="q-status">
                        {isUnattempted ? (
                          <span className="badge neutral">Unattempted</span>
                        ) : isCorrect ? (
                          <span className="badge success">Correct</span>
                        ) : (
                          <span className="badge danger">Incorrect</span>
                        )}
                      </div>
                    </div>

                    <div className="options-grid">
                      {item.options.map((opt, oIdx) => {
                        // item.options = shuffledOptions for randomized quizzes
                        // item.correctAnswer = index into item.options
                        // item.userAnswer = index into item.options
                        const isUserSelected = item.userAnswer !== null &&
                          item.userAnswer !== undefined &&
                          item.userAnswer.toString() === oIdx.toString();
                        const isCorrectOpt = item.correctAnswer.toString() === oIdx.toString();
                        
                        let optClass = 'option-box';
                        if (isCorrectOpt) optClass += ' correct-opt';
                        if (isUserSelected) optClass += ' user-selected';

                        return (
                          <div key={oIdx} className={optClass}>
                            <span className="opt-label">{String.fromCharCode(65 + oIdx)}</span>
                            <span className="opt-text">{opt}</span>
                            {isUserSelected && <span className="user-tag">Selected</span>}
                            {isCorrectOpt && !isCorrect && <span className="correct-tag">Correct Answer</span>}
                            {isCorrectOpt && isCorrect && isUserSelected && <span className="correct-tag" style={{background:'#10b981'}}>✓ Correct</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Footer */}
          <footer className="report-footer">
            <div className="footer-line"></div>
            <p>Generated by LMS Portal | {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
          </footer>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .admin-submission-view {
          padding: 2rem 1rem;
          background: #f1f5f9;
          min-height: 100vh;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .view-controls {
          max-width: 900px;
          margin: 0 auto 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .view-btn-back {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: none;
          border: none;
          color: #64748b;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s;
        }
        .view-btn-back:hover { color: #1e293b; }

        .view-btn-download {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          background: #2563eb;
          color: white;
          padding: 0.75rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
          transition: all 0.2s;
        }
        .view-btn-download:hover { background: #1d4ed8; transform: translateY(-1px); }
        .view-btn-download:active { transform: translateY(0); }
        .view-btn-download:disabled { opacity: 0.7; cursor: not-allowed; }

        .report-wrapper {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
          overflow: hidden;
        }

        .report-header {
          padding: 3rem;
          background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%);
          color: white;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
        }

        .header-info {
          width: 100%;
        }



        .report-badge {
          background: rgba(255,255,255,0.1);
          padding: 0.4rem 0.8rem;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
          display: inline-block;
        }

        .report-header h1 { font-size: 2.5rem; font-weight: 800; margin: 0.2rem 0; }
        .quiz-name { font-size: 1rem; opacity: 0.9; font-weight: 500; }
        .header-logo img { height: 50px; filter: brightness(0) invert(1); }

        .info-section { padding: 0 3rem; margin-top: -2rem; }
        .info-card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
          border: 1px solid #f1f5f9;
        }

        .info-item { display: flex; align-items: center; gap: 1rem; }
        .icon-box {
          width: 40px; height: 40px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .icon-box.blue { background: #eff6ff; color: #2563eb; }
        .icon-box.indigo { background: #eef2ff; color: #4f46e5; }
        .icon-box.emerald { background: #ecfdf5; color: #059669; }

        .info-item label { display: block; font-size: 0.7rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.2rem; }
        .info-item span { font-size: 1rem; font-weight: 600; color: #1e293b; }

        .answers-section { padding: 3rem; }
        .section-title {
          display: flex; align-items: center; gap: 0.75rem;
          font-size: 1.25rem; font-weight: 700; color: #1e293b;
          margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 2px solid #f1f5f9;
        }

        .questions-list { display: flex; flex-direction: column; gap: 3rem; }
        .question-item { position: relative; }
        .question-header { display: flex; gap: 1.25rem; align-items: flex-start; margin-bottom: 1.5rem; }
        .q-index {
          width: 36px; height: 36px; background: #f1f5f9; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; color: #64748b; font-size: 0.9rem; flex-shrink: 0;
        }
        .q-text { font-size: 1.15rem; font-weight: 600; color: #1e293b; flex: 1; line-height: 1.5; }
        
        .badge {
          padding: 0.4rem 0.8rem; border-radius: 100px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
        }
        .badge.success { background: #dcfce7; color: #15803d; }
        .badge.danger { background: #fee2e2; color: #b91c1c; }
        .badge.neutral { background: #f1f5f9; color: #64748b; }

        .options-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-left: 3.25rem; }
        .option-box {
          padding: 1rem 1.25rem; border-radius: 12px; border: 1.5px solid #e2e8f0;
          background: #fff; position: relative; display: flex; align-items: center; gap: 0.75rem;
          transition: all 0.2s;
        }
        .opt-label { font-weight: 800; color: #cbd5e1; font-size: 0.8rem; width: 1.5rem; }
        .opt-text { font-size: 0.95rem; color: #475569; font-weight: 500; }

        .option-box.correct-opt { background: #f0fdf4; border-color: #bbf7d0; }
        .option-box.correct-opt .opt-text { color: #166534; font-weight: 700; }
        .option-box.user-selected { border-color: #3b82f6; border-width: 2px; box-shadow: 0 4px 6px -1px rgba(59,130,246,0.1); }
        
        .user-tag, .correct-tag {
          position: absolute; top: -10px; right: 10px;
          padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase;
        }
        .user-tag { background: #3b82f6; color: white; }
        .correct-tag { background: #10b981; color: white; }

        .report-footer { padding: 3rem; text-align: center; }
        .footer-line { height: 1px; background: #f1f5f9; margin-bottom: 2rem; }
        .report-footer p { color: #94a3b8; font-size: 0.85rem; font-weight: 500; }

        .view-loading, .view-error {
          min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem;
        }
        .view-spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media print {
          @page {
            size: A4;
            margin: 0mm !important; /* Suppress browser headers/footers */
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body { 
            background: white !important; 
            color: black !important;
            margin: 0 !important;
          }
          .app-layout { display: block !important; }
          .sidebar, .view-controls { display: none !important; }
          .main-content { 
            padding: 0 !important; 
            margin: 0 !important; 
            width: 100% !important; 
            height: auto !important;
            overflow: visible !important;
          }
          .admin-submission-view { 
            background: white !important; 
            padding: 0 !important; 
            min-height: auto !important;
          }
          .report-wrapper { 
            box-shadow: none !important; 
            border: none !important;
            border-radius: 0 !important; 
            width: 100% !important; 
            max-width: none !important;
            margin: 0 !important;
            padding: 15mm !important; /* Add internal margin back */
            overflow: visible !important;
          }
          .report-header { 
            padding: 2.5rem !important; 
            background: linear-gradient(135deg, #1e3a8a 0%, #312e81 100%) !important;
            color: white !important;
            page-break-after: avoid !important;
          }
          .info-section { 
            padding: 0 2.5rem !important; 
            margin-top: -1.5rem !important;
            page-break-inside: avoid !important;
          }
          .info-card { 
            border: 1px solid #e2e8f0 !important;
            padding: 1.5rem !important; 
          }
          .answers-section { 
            padding: 2.5rem !important; 
            overflow: visible !important;
          }
          .section-title {
            page-break-after: avoid !important;
          }
          .question-item { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important;
            margin-bottom: 2.5rem !important;
            border-bottom: 1px solid #f1f5f9 !important;
            padding-bottom: 2rem !important;
          }
          .options-grid { 
            margin-bottom: 1rem !important; 
            page-break-inside: avoid !important;
          }
          .option-box {
            border: 1.5px solid #e2e8f0 !important;
          }
          .report-footer { 
            padding: 2.5rem !important; 
            page-break-before: auto !important; 
          }
        }
      ` }} />
      </div>
      </main>
    </div>
  );
}
