# FINDMYTHING - Modern College Campus Lost & Found Web Application

FINDMYTHING is a complete, modern, responsive lost and found application engineered specifically for collegiate campus communities. It provides an intuitive, high-efficiency system for reporting lost belongings, searching recovered items, verifying rightful ownership with confidential trait matching, and coordinating safe drop-offs across campus safety depots.

The platform is powered by the **modular Firebase JavaScript SDK (v11)** for Authentication and Cloud Firestore real-time database, with client-side image selection and local object URL previews (operating completely without Firebase Cloud Storage dependencies).

---

## 🚀 Key Highlights & Architectural Decisions

- **Pure Web Standards**: Built exclusively using **semantic HTML5, modern modular CSS3, and vanilla JavaScript** (ES6+ Modules). Zero external frameworks or heavy runtime bundler dependencies.
- **Firebase Authentication**: Student registration with campus email (`.edu`), secure login, logout, password resets, and email verification workflows.
- **Role-Based Access Control (RBAC)**: Secure separation between `student` and `admin` roles. Users cannot assign themselves admin privileges; rights are verified strictly through Cloud Firestore security rules.
- **Cloud Firestore Database**: Real-time collections for `users`, `lost_items`, `found_items`, `claims`, and `notifications`. Multi-user real-time synchronization via `onSnapshot` listeners.
- **Storage-Free Architecture (No Firebase Cloud Storage Required)**:
  - Users can select item photos from their computer and instantly preview them locally in their browser using Browser Object URLs (`URL.createObjectURL(file)`).
  - No photographs or binaries are uploaded to Firebase Cloud Storage, eliminating storage billing, bucket CORS configuration, or complex blob rule setups.
  - Lost and found reports are stored directly in Cloud Firestore with preset or standard campus imagery.
- **Confidential Ownership Verification**: Secret distinctive marks (serials, engravings, wallpapers, internal bag contents) are protected from public listings and viewable only by authorized Campus Safety Admins and original reporters.
- **Admin Claims Management Hub**: Dedicated interface allowing authorized Campus Safety staff to cross-examine student proof against intake records, approve or reject claims, append audit notes, and trigger status updates.
- **Zero-Dependency SVG Iconography**: Self-contained SVG icons for fast offline loads, sharp rendering, and accessible markup.
- **Dual-Mode Operation**: When Firebase credentials are supplied in `firebase-config.js`, the app runs live on Firebase Authentication & Firestore. If unconfigured or offline, it gracefully operates in local preview mode without crashing.

---

## 📂 Project Structure

```
findmything/
├── index.html            # Semantic HTML5 layout (Dashboard, Directories, Report, Modals)
├── styles.css            # Responsive CSS Design System, tokens, badges, alert banners, print styles
├── data.js               # 16+ realistic college sample items, categories, and campus locations
├── firebase-config.js    # Firebase modular SDK initialization & credentials config (Auth & Firestore)
├── firebase-service.js   # Service layer: Auth, Firestore database, real-time listeners, validation
├── firestore.rules       # Cloud Firestore security rules enforcing RBAC and data confidentiality
├── app.js                # Application controller, routing, DOM manipulation, test runner
└── README.md             # Complete documentation and deployment guide
```

---

## 🔒 Cloud Database Architecture

### Firestore Collections
- **`users/{userId}`**:
  - `uid`, `email`, `displayName`, `role` (`student` | `admin`), `studentId`, `phone`, `createdAt`, `emailVerified`.
  - *Security*: Users can only read their own profile. On registration, `role` is strictly constrained to `'student'`. Only existing admins can alter roles.
- **`lost_items/{itemId}`**:
  - `id`, `title`, `type` (`lost`), `category`, `location`, `specificLocation`, `date`, `time`, `status` (`active` | `resolved`), `urgency`, `reward`, `description`, `distinctiveMarks`, `contactName`, `contactEmail`, `contactPhone`, `image`, `reporterUid`, `createdAt`.
- **`found_items/{itemId}`**:
  - `id`, `title`, `type` (`found`), `category`, `location`, `specificLocation`, `date`, `time`, `status` (`active` | `resolved`), `urgency`, `handoverStation`, `description`, `distinctiveMarks`, `contactName`, `contactEmail`, `contactPhone`, `image`, `reporterUid`, `createdAt`.
- **`claims/{claimId}`**:
  - `id`, `itemId`, `itemTitle`, `itemType`, `itemCollection`, `claimantUid`, `claimantName`, `claimantEmail`, `claimantStudentId`, `proof` (confidential answers), `pickupTime`, `status` (`pending` | `approved` | `rejected`), `adminNotes`, `reviewedBy`, `reviewedAt`, `createdAt`.
  - *Security*: Only the claimant and admins can read a claim. Only admins can approve or reject claims.
- **`notifications/{notificationId}`**:
  - `userId`, `title`, `message`, `type`, `read`, `createdAt`, `link`.

---

## ⚙️ Firebase Setup & Configuration Guide

Setting up FINDMYTHING requires only **Authentication** and **Cloud Firestore** (no Cloud Storage setup needed):

### Step 1: Create a Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and give it a project name (e.g., `findmything-campus`).
3. (Optional) Disable Google Analytics, then click **Create Project**.

### Step 2: Enable Authentication
1. In the Firebase Console left sidebar, click **Build** &rarr; **Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable the first toggle (**Email/Password**), then click **Save**.

### Step 3: Enable Cloud Firestore Database
1. In the left sidebar, click **Build** &rarr; **Firestore Database**.
2. Click **Create Database**.
3. Select your preferred Cloud location (e.g., `nam5 (us-central)`).
4. Choose **Start in production mode** or **Start in test mode**, then click **Create**.

### Step 4: Register Your Web App & Insert Credentials
1. In the Firebase Console, click the **Settings gear icon (⚙)** next to *Project Overview* &rarr; **Project settings**.
2. In the **General** tab, scroll down to the **Your apps** section.
3. Click the Web icon ( **`</>`** ).
4. Enter an app nickname (e.g., `findmything-web`) and click **Register app**.
5. Copy the `firebaseConfig` object and paste your credentials into `firebase-config.js`:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

### Step 5: Deploy Security Rules
Deploy `firestore.rules` using the Firebase CLI or directly in the Firebase Console:

#### Option A: Via Firebase Console (Zero-CLI)
1. Go to **Firestore Database** &rarr; **Rules** tab.
2. Paste the entire contents of `firestore.rules`.
3. Click **Publish**.

#### Option B: Via Firebase CLI
```bash
firebase deploy --only firestore:rules
```

### Step 6: Assigning Admin Privileges
To maintain campus security, new accounts are created with standard `student` role by default. To assign Admin privileges:
1. Register a student account in the app with your staff email (e.g., `safety.admin@campus.edu`).
2. Go to Firebase Console &rarr; **Firestore Database** &rarr; **`users`** collection.
3. Locate the document corresponding to your account UID.
4. Edit the `role` field from `"student"` to `"admin"`.
5. Refresh the app. The header will now display the **`⚙ Admin Claims`** badge and unlock the Claims Review Hub.

---

## 📷 Image Selection & Browser Object URL Preview (Limitation Notice)

> [!NOTE]
> **Cloud Storage Dependency Removed**:
> - Users can select photographs of their belongings on the report form and view an instant high-fidelity local preview generated via `URL.createObjectURL(file)`.
> - The application does not upload binary images to Firebase Cloud Storage.
> - Reports recorded in Cloud Firestore reference lightweight preset or category-matched campus imagery for cross-device consistency, while preserving memory safety through automatic object URL revocation (`URL.revokeObjectURL`).
> - This completely removes any need to configure or pay for Firebase Storage buckets or storage security rules.

---

## 💻 Running the Application Locally

Because the application uses native modular ES6 JavaScript (`import ... from '...'`), modern browsers require the application to be served over HTTP/HTTPS (not `file:///` due to browser CORS policies on module imports).

### Using Node.js (Recommended)
```powershell
npx serve D:\PROJECTS\FINDMYTHING
# Or: npx http-server D:\PROJECTS\FINDMYTHING -p 3000
```

### Using Python
```powershell
cd D:\PROJECTS\FINDMYTHING
python -m http.server 8080
```

### Using VS Code / IDE
Right-click `index.html` and select **"Open with Live Server"**.

Open your browser at `http://localhost:3000` (or `http://localhost:8080`).

---

## 🧪 Testing & Verification

1. Open the application in your browser.
2. In the footer, click **"Run System Tests"** or open the browser Developer Console (`F12`) and run:
   ```javascript
   await FMT.runTests();
   ```
3. The automated test suite executes 11 comprehensive automated checks covering:
   - Firebase configuration detection (Auth & Firestore)
   - Catalog data loading
   - Category and campus facility population
   - Lost vs. Found item partitioning
   - Search matching engine
   - Photograph file type (MIME) and size limit (< 5MB) validation
   - Browser Object URL (`URL.createObjectURL`) generation for local preview
   - Confidential traits masking in public views
   - Item detail modal rendering
   - Authentication modal tab toggling
   - Claim verification modal submission
   - Hash-based view routing
