import api from './axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Admin API ──────────────────────────────────────────────────────────────────

export const createPublicAssessment = async (formData) => {
  const { data } = await api.post(`/public/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const getPublicAssessments = async () => {
  const { data } = await api.get(`/public/`);
  return data;
};

export const getPublicAssessmentAdmin = async (id) => {
  const { data } = await api.get(`/public/admin/${id}`);
  return data;
};

export const updatePublicAssessment = async (id, formData) => {
  const { data } = await api.put(`/public/admin/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deletePublicAssessment = async (id) => {
  const { data } = await api.delete(`/public/admin/${id}`);
  return data;
};

export const getPublicResults = async (id, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const { data } = await api.get(`/public/admin/${id}/results?${params}`);
  return data;
};

export const getPublicStats = async () => {
  const { data } = await api.get(`/public/admin-stats`);
  return data;
};

export const getAdminQuizList = async () => {
  const { data } = await api.get(`/public/admin-quizzes/list`);
  return data;
};

export const getQuizQuestions = async (quizId) => {
  const { data } = await api.get(`/public/admin-quizzes/${quizId}/questions`);
  return data;
};

export const getExportUrl = (id) =>
  `${BASE}/api/public/admin/${id}/results/export`;

// ── Public API (no auth) ───────────────────────────────────────────────────────

export const getPublicAssessmentByToken = async (token) => {
  const { data } = await api.get(`/public/p/${token}`);
  return data;
};

export const submitPublicAssessment = async (token, payload) => {
  const { data } = await api.post(`/public/p/${token}/submit`, payload);
  return data;
};
