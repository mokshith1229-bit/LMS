import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';

export default function Presentations() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { fetchPresentations(); }, []);

  const fetchPresentations = async () => {
    try {
      const { data } = await api.get('/presentation/all');
      if (data.success) setPresentations(data.presentations);
    } catch (err) {
      toast.error('Failed to load presentations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) {
      toast.error('Title and file are required');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    try {
      const { data } = await api.post('/presentation/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success('Presentation uploaded & converted!');
        setTitle('');
        setFile(null);
        fetchPresentations();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Presentations</h1>
        <p>Upload slides and attach live polls for interactive presentations.</p>
      </div>

      {/* Upload Card */}
      <div className="card" style={{ padding: '2rem', marginTop: '2rem', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Upload New Presentation</h2>
        <form onSubmit={handleUpload}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Presentation Title</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Q1 Sales Review"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => document.getElementById('ppt-file-input').click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '12px',
              padding: '2.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(141,198,63,0.05)' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              {file ? (
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ {file.name}</span>
              ) : (
                <>Drag & drop a <strong>.pptx</strong> or <strong>.pdf</strong> file here, or click to browse</>
              )}
            </p>
            <input
              id="ppt-file-input"
              type="file"
              accept=".pptx,.pdf"
              style={{ display: 'none' }}
              onChange={e => setFile(e.target.files[0])}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '1.5rem' }}
            disabled={uploading}
          >
            {uploading ? '⏳ Converting slides...' : '🚀 Upload & Convert'}
          </button>
        </form>
      </div>

      {/* Presentations List */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Your Presentations</h2>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        ) : presentations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No presentations yet. Upload your first one above!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {presentations.map(p => (
              <div key={p._id} className="card" style={{ padding: '1.5rem', cursor: 'pointer' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🖼️</div>
                <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{p.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {p.slides.length} slide{p.slides.length !== 1 ? 's' : ''} &bull; Created {new Date(p.createdAt).toLocaleDateString()}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                    onClick={() => navigate(`/admin/presentations/${p._id}/setup`)}
                  >
                    ⚙️ Setup Polls
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: '0.85rem' }}
                    onClick={() => navigate(`/admin/presentations/${p._id}/present`)}
                  >
                    ▶ Present
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
