const BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : 'https://flexclone-production.up.railway.app/api';

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
  createCourse:   (data)     => req('POST',   '/courses', data),
  approveCourse:  (id)       => req('PATCH',  `/courses/${id}/approve`),
  getCourseApprovals: ()      => req('GET',    '/courses/approvals'),
  updateRegistrationStatus: (id, status, remarks) => req('PATCH', `/courses/registrations/${id}/status`, { status, remarks }),

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
  getMyMarks:        ()                             => req('GET',    '/marks/my'),
  getMyMarksCourses: ()                             => req('GET',    '/marks/faculty-courses'),
  getCourseMarks:    (courseId)                     => req('GET',    `/marks/course/${courseId}`),
  addAssessmentGroup:    (courseId, category, label, weightage) => req('POST',   '/marks/groups',              { courseId, category, label, weightage }),
  editAssessmentGroup:   (id, label, weightage)     => req('PATCH',  `/marks/groups/${id}`,        { label, weightage }),
  deleteAssessmentGroup: (id)                       => req('DELETE', `/marks/groups/${id}`),
  addAssessmentComponent:    (groupId, label, totalMarks) => req('POST',   '/marks/components',          { groupId, label, totalMarks }),
  editAssessmentComponent:   (id, label, totalMarks)     => req('PATCH',  `/marks/components/${id}`,    { label, totalMarks }),
  deleteAssessmentComponent: (id)                        => req('DELETE', `/marks/components/${id}`),
  saveMarks: (componentId, marks)                   => req('POST',   `/marks/components/${componentId}/marks`, { marks }),

  // Fee
  getMyFee:  ()         => req('GET',   '/fee/my'),
  getAllFee:  ()         => req('GET',   '/fee/all'),
  payFee:    (id, data) => req('PATCH', `/fee/${id}/pay`, data),
  createChallan: (data) => req('POST',  '/fee/challans', data),

  // Requests
  getRequestTypes:     ()                    => req('GET',   '/requests/types'),
  getMyRequests:       ()                    => req('GET',   '/requests/my'),
  submitRequest:       (type, justification) => req('POST',  '/requests', { type, justification }),
  getAllRequests:       ()                    => req('GET',   '/requests/all'),
  updateRequestStatus: (id, status, remarks) => req('PATCH', `/requests/${id}/status`, { status, remarks }),
  getRequestEvents:    (id)                  => req('GET',   `/requests/${id}/events`),

  // Notifications
  getNotifications: () => req('GET', '/notifications'),
  markNotificationRead: (id) => req('PATCH', `/notifications/${id}/read`),

  // Admin
  getUsers:     () => req('GET',  '/admin/users'),
  createUser:   (data) => req('POST',   '/admin/users',    data),
  deleteUser:   (id)   => req('DELETE', `/admin/users/${id}`),
  getAuditLogs: () => req('GET', '/admin/audit-logs'),
  getStats:     () => req('GET', '/admin/stats'),
  getSettings:  () => req('GET', '/admin/settings'),
  updateSettings: (data) => req('PATCH', '/admin/settings', data),
  resetUserPassword: (id, password) => req('POST', `/admin/users/${id}/reset-password`, { password }),
  updateUserFlags: (id, data) => req('PATCH', `/admin/users/${id}/flags`, data),
  getHealth: () => req('GET', '/admin/health'),
  initializeSemester: (semester) => req('POST', '/admin/semester/initialize', { semester }),

  // Timetable
  getMyTimetable: () => req('GET', '/timetable/my'),
  getAllTimetable: () => req('GET', '/timetable/all'),

  // Reports
  getReportSummary: () => req('GET', '/reports/summary'),
  getStudentReport: (params = {}) => req('GET', `/reports/students?${new URLSearchParams(params).toString()}`),
  exportReport: (kind) => req('GET', `/reports/export/${kind}`),
};
