import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';
import { BookOpen, ArrowLeft } from 'lucide-react';

export default function CreateCourse() {
  const [form, setForm] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      toast.error('Title and description are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/courses', form);
      toast.success('Course created successfully!');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create course');
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
          <h1>Create New Course</h1>
          <p>Fill in the details below to publish a new course.</p>
        </div>

        <div className="card fade-in" style={{ maxWidth: 640 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div className="stat-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', width: 44, height: 44, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Course Details</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>This will be visible to all students</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Course Title *</label>
              <input
                id="course-title"
                className="form-input"
                type="text"
                name="title"
                placeholder="e.g. Introduction to Machine Learning"
                value={form.title}
                onChange={handleChange}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                id="course-description"
                className="form-input"
                name="description"
                placeholder="Describe what students will learn in this course…"
                value={form.description}
                onChange={handleChange}
                rows={5}
                maxLength={1000}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                {form.description.length}/1000 characters
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button id="create-course-submit" type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : '✓ Create Course'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin')}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
