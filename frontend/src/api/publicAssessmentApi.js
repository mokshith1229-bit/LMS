import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Admin API ──────────────────────────────────────────────────────────────────

export const createPublicAssessment = async (formData) => {
  const { data } = await axios.post(`${BASE}/public/`, formData, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const getPublicAssessments = async () => {
  const { data } = await axios.get(`${BASE}/public/`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getPublicAssessmentAdmin = async (id) => {
  const { data } = await axios.get(`${BASE}/public/admin/${id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const updatePublicAssessment = async (id, formData) => {
  const { data } = await axios.put(`${BASE}/public/admin/${id}`, formData, {
    headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deletePublicAssessment = async (id) => {
  const { data } = await axios.delete(`${BASE}/public/admin/${id}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getPublicResults = async (id, filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  const { data } = await axios.get(`${BASE}/public/admin/${id}/results?${params}`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getPublicStats = async () => {
  const { data } = await axios.get(`${BASE}/public/admin-stats`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getAdminQuizList = async () => {
  const { data } = await axios.get(`${BASE}/public/admin-quizzes/list`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getQuizQuestions = async (quizId) => {
  const { data } = await axios.get(`${BASE}/public/admin-quizzes/${quizId}/questions`, {
    headers: getAuthHeaders(),
  });
  return data;
};

export const getExportUrl = (id) =>
  `${BASE}/public/admin/${id}/results/export`;

// ── Public API (no auth) ───────────────────────────────────────────────────────

export const getPublicAssessmentByToken = async (token) => {
  const { data } = await axios.get(`${BASE}/public/p/${token}`);
  return data;
};

export const submitPublicAssessment = async (token, payload) => {
  const { data } = await axios.post(`${BASE}/public/p/${token}/submit`, payload);
  return data;
};
