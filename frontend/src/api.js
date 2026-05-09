const BASE = 'https://flexclone-production.up.railway.app/api';

function getToken() { return localStorage.getItem('flex_token'); }

async function req(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login:  (username, password) => req('POST', '/auth/login', { username, password }),
  me:     ()                   => req('GET',  '/auth/me'),
  logout: ()                   => req('POST', '/auth/logout'),

  // Courses
  getCourses:     ()         => req('GET',    '/courses'),
  getMyCourses:   ()         => req('GET',    '/courses/my'),
  registerCourse: (courseId) => req('POST',   '/courses/register', { courseId }),
  dropCourse:     (courseId) => req('DELETE', `/courses/register/${courseId}`),

  // Attendance — core
  getMyAttendance:     ()                        => req('GET',    '/attendance/my'),
  getCourseAttendance: (courseId)                => req('GET',    `/attendance/course/${courseId}`),
  markAttendance:      (courseId, date, records) => req('POST',   '/attendance/mark', { courseId, date, records }),
  deleteAttendance:    (courseId, date)          => req('DELETE', `/attendance/${courseId}/${date}`),
  exportAttendance:    (courseId)                => req('GET',    `/attendance/export/${courseId}`),

  // Attendance — QR
  createQrSession: (courseId, date) => req('POST', '/attendance/qr/create', { courseId, date }),
  getQrStatus:     (token)          => req('GET',  `/attendance/qr/status/${token}`),
  scanQrCode:      (token)          => req('POST', '/attendance/qr/scan', { token }),
  endQrSession:    (token)          => req('POST', '/attendance/qr/end', { token }),

  // Marks
  getMyMarks: () => req('GET',  '/marks/my'),
  saveMark:   (d) => req('POST', '/marks', d),

  // Fee
  getMyFee:  ()         => req('GET',   '/fee/my'),
  getAllFee:  ()         => req('GET',   '/fee/all'),
  payFee:    (id, data) => req('PATCH', `/fee/${id}/pay`, data),

  // Requests
  getRequestTypes:     ()                    => req('GET',   '/requests/types'),
  getMyRequests:       ()                    => req('GET',   '/requests/my'),
  submitRequest:       (type, justification) => req('POST',  '/requests', { type, justification }),
  getAllRequests:       ()                    => req('GET',   '/requests/all'),
  updateRequestStatus: (id, status, remarks) => req('PATCH', `/requests/${id}/status`, { status, remarks }),

  // Notifications
  getNotifications: () => req('GET', '/notifications'),

  // Admin
  getUsers:     () => req('GET', '/admin/users'),
  getAuditLogs: () => req('GET', '/admin/audit-logs'),
  getStats:     () => req('GET', '/admin/stats'),
};
