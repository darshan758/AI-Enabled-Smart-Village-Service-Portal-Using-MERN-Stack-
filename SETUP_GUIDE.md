# 🌾 Smart Village — Complete Beginner Setup Guide

> **Read this from top to bottom. Do NOT skip steps. Every step matters.**

---

## 📁 FINAL FOLDER STRUCTURE

```
smart-village/
│
├── backend/
│   ├── config/
│   │   └── db.js                    ← MongoDB connection
│   ├── controllers/
│   │   ├── authController.js        ← Login/Register logic
│   │   ├── complaintController.js   ← Complaint logic
│   │   └── adminController.js       ← Admin logic
│   ├── middleware/
│   │   ├── authMiddleware.js        ← JWT verification
│   │   ├── uploadMiddleware.js      ← Multer file upload
│   │   └── errorMiddleware.js       ← Error handling
│   ├── models/
│   │   ├── User.js                  ← User database schema
│   │   ├── Complaint.js             ← Complaint schema
│   │   └── Notification.js         ← Notification schema
│   ├── routes/
│   │   ├── authRoutes.js            ← /api/auth routes
│   │   ├── complaintRoutes.js       ← /api/complaints routes
│   │   └── adminRoutes.js           ← /api/admin routes
│   ├── utils/
│   │   └── exifExtractor.js         ← GeoTag extraction from images
│   ├── uploads/                     ← Uploaded images saved here
│   ├── server.js                    ← Main backend entry point
│   ├── seed.js                      ← Script to create admin account
│   ├── package.json
│   └── .env                         ← Secret config (you create this)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── ComplaintCard.jsx
    │   │   ├── MapComponent.jsx
    │   │   ├── StatsCard.jsx
    │   │   └── LoadingSpinner.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx      ← Global login state
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── UserDashboard.jsx
    │   │   ├── AdminDashboard.jsx
    │   │   ├── ComplaintForm.jsx
    │   │   ├── ComplaintDetail.jsx
    │   │   ├── ComplaintTracking.jsx
    │   │   ├── ComplaintMap.jsx
    │   │   └── NotFound.jsx
    │   ├── utils/
    │   │   ├── api.js               ← Axios HTTP client
    │   │   └── helpers.js           ← Constants and utilities
    │   ├── App.jsx                  ← Routes
    │   ├── main.jsx                 ← React entry point
    │   └── index.css                ← Tailwind + custom styles
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

---

## 🖥️ STEP 1 — Install Required Software

Before writing any code, install these tools on your computer.

### 1A. Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (the green button)
3. Install it (just click Next → Next → Finish)
4. **Verify installation** — open any terminal and type:
   ```
   node --version
   ```
   You should see something like: `v20.11.0`

### 1B. Install VS Code

1. Go to https://code.visualstudio.com
2. Download and install it

### 1C. Install VS Code Extensions

Open VS Code → click the **Extensions** icon on the left (looks like 4 squares) → search and install:

| Extension Name | Why You Need It |
|---|---|
| **ES7+ React/Redux Snippets** | Code shortcuts for React |
| **Tailwind CSS IntelliSense** | Auto-complete for Tailwind classes |
| **Prettier - Code Formatter** | Auto-formats your code |
| **MongoDB for VS Code** | View your database inside VS Code |
| **Thunder Client** | Test your API endpoints |

### 1D. Install MongoDB

**Option A — MongoDB Atlas (Easiest, recommended for beginners):**
- Go to https://www.mongodb.com/cloud/atlas
- Click "Try Free" → Sign up for free
- Create a free cluster (M0 — Free tier)
- You'll get a connection string like:
  `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/smart_village`

**Option B — MongoDB Community (Local install):**
1. Go to https://www.mongodb.com/try/download/community
2. Download and install for your OS
3. Your connection string will be: `mongodb://localhost:27017/smart_village`

---

## 🛠️ STEP 2 — Create the Project Folder

### 2A. Open VS Code

1. Open VS Code
2. Go to **File → Open Folder**
3. Create a new folder called `smart-village` on your Desktop or Documents
4. Open that folder in VS Code

### 2B. Open the Terminal

In VS Code, press `Ctrl + `` ` `` (the backtick key, below Escape)
Or go to **Terminal → New Terminal**

You should see a terminal at the bottom of VS Code.

---

## 📦 STEP 3 — Set Up the Backend

Type these commands in the terminal **one at a time**, pressing Enter after each:

```bash
# Go into your project folder (if not already there)
cd smart-village

# Create the backend folder
mkdir backend

# Go into the backend folder
cd backend

# Create sub-folders
mkdir config controllers middleware models routes utils uploads

# Initialize Node.js project (creates package.json)
npm init -y
```

Now **install all backend packages** (this may take 1-2 minutes):

```bash
npm install express mongoose dotenv bcryptjs jsonwebtoken cors multer exifr express-validator socket.io uuid nodemailer
```

Then install the dev dependency:

```bash
npm install --save-dev nodemon
```

**What these packages do:**
- `express` — web server framework
- `mongoose` — connects to MongoDB
- `dotenv` — reads your .env file
- `bcryptjs` — encrypts passwords
- `jsonwebtoken` — creates login tokens (JWT)
- `cors` — allows frontend to talk to backend
- `multer` — handles image uploads
- `exifr` — reads GPS data from image EXIF metadata
- `express-validator` — validates form inputs
- `socket.io` — real-time notifications
- `uuid` — generates unique tracking IDs
- `nodemailer` — sends emails (optional)
- `nodemon` — auto-restarts server when you change code

---

## 🎨 STEP 4 — Set Up the Frontend

Open a **new terminal** in VS Code by pressing the `+` button in the terminal panel, then:

```bash
# Go back to project root (smart-village folder)
cd ..

# Create the frontend using Vite + React
npm create vite@latest frontend -- --template react

# Go into frontend folder
cd frontend

# Install all frontend packages
npm install

# Install additional packages
npm install axios react-router-dom react-hot-toast recharts socket.io-client lucide-react react-leaflet leaflet
```

**What these packages do:**
- `axios` — makes HTTP requests to the backend
- `react-router-dom` — handles page navigation
- `react-hot-toast` — shows notification popups
- `recharts` — draws charts and graphs
- `socket.io-client` — receives real-time updates
- `lucide-react` — beautiful icons
- `leaflet` + `react-leaflet` — interactive maps

**Install Tailwind CSS:**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 📝 STEP 5 — Create All Project Files

Now you need to copy the code from the generated files into VS Code.

> 💡 **Tip:** In VS Code, right-click a folder → "New File" to create files

### 5A. Create Backend Files

**Navigate to the `backend` folder** in VS Code Explorer (left panel).

---

#### FILE 1: `backend/.env`

This is your SECRET configuration file. Create a new file called `.env` inside the `backend` folder.

> ⚠️ IMPORTANT: The file name is just `.env` — starts with a dot, no extension.

Paste this content and **replace values** with your own:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/smart_village
JWT_SECRET=mySuperSecretKey2024SmartVillage
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:5173

ADMIN_EMAIL=admin@smartvillage.com
ADMIN_PASSWORD=Admin@123
```

> If you're using MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.
> Replace `JWT_SECRET` with any long random text. Never share this with anyone!

---

#### FILES 2-18: Copy the Generated Code

All other backend and frontend files have already been generated for you.

**For each file below, in VS Code:**
1. Click on the correct folder in the left panel
2. Right-click → "New File"
3. Type the filename
4. Copy the full code and paste it in

Here is the list of all files and their folder locations:

**BACKEND FILES:**

| File | Location |
|------|----------|
| `server.js` | `backend/` |
| `seed.js` | `backend/` |
| `config/db.js` | `backend/config/` |
| `models/User.js` | `backend/models/` |
| `models/Complaint.js` | `backend/models/` |
| `models/Notification.js` | `backend/models/` |
| `controllers/authController.js` | `backend/controllers/` |
| `controllers/complaintController.js` | `backend/controllers/` |
| `controllers/adminController.js` | `backend/controllers/` |
| `middleware/authMiddleware.js` | `backend/middleware/` |
| `middleware/uploadMiddleware.js` | `backend/middleware/` |
| `middleware/errorMiddleware.js` | `backend/middleware/` |
| `routes/authRoutes.js` | `backend/routes/` |
| `routes/complaintRoutes.js` | `backend/routes/` |
| `routes/adminRoutes.js` | `backend/routes/` |
| `utils/exifExtractor.js` | `backend/utils/` |

**FRONTEND FILES:**

| File | Location |
|------|----------|
| `index.html` | `frontend/` |
| `vite.config.js` | `frontend/` |
| `tailwind.config.js` | `frontend/` |
| `postcss.config.js` | `frontend/` |
| `src/index.css` | `frontend/src/` |
| `src/main.jsx` | `frontend/src/` |
| `src/App.jsx` | `frontend/src/` |
| `src/context/AuthContext.jsx` | `frontend/src/context/` |
| `src/utils/api.js` | `frontend/src/utils/` |
| `src/utils/helpers.js` | `frontend/src/utils/` |
| `src/components/Navbar.jsx` | `frontend/src/components/` |
| `src/components/ComplaintCard.jsx` | `frontend/src/components/` |
| `src/components/MapComponent.jsx` | `frontend/src/components/` |
| `src/components/StatsCard.jsx` | `frontend/src/components/` |
| `src/components/LoadingSpinner.jsx` | `frontend/src/components/` |
| `src/pages/Login.jsx` | `frontend/src/pages/` |
| `src/pages/Register.jsx` | `frontend/src/pages/` |
| `src/pages/UserDashboard.jsx` | `frontend/src/pages/` |
| `src/pages/AdminDashboard.jsx` | `frontend/src/pages/` |
| `src/pages/ComplaintForm.jsx` | `frontend/src/pages/` |
| `src/pages/ComplaintDetail.jsx` | `frontend/src/pages/` |
| `src/pages/ComplaintTracking.jsx` | `frontend/src/pages/` |
| `src/pages/ComplaintMap.jsx` | `frontend/src/pages/` |
| `src/pages/NotFound.jsx` | `frontend/src/pages/` |

---

### 5B. Update `package.json` in Backend

Open `backend/package.json`. Find the `"scripts"` section and replace it with:

```json
"scripts": {
  "start": "node server.js",
  "dev": "nodemon server.js",
  "seed": "node seed.js"
},
```

---

## 🍃 STEP 6 — Set Up MongoDB

### Option A: MongoDB Atlas (Cloud — Recommended)

1. Login to https://cloud.mongodb.com
2. Click **"Build a Database"** → Choose **Free (M0)**
3. Select a region close to you → Click **"Create"**
4. In **"Security"** → Create a database user:
   - Username: `smartvillage`
   - Password: choose a strong password
5. In **"Network Access"** → Add IP Address → **"Allow Access From Anywhere"** (for development)
6. Click **"Connect"** → **"Connect your application"**
7. Copy the connection string. It looks like:
   ```
   mongodb+srv://smartvillage:YourPassword@cluster0.abc123.mongodb.net/?retryWrites=true&w=majority
   ```
8. Replace `MONGO_URI` in your `.env` file with this string, and add the database name:
   ```
   MONGO_URI=mongodb+srv://smartvillage:YourPassword@cluster0.abc123.mongodb.net/smart_village?retryWrites=true&w=majority
   ```

### Option B: Local MongoDB

Make sure MongoDB is running on your computer, then use:
```
MONGO_URI=mongodb://localhost:27017/smart_village
```

---

## 👮 STEP 7 — Create the Admin Account

After setting up your `.env` file, run this **once** to create the admin:

```bash
# In the backend folder
cd backend
node seed.js
```

You should see:
```
✅ MongoDB connected
✅ Admin created successfully!
   Email   : admin@smartvillage.com
   Password: Admin@123
```

---

## 🚀 STEP 8 — Run the Project

You need **two terminals open at the same time**.

### Terminal 1 — Start the Backend

```bash
# In VS Code, open terminal (Ctrl + `)
cd backend
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
📡 Socket.IO ready
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
```

### Terminal 2 — Start the Frontend

Click the **`+`** button in the terminal panel to open a second terminal:

```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

### Open in Browser

Go to: **http://localhost:5173**

You should see the Smart Village login page! 🎉

---

## 🧪 STEP 9 — Test the Project

### Test 1: Register a New User

1. Go to http://localhost:5173
2. Click **"Register here"**
3. Fill in the form:
   - Name: `Ramesh Kumar`
   - Email: `ramesh@test.com`
   - Password: `Test@123`
   - Phone: `9876543210`
   - Village: `Mahadev Nagar`
4. Click **"Create Account"**
5. You should be redirected to the User Dashboard ✅

### Test 2: Login as Admin

1. Go to http://localhost:5173/login
2. Email: `admin@smartvillage.com`
3. Password: `Admin@123`
4. Click **"Sign In"**
5. You should see the Admin Dashboard with charts ✅

### Test 3: Submit a Complaint

1. Login as the regular user (`ramesh@test.com`)
2. Click **"Report New Issue"**
3. **Step 1 (Details):**
   - Title: `Broken street light on Main Road`
   - Category: `Street Light Damage`
   - Priority: `High`
   - Description: `The street light near the school has been broken for 2 weeks.`
   - Upload a photo (optional)
4. **Step 2 (Location):**
   - Click anywhere on the map to pin the location
5. **Step 3 (Review):**
   - Click **"Submit Complaint"**
6. You should see the complaint detail page with a unique **Tracking ID** ✅

### Test 4: Track a Complaint

1. Copy the tracking ID from the complaint (looks like `SV-ABC123-XY12`)
2. Log out → go to http://localhost:5173/track
3. Paste the tracking ID → Click **"Track"**
4. You should see the complaint status ✅

### Test 5: GeoTag Image Upload

1. Take a photo with your **phone's camera** (GPS must be ON on your phone)
2. Transfer it to your computer
3. When submitting a complaint, upload this photo
4. After submission, the complaint should automatically show the exact GPS location ✅

> 💡 If no GPS data is in the photo, you can manually click the map to set location.

### Test 6: Admin Update Status

1. Login as admin
2. Go to **Complaints** tab
3. Find a complaint → click the **eye icon** (👁)
4. Change status to **"In Progress"**
5. Add a note: `Team dispatched to inspect`
6. Click **"Update Status"**
7. Login as user → check their complaint → status should be updated ✅

---

## 🔧 API Endpoints Reference (for Thunder Client testing)

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get profile (auth required) |
| POST | `/api/complaints` | Submit complaint (auth + image) |
| GET | `/api/complaints/my` | Get my complaints |
| GET | `/api/complaints/track/:id` | Track by tracking ID |
| GET | `/api/admin/stats` | Dashboard stats (admin only) |
| GET | `/api/admin/complaints` | All complaints (admin only) |
| PUT | `/api/admin/complaints/:id/status` | Update status (admin only) |

---

## ❌ COMMON ERRORS AND FIXES

---

### Error 1: MongoDB Connection Error

**Error message:**
```
❌ MongoDB Error: connection refused
```

**Fix:**
1. If using Local MongoDB — make sure MongoDB service is running
   - Windows: Search "Services" → Find "MongoDB" → Start it
   - OR run: `mongod` in a terminal
2. If using Atlas — check your MONGO_URI in `.env` has correct username and password
3. Check that your IP is in Atlas Network Access whitelist

---

### Error 2: JWT Error / Unauthorized

**Error message:**
```
Invalid or expired token
```

**Fix:**
1. Clear browser localStorage: Open browser console → type `localStorage.clear()`
2. Re-login
3. Make sure `JWT_SECRET` in `.env` is set and not empty

---

### Error 3: CORS Error

**Error message in browser console:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Fix:**
1. Make sure `CLIENT_URL=http://localhost:5173` is in your `.env`
2. Make sure backend is running on port 5000
3. Make sure `vite.config.js` has the proxy configuration pointing to port 5000

---

### Error 4: npm install fails

**Error message:**
```
npm ERR! code ERESOLVE
```

**Fix:**
```bash
npm install --legacy-peer-deps
```

Or delete `node_modules` and `package-lock.json` and run `npm install` again:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

### Error 5: Image Upload Not Working

**Error message:**
```
Only image files are allowed
```

**Fix:**
1. Make sure you upload a JPEG, PNG, or WebP file (not PDF/video)
2. Check that the `uploads` folder exists in `backend/uploads/`
   - If it doesn't, create it manually: `mkdir backend/uploads`
3. File size must be under 10MB

---

### Error 6: GeoTag Not Detected

**This happens when:**
- The image was taken without GPS turned on
- The image was downloaded from the internet (GPS stripped)
- The image was taken in a building (poor GPS signal)

**Fix:**
- Manually click on the map in Step 2 to pin the location
- GeoTag only works with original photos taken on a phone with GPS enabled

---

### Error 7: Port Already in Use

**Error message:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Fix:**
```bash
# Find and kill the process using port 5000
# On Windows:
netstat -ano | findstr :5000
taskkill /PID <PID_NUMBER> /F

# On Mac/Linux:
lsof -ti:5000 | xargs kill -9
```
Then restart the backend.

---

### Error 8: Map Not Loading

**Symptom:** Map shows grey or broken

**Fix:**
1. Make sure Leaflet CSS is loaded — check `index.html` has:
   ```html
   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
   ```
2. Make sure you have internet connection (map tiles load from OpenStreetMap)
3. Hard refresh browser: `Ctrl + Shift + R`

---

### Error 9: "Cannot GET /api/..."

**Fix:**
- Make sure the backend is running (`npm run dev` in backend folder)
- Check the terminal for error messages
- Make sure you didn't change the port in server.js

---

### Error 10: Blank White Page on Frontend

**Fix:**
1. Open browser DevTools (F12) → Console tab
2. Read the error message
3. Common cause: missing file or wrong import path
4. Make sure ALL files are created with exact names (case-sensitive!)

---

## 📱 FEATURES SUMMARY

| Feature | Where to Find |
|---------|---------------|
| Register/Login | /login and /register |
| Submit complaint | /report (3-step form) |
| View my complaints | /dashboard |
| Track complaint | /track (public, no login needed) |
| View complaints on map | /map |
| GeoTag extraction | Automatic when uploading GPS photos |
| Admin dashboard | /admin (admin login only) |
| Admin charts | /admin → Overview tab |
| Manage complaints | /admin → Complaints tab |
| Manage users | /admin → Users tab |
| Real-time notifications | Via Socket.IO (auto) |
| Dark mode | Moon/Sun button in navbar |

---

## 🎓 YOU'RE DONE!

Your Smart Village app is now fully running.

**Quick reminder of how to start it every time:**

```bash
# Terminal 1
cd smart-village/backend
npm run dev

# Terminal 2
cd smart-village/frontend
npm run dev
```

Then open http://localhost:5173 in your browser.
