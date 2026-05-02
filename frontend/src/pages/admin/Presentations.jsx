import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import * as pdfjsLib from 'pdfjs-dist';
import { Edit2, Trash2, Check, X } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export default function Presentations() {
  const navigate = useNavigate();
  const [presentations, setPresentations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

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
    const ext = file.name.toLowerCase().split('.').pop();
    const isPDF = ext === 'pdf';
    const isPPTX = ext === 'pptx' || ext === 'ppt';

    try {
      if (isPDF) {
        // Client-side PDF to Image conversion for 100% reliability
        const toastId = toast.loading('Processing PDF slides in browser...');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const formData = new FormData();
        formData.append('title', title);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;
          
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.8));
          formData.append('slides', blob, `slide-${i}.png`);
          toast.loading(`Processing slide ${i}/${pdf.numPages}...`, { id: toastId });
          
          canvas.width = 0;
          canvas.height = 0;
        }

        toast.loading(`Uploading ${pdf.numPages} slides...`, { id: toastId });
        const { data } = await api.post('/presentation/upload-images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 600000
        });

        if (data.success) {
          toast.success('Presentation created successfully!', { id: toastId });
          setTitle('');
          setFile(null);
          fetchPresentations();
        }
      } else if (isPPTX) {
        // Upload raw PPTX — backend will try to convert or save for iframe rendering
        const toastId = toast.loading('Uploading PPTX file...');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);

        const { data } = await api.post('/presentation/upload-pptx', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000
        });

        if (data.success) {
          toast.success(data.message || 'PPTX uploaded!', { id: toastId });
          setTitle('');
          setFile(null);
          fetchPresentations();
        }
      } else {
        toast.error('Unsupported file format. Please use .pptx, .ppt or .pdf');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePresentation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this presentation and all its slides? This cannot be undone.')) return;
    try {
      const { data } = await api.delete(`/presentation/${id}`);
      if (data.success) {
        toast.success('Presentation deleted');
        fetchPresentations();
      }
    } catch (err) {
      toast.error('Failed to delete presentation');
    }
  };

  const handleUpdateTitle = async (id) => {
    if (!editTitle.trim()) return;
    try {
      const { data } = await api.patch(`/presentation/${id}`, { title: editTitle });
      if (data.success) {
        toast.success('Title updated');
        setEditingId(null);
        fetchPresentations();
      }
    } catch (err) {
      toast.error('Failed to update title');
    }
  };

  const startEditing = (p) => {
    setEditingId(p._id);
    setEditTitle(p.title);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
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
                <>Drag & drop a <strong>.pptx</strong>, <strong>.ppt</strong>, or <strong>.pdf</strong> file here, or click to browse</>
              )}
            </p>
            <input
              id="ppt-file-input"
              type="file"
              accept=".pptx,.ppt,.pdf"
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
            {uploading ? '⏳ Uploading & Processing...' : '🚀 Upload & Convert'}
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
              <div key={p._id} className="card" style={{ padding: '1.5rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); startEditing(p); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="Edit Name"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeletePresentation(p._id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                    title="Delete Presentation"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🖼️</div>
                
                {editingId === p._id ? (
                  <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '5px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.9rem', padding: '4px 8px' }}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => handleUpdateTitle(p._id)} style={{ background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px' }}>
                      <Check size={16} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>{p.title}</h3>
                )}

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {p.slides?.length || 0} slide{p.slides?.length !== 1 ? 's' : ''} &bull; Created {new Date(p.createdAt).toLocaleDateString()}
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
      </main>
    </div>
  );
}
