import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { Upload, File, Video, ArrowLeft, CheckCircle } from 'lucide-react';

export default function UploadContent() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ courseId: '', title: '', type: 'video' });
  const [file, setFile] = useState(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'url'
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/courses').then(({ data }) => setCourses(data.courses));
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleTypeChange = (t) => {
    // If the type changes, clear the previously selected files/urls as they might be incompatible
    if (form.type !== t) {
      setFile(null);
      setExternalUrl('');
    }
    setForm({ ...form, type: t });

    // Auto-open the OS file manager directly when a content type is clicked for faster workflow
    if (uploadMode === 'file') {
      setTimeout(() => {
        if (fileRef.current) fileRef.current.click();
      }, 50); // Minor delay ensures React updates the 'accept' attribute before the browser opens the picker
    }
  };

  const handleFile = (f) => {
    if (f) setFile(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.courseId || !form.title || !form.type) {
      toast.error('Please fill all required fields');
      return;
    }
    if (uploadMode === 'file' && !file) {
      toast.error('Please select a file');
      return;
    }
    if (uploadMode === 'url' && !externalUrl) {
      toast.error('Please enter a URL');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('courseId', form.courseId);
      formData.append('title', form.title);
      formData.append('type', form.type);
      if (uploadMode === 'file' && file) {
        formData.append('file', file);
      } else {
        formData.append('url', externalUrl);
      }

      await api.post('/content/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Content uploaded successfully!');
      setForm({ courseId: '', title: '', type: 'video' });
      setFile(null);
      setExternalUrl('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header fade-in">
          <button onClick={() => navigate('/admin')} className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1>Upload Content</h1>
          <p>Add video or PPT/PDF materials to your courses.</p>
        </div>

        <div className="card fade-in" style={{ maxWidth: 680 }}>
          <form onSubmit={handleSubmit}>
            {/* Course Select */}
            <div className="form-group">
              <label className="form-label">Select Course *</label>
              <select id="upload-course" className="form-input" name="courseId" value={form.courseId} onChange={handleChange}>
                <option value="">-- Choose a course --</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>{c.title}</option>
                ))}
              </select>
            </div>

            {/* Module Title */}
            <div className="form-group">
              <label className="form-label">Module Title *</label>
              <input
                id="upload-title"
                className="form-input"
                type="text"
                name="title"
                placeholder="e.g. Introduction to Neural Networks"
                value={form.title}
                onChange={handleChange}
              />
            </div>

            {/* Type */}
            <div className="form-group">
              <label className="form-label">Content Type *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['video', 'ppt'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`btn ${form.type === t ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTypeChange(t)}
                  >
                    {t === 'video' ? <Video size={15} /> : <File size={15} />}
                    {t === 'video' ? 'Video' : 'PPT / PDF'}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Mode Toggle */}
            <div className="form-group">
              <label className="form-label">Upload Method</label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {['file', 'url'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`btn btn-sm ${uploadMode === m ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setUploadMode(m);
                      if (m === 'file') {
                         setTimeout(() => {
                           if (fileRef.current) fileRef.current.click();
                         }, 50);
                      }
                    }}
                  >
                    {m === 'file' ? '📁 Upload File' : '🔗 External URL'}
                  </button>
                ))}
              </div>

              {uploadMode === 'file' ? (
                <div
                  className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                  onClick={() => fileRef.current.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                >
                  {file ? (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>
                        <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto' }} />
                      </div>
                      <p className="upload-title">{file.name}</p>
                      <p className="upload-sub">{(file.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                      <p className="upload-title">Click or drag file here</p>
                      <p className="upload-sub">
                        {form.type === 'video' ? 'MP4, WebM up to 500MB' : 'PDF, PPT, PPTX up to 100MB'}
                      </p>
                    </>
                  )}
                  <input
                    id="upload-file"
                    ref={fileRef}
                    type="file"
                    accept={form.type === 'video' ? 'video/*' : '.pdf,.ppt,.pptx'}
                    style={{ display: 'none' }}
                    onChange={(e) => handleFile(e.target.files[0])}
                  />
                </div>
              ) : (
                <input
                  id="upload-url"
                  className="form-input"
                  type="url"
                  placeholder={form.type === 'video' ? "https://example.com/video.mp4 or YouTube URL" : "https://example.com/document.pdf"}
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              )}
            </div>

            <button id="upload-submit" type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Uploading…' : <><Upload size={16} /> Upload Module</>}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
