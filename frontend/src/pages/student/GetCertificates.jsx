import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/Sidebar';
import { Award, Download, Eye, CheckCircle } from 'lucide-react';

// Specialized Certificate Template Component
const CertificateView = ({ user, courseTitle, date }) => {
  return (
    <div className="certificate-container">
      <div className="certificate-border">
        {/* NHAI & Cube Highways Branding */}
        <div className="cert-header">
          <img src="/assets/nhai_logo.png" alt="NHAI" className="cert-logo-nhai" />
          <img src="/assets/branding_logo.png" alt="Cube Highways" className="cert-logo-cube" />
        </div>

        <div className="cert-body">
          <h4 className="cert-subtitle">CERTIFICATE OF APPRECIATION</h4>
          <p className="cert-text">This is proudly presented to</p>
          <h1 className="cert-name">{user?.name || 'VISHAL KUMAR'}</h1>
          <p className="cert-description">
            In recognition of your outstanding dedication and successful completion of the
          </p>
          <h2 className="cert-course">{courseTitle}</h2>
          <p className="cert-date">Date: {date}</p>
        </div>

        <div className="cert-footer">
          <div className="cert-signature">
            <div className="sig-line"></div>
            <span>Training Director</span>
            <p>Cube Highways Technologies</p>
          </div>
          <div className="cert-seal">
            <div className="seal-inner">
              <span>OFFICIAL</span>
              <span>SEAL</span>
            </div>
          </div>
          <div className="cert-signature">
            <div className="sig-line"></div>
            <span>Program Coordinator</span>
            <p>Institutional Learning</p>
          </div>
        </div>

        {/* Watermarks */}
        <div className="cert-watermark-tiled" />
        <img src="/assets/branding_logo.png" className="cert-watermark-center" alt="" />
      </div>
    </div>
  );
};

export default function GetCertificates() {
  const { user } = useAuth();
  const [showCert, setShowCert] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Demo completed courses for simulation
  const completedCourses = [
    {
      id: 'demo-cert-1',
      title: 'Assessment UI Demo - Foundation',
      completedDate: 'April 17, 2026',
      score: '96%',
    }
  ];

  const handleView = (course) => {
    setSelectedCourse(course);
    setShowCert(true);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">My Certificates</h1>
          <p className="page-subtitle">View and download your earned certifications</p>
        </div>

        {!showCert ? (
          <div className="certificates-grid">
            {completedCourses.map((course) => (
              <div key={course.id} className="cert-card card">
                <div className="cert-card-icon">
                  <Award size={32} color="var(--accent)" />
                </div>
                <div className="cert-card-info">
                  <h3>{course.title}</h3>
                  <div className="cert-meta">
                    <span><CheckCircle size={14} /> Completed on: {course.completedDate}</span>
                    <span>Score: {course.score}</span>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => handleView(course)}>
                  <Eye size={16} /> View Certificate
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="certificate-preview-overlay fade-in">
            <div className="certificate-actions">
              <button className="btn btn-secondary" onClick={() => setShowCert(false)}>Back to List</button>
              <button className="btn btn-success" onClick={handlePrint}>
                <Download size={16} /> Download PDF / Print
              </button>
            </div>
            <CertificateView 
              user={user} 
              courseTitle={selectedCourse?.title} 
              date={selectedCourse?.completedDate} 
            />
          </div>
        )}
      </main>
    </div>
  );
}
