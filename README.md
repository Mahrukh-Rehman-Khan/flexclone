# FLEX UMS

FAST National University — University Management System

## Setup & Run

### Backend
```
cd final-ums\backend
npm install
npm run seed
npm start
```
> `npm run seed` creates `flex_ums.sqlite` — run it **once**.  
> If you want a fresh database, delete `flex_ums.sqlite` and re-seed.

### Frontend (separate terminal)
```
cd final-ums\frontend
npm install
npm start
```

Backend → http://localhost:5000  
Frontend → http://localhost:3000

## Credentials

| Role    | Username | Password   |
|---------|----------|------------|
| Faculty | f001     | faculty123 |
| Admin   | admin001 | admin123   |
| HOD     | hod001   | hod123     |
| Finance | fin001   | finance123 |
| Student | 23L-3007 | student123 |

All 41 students use **student123** as their password.

## Database

Uses **sql.js** — pure JavaScript SQLite, no native compilation required.  
Works on Node.js v14 through v25+. Data stored in `flex_ums.sqlite`.

## WiFi attendance check

When a student scans the QR code the server compares their IP against  
the faculty's IP (captured when the QR was generated). Both must be on  
the same /24 subnet (e.g. 192.168.1.x = same WiFi).

- Testing locally: check is bypassed automatically (both on 127.0.0.1)
- On real network: student must be on the same WiFi as the faculty laptop
- Student on mobile data → rejected: "Not on the same network"
