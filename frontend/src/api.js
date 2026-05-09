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

// Get GPS location — returns { lat, lon } or null if denied
export function getLocation(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      ()    => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
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

  // Attendance — QR (now includes location)
  createQrSession: (courseId, date, lat, lon) => req('POST', '/attendance/qr/create', { courseId, date, lat, lon }),
  getQrStatus:     (token)                    => req('GET',  `/attendance/qr/status/${token}`),
  scanQrCode:      (token, lat, lon)          => req('POST', '/attendance/qr/scan', { token, lat, lon }),
  endQrSession:    (token)                    => req('POST', '/attendance/qr/end', { token }),

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