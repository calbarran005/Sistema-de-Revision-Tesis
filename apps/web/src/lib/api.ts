import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          });
          localStorage.setItem('access_token', data.data.accessToken);
          localStorage.setItem('refresh_token', data.data.refreshToken);
          error.config!.headers!.Authorization = `Bearer ${data.data.accessToken}`;
          return api(error.config!);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// Typed API helpers
export const authApi = {
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  getMe: () => api.get('/auth/me'),
};

export const submissionsApi = {
  list: (params?: any) => api.get('/submissions', { params }),
  get: (id: string) => api.get(`/submissions/${id}`),
  upload: (formData: FormData) => api.post('/submissions/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  uploadBatch: (formData: FormData) => api.post('/submissions/batch', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDownloadUrl: (id: string) => api.get(`/submissions/${id}/download-url`),
  getVersions: (id: string) => api.get(`/submissions/${id}/versions`),
};

export const aiApi = {
  getAnalysis: (submissionId: string) => api.get(`/ai-analysis/submission/${submissionId}`),
  getFindings: (analysisId: string, params?: any) => api.get(`/ai-analysis/${analysisId}/findings`, { params }),
  acceptFinding: (findingId: string, note?: string) => api.post(`/ai-analysis/findings/${findingId}/accept`, { note }),
  rejectFinding: (findingId: string, note: string) => api.post(`/ai-analysis/findings/${findingId}/reject`, { note }),
  startAnalysis: (submissionId: string) => api.post(`/ai-analysis/submission/${submissionId}/start`),
  startBatchAnalysis: (submissionIds: string[]) => api.post(`/ai-analysis/batch`, { submissionIds }),
  retryAnalysis: (submissionId: string) => api.post(`/ai-analysis/submission/${submissionId}/retry`),
};

export const reviewsApi = {
  start: (submissionId: string) => api.post(`/reviews/submission/${submissionId}/start`),
  get: (submissionId: string) => api.get(`/reviews/submission/${submissionId}`),
  addComment: (reviewId: string, data: any) => api.post(`/reviews/${reviewId}/comments`, data),
  updateChecklist: (reviewId: string, itemId: string, data: any) => api.patch(`/reviews/${reviewId}/checklist/${itemId}`, data),
  updateScores: (reviewId: string, data: any) => api.put(`/reviews/${reviewId}/scores`, data),
  finalize: (reviewId: string, data: any) => api.post(`/reviews/${reviewId}/finalize`, data),
};

export const dashboardApi = {
  getKPIs: (params?: any) => api.get('/dashboard/kpis', { params }),
  getByMonth: (year?: number) => api.get('/dashboard/submissions-by-month', { params: { year } }),
  getStatusDist: () => api.get('/dashboard/status-distribution'),
  getScoreDist: () => api.get('/dashboard/score-distribution'),
  getAdvisorWorkload: () => api.get('/dashboard/advisor-workload'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
};

export const templatesApi = {
  list: (programId?: string) => api.get('/templates', { params: { programId } }),
  get: (id: string) => api.get(`/templates/${id}`),
  upload: (formData: FormData) => api.post('/templates/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const programsApi = {
  list: () => api.get('/programs'),
};

export const notificationsApi = {
  list: (params?: any) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const reportsApi = {
  downloadIndividual: (submissionId: string) => api.get(`/reports/submission/${submissionId}`, { responseType: 'blob' }),
};

export const thesisGeneratorApi = {
  generateContent: (data: any) => api.post('/thesis-generator/generate', data),
  exportPdf: (data: any) => api.post('/thesis-generator/export/pdf', data, { responseType: 'blob' }),
};

export const usersApi = {
  list: (params?: any) => api.get('/users', { params }),
  get: (id: string) => api.get(`/users/${id}`),
  create: (data: any) => api.post('/users', data),
  update: (id: string, data: any) => api.put(`/users/${id}`, data),
  deactivate: (id: string) => api.patch(`/users/${id}/deactivate`),
};
