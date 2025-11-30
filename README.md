# Quiz-nettside (MVP)

This workspace contains a minimal shell for a quiz website:

- `backend/` - Node.js + Express API (port 4000)
- `frontend/` - Vite + React app (port 5173)

Run locally (PowerShell):

```powershell
cd .\backend
npm install
npm run dev

# in a second terminal
cd ..\frontend
npm install
npm run dev
```

Frontend will call `http://localhost:4000/api/ping` to check backend.

Fin the website running on localhost:5173 to start using the website
