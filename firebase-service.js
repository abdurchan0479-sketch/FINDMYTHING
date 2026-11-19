/**
 * FINDMYTHING - Firebase Service Layer
 * 
 * Provides clean, modular abstractions for:
 * 1. Student & Admin Authentication (Registration, Login, Email Verification, Roles)
 * 2. Cloud Firestore Database (Lost Items, Found Items, Claims, Notifications)
 * 3. Firebase Storage (Photograph uploads with validation)
 * 4. Real-time synchronizations with fallback mode
 */

import {
  isFirebaseConfigured,
  auth,
  db
} from './firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js';

// --- State Cache ---
let currentUser = null;
let currentUserProfile = null;
const authListeners = new Set();

/**
 * Check if current logged-in user has Admin role
 */
export function isAdmin() {
  return currentUserProfile && currentUserProfile.role === 'admin';
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserProfile() {
  return currentUserProfile;
}

// ============================================================================
// 1. AUTHENTICATION MODULE
// ============================================================================

/**
 * Register a new student account
 * Strictly forces role to 'student' to prevent privilege self-assignment.
 */
export async function registerStudent({ email, password, displayName, studentId, phone }) {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      unconfigured: true,
      message: 'Firebase is not yet configured. Please insert your credentials in firebase-config.js.'
    };
  }

  // Validate email domain recommendation / format
  if (!email || !email.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }

  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Set Firebase Auth display name
    await updateProfile(user, { displayName: displayName || email.split('@')[0] });

    // 3. Send email verification
    try {
      await sendEmailVerification(user);
    } catch (verifErr) {
      console.warn('[FINDMYTHING] Email verification dispatch notice:', verifErr);
    }

    // 4. Store user profile in Firestore
    // Enforce role: 'student' (Users CANNOT assign themselves admin privileges!)
    const userDocRef = doc(db, 'users', user.uid);
    const profileData = {
      uid: user.uid,
      email: user.email,
      displayName: displayName || user.email.split('@')[0],
      role: 'student', // ALWAYS forced to 'student'
      studentId: studentId || '',
      phone: phone || '',
      createdAt: serverTimestamp(),
      emailVerified: user.emailVerified
    };

    await setDoc(userDocRef, profileData);

    currentUser = user;
    currentUserProfile = profileData;

    return {
      success: true,
      user,
      profile: profileData,
      verificationSent: true
    };
  } catch (error) {
    console.error('[FINDMYTHING] Registration error:', error);
    throw error;
  }
}

/**
 * Student & Admin Login
 */
export async function loginUser({ email, password }) {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      unconfigured: true,
      message: 'Firebase is not yet configured. Please insert your credentials in firebase-config.js.'
    };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Load profile from Firestore
    let profile = null;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        profile = snap.data();
      } else {
        // Fallback for pre-existing accounts
        profile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: 'student',
          studentId: '',
          phone: '',
          createdAt: serverTimestamp(),
          emailVerified: user.emailVerified
        };
        await setDoc(userDocRef, profile);
      }
    } catch (pErr) {
      console.warn('[FINDMYTHING] Failed to fetch user profile document:', pErr);
      profile = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        role: 'student',
        emailVerified: user.emailVerified
      };
    }

    currentUser = user;
    currentUserProfile = profile;

    return {
      success: true,
      user,
      profile
    };
  } catch (error) {
    console.error('[FINDMYTHING] Login error:', error);
    throw error;
  }
}

/**
 * Logout
 */
export async function logoutUser() {
  if (!isFirebaseConfigured()) {
    currentUser = null;
    currentUserProfile = null;
    return { success: true };
  }

  try {
    await signOut(auth);
    currentUser = null;
    currentUserProfile = null;
    return { success: true };
  } catch (error) {
    console.error('[FINDMYTHING] Logout error:', error);
    throw error;
  }
}

/**
 * Resend Email Verification
 */
export async function resendVerificationEmail() {
  if (!isFirebaseConfigured() || !auth.currentUser) {
    throw new Error('No authenticated user or Firebase is unconfigured.');
  }

  await sendEmailVerification(auth.currentUser);
  return { success: true };
}

/**
 * Password Reset
 */
export async function sendPasswordReset(email) {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not yet configured.');
  }

  await sendPasswordResetEmail(auth, email);
  return { success: true };
}

/**
 * Subscribe to Auth State Changes
 */
export function onAuthChanged(callback) {
  authListeners.add(callback);

  if (!isFirebaseConfigured()) {
    // Notify with null user if Firebase is unconfigured
    callback(null, null);
    return () => authListeners.delete(callback);
  }

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          currentUserProfile = snap.data();
        } else {
          currentUserProfile = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email.split('@')[0],
            role: 'student',
            emailVerified: user.emailVerified
          };
        }
      } catch (err) {
        console.warn('[FINDMYTHING] Error loading user profile:', err);
        currentUserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          role: 'student',
          emailVerified: user.emailVerified
        };
      }
    } else {
      currentUserProfile = null;
    }

    callback(currentUser, currentUserProfile);
  });

  return () => {
    authListeners.delete(callback);
    unsubscribe();
  };
}

// ============================================================================
// 2. CLIENT-SIDE IMAGE VALIDATION (No Storage Dependency)
// ============================================================================

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate an image file before local object URL preview
 */
export function validateImageFile(file) {
  if (!file) {
    return { valid: true }; // Optional image
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file format. Please upload a JPEG, PNG, WEBP, or GIF image.'
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${sizeMb} MB). Maximum allowed size is 5 MB.`
    };
  }

  return { valid: true };
}

// ============================================================================
// 3. CLOUD FIRESTORE: ITEMS (Lost & Found Reports)
// ============================================================================

/**
 * Create a new Lost Item report in Firestore (Storage-free)
 */
export async function createLostItem(itemData) {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      unconfigured: true,
      message: 'Firebase is not yet configured.'
    };
  }

  if (!auth.currentUser) {
    throw new Error('Authentication required: Please sign in to submit a report.');
  }

  const docData = {
    ...itemData,
    image: itemData.image || "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80",
    type: 'lost',
    status: itemData.status || 'active',
    reporterUid: auth.currentUser.uid,
    reporterEmail: auth.currentUser.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = doc(db, 'lost_items', itemData.id);
  await setDoc(docRef, docData);

  return { success: true, item: { ...docData, id: itemData.id } };
}

/**
 * Create a new Found Item report in Firestore (Storage-free)
 */
export async function createFoundItem(itemData) {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      unconfigured: true,
      message: 'Firebase is not yet configured.'
    };
  }

  if (!auth.currentUser) {
    throw new Error('Authentication required: Please sign in to submit a report.');
  }

  const docData = {
    ...itemData,
    image: itemData.image || "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80",
    type: 'found',
    status: itemData.status || 'active',
    reporterUid: auth.currentUser.uid,
    reporterEmail: auth.currentUser.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = doc(db, 'found_items', itemData.id);
  await setDoc(docRef, docData);

  return { success: true, item: { ...docData, id: itemData.id } };
}

/**
 * Report that an authenticated student found a reported lost item
 * 1. Validates authentication & prevents duplicate submissions
 * 2. Creates a corresponding record in 'found_items' linked to the lost item
 * 3. Updates the original lost item in 'lost_items' with status 'found' and timestamps
 * 4. Dispatches a real-time notification to the original reporter's UID
 */
export async function reportFoundSighting(lostItem, { handoverStation, finderNote } = {}) {
  if (!lostItem || !lostItem.id) {
    throw new Error('Invalid lost item reference.');
  }

  // Prevent duplicate found status
  if (lostItem.status === 'found' || lostItem.status === 'resolved') {
    throw new Error('This item has already been marked as found or resolved.');
  }

  const rawId = String(lostItem.id).replace(/^LST-/, '');
  const foundItemId = 'FND-' + rawId;

  if (!isFirebaseConfigured()) {
    // Local fallback mode when Firebase credentials are not yet configured
    const finderUid = (auth && auth.currentUser) ? auth.currentUser.uid : 'student-local';
    const finderEmail = (auth && auth.currentUser) ? auth.currentUser.email : 'student@campus.edu';
    const finderName = (currentUserProfile && currentUserProfile.displayName) ||
      (auth && auth.currentUser && auth.currentUser.displayName) ||
      finderEmail.split('@')[0] || 'Campus Student';

    const localFoundDoc = {
      id: foundItemId,
      originalLostItemId: lostItem.id,
      originalReporterUid: lostItem.reporterUid || '',
      originalReporterEmail: lostItem.reporterEmail || '',
      originalReporterName: lostItem.contactName || '',
      type: 'found',
      status: 'active',
      title: lostItem.title,
      category: lostItem.category,
      location: lostItem.location,
      specificLocation: lostItem.specificLocation || '',
      date: new Date().toISOString().split('T')[0],
      image: lostItem.image || "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80",
      description: finderNote || lostItem.description || `Found item matching lost report #${lostItem.id}.`,
      distinctiveMarks: lostItem.distinctiveMarks || '',
      reward: lostItem.reward || '',
      handoverStation: handoverStation || lostItem.handoverStation || 'Campus Lost & Found Central Desk',
      reporterUid: finderUid,
      reporterEmail: finderEmail,
      contactName: finderName,
      contactEmail: finderEmail,
      contactPhone: (currentUserProfile && currentUserProfile.phone) || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return {
      success: true,
      localOnly: true,
      foundItemId: foundItemId,
      foundItem: localFoundDoc
    };
  }

  if (!auth.currentUser) {
    throw new Error('Authentication required: Please sign in to report finding this item.');
  }

  const finderUid = auth.currentUser.uid;
  const finderEmail = auth.currentUser.email || '';
  const finderName = (currentUserProfile && currentUserProfile.displayName) ||
    auth.currentUser.displayName ||
    finderEmail.split('@')[0] || 'Campus Student';

  // Check if found record already exists in Firestore to prevent duplicate submissions
  const foundDocRef = doc(db, 'found_items', foundItemId);
  const existingSnap = await getDoc(foundDocRef);
  if (existingSnap.exists()) {
    throw new Error(`A found report (#${foundItemId}) has already been recorded for this item.`);
  }

  const foundItemData = {
    id: foundItemId,
    originalLostItemId: lostItem.id,
    originalReporterUid: lostItem.reporterUid || '',
    originalReporterEmail: lostItem.reporterEmail || '',
    originalReporterName: lostItem.contactName || '',
    type: 'found',
    status: 'active',
    title: lostItem.title,
    category: lostItem.category,
    location: lostItem.location,
    specificLocation: lostItem.specificLocation || '',
    date: new Date().toISOString().split('T')[0],
    image: lostItem.image || "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=600&q=80",
    description: finderNote || lostItem.description || `Reported found by ${finderName} matching lost report #${lostItem.id}.`,
    distinctiveMarks: lostItem.distinctiveMarks || '',
    reward: lostItem.reward || '',
    handoverStation: handoverStation || lostItem.handoverStation || 'Campus Lost & Found Central Desk',
    reporterUid: finderUid,
    reporterEmail: finderEmail,
    contactName: finderName,
    contactEmail: finderEmail,
    contactPhone: (currentUserProfile && currentUserProfile.phone) || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // 1. Create the new found record in 'found_items' collection
  await setDoc(foundDocRef, foundItemData);

  // 2. Update the original lost item document with found status and finder info
  const lostDocRef = doc(db, 'lost_items', lostItem.id);
  await updateDoc(lostDocRef, {
    status: 'found',
    foundAt: serverTimestamp(),
    finderUid: finderUid,
    finderName: finderName,
    linkedFoundItemId: foundItemId,
    updatedAt: serverTimestamp()
  });

  // 3. Dispatch a real-time notification to the original reporter's UID
  if (lostItem.reporterUid && lostItem.reporterUid !== finderUid) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: lostItem.reporterUid,
        title: 'Great News! Your Lost Item Was Found 🎉',
        message: `${finderName} reported finding your "${lostItem.title}". It has been logged as Found Item #${foundItemId} at ${foundItemData.handoverStation}.`,
        type: 'item_found',
        link: `#found`,
        relatedItemId: foundItemId,
        originalLostItemId: lostItem.id,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (nErr) {
      console.warn('[FINDMYTHING] Sighting notification dispatch notice:', nErr);
    }
  }

  return {
    success: true,
    foundItemId: foundItemId,
    foundItem: foundItemData
  };
}

/**
 * Subscribe to real-time Lost Items
 */
export function subscribeLostItems(callback, onError) {
  if (!isFirebaseConfigured()) {
    return () => { };
  }

  const q = collection(db, 'lost_items');
  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          ...data,
          id: docSnap.id,
          collection: 'lost_items'
        });
      });
      callback(items);
    },
    (err) => {
      console.error('[FINDMYTHING] Error in lost_items subscription:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribe to real-time Found Items
 */
export function subscribeFoundItems(callback, onError) {
  if (!isFirebaseConfigured()) {
    return () => { };
  }

  const q = collection(db, 'found_items');
  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          ...data,
          id: docSnap.id,
          collection: 'found_items'
        });
      });
      callback(items);
    },
    (err) => {
      console.error('[FINDMYTHING] Error in found_items subscription:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Update an item's status (active, resolved, claimed)
 */
export async function updateItemStatus(item, newStatus) {
  if (!isFirebaseConfigured()) {
    item.status = newStatus;
    return { success: true, localOnly: true };
  }

  if (!auth.currentUser) {
    throw new Error('Authentication required to modify reports.');
  }

  const collectionName = item.collection || (item.type === 'lost' ? 'lost_items' : 'found_items');
  const docRef = doc(db, collectionName, item.id);

  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: serverTimestamp(),
    resolvedBy: auth.currentUser.uid
  });

  return { success: true };
}

/**
 * Delete a report (only permitted for the author or an admin)
 */
export async function deleteItem(item) {
  if (!isFirebaseConfigured()) {
    return { success: true, localOnly: true };
  }

  if (!auth.currentUser) {
    throw new Error('Authentication required.');
  }

  const collectionName = item.collection || (item.type === 'lost' ? 'lost_items' : 'found_items');
  const docRef = doc(db, collectionName, item.id);
  await deleteDoc(docRef);

  return { success: true };
}

// ============================================================================
// 4. CLOUD FIRESTORE: OWNERSHIP VERIFICATION CLAIMS
// ============================================================================

/**
 * Submit an ownership verification claim for a found item
 * Confidential answers are stored securely in Firestore /claims
 */
export async function submitClaim({ itemId, itemTitle, itemType, itemCollection, proof, studentId, pickupTime }) {
  if (!isFirebaseConfigured()) {
    return {
      success: false,
      unconfigured: true,
      ticketNumber: `CLM-${Math.floor(100000 + Math.random() * 900000)}`,
      message: 'Claim recorded in local preview session.'
    }
  }

  if (!auth.currentUser) {
    throw new Error('You must be signed in to submit an ownership claim.');
  }

  if (!proof || proof.trim().length < 5) {
    throw new Error('Please describe distinctive traits or proof only the owner would know.');
  }

  if (!studentId || studentId.trim().length === 0) {
    throw new Error('Your Student ID is required for verification.');
  }

  const claimId = `CLM-${Date.now()}`;
  const claimData = {
    id: claimId,
    itemId: itemId,
    itemTitle: itemTitle,
    itemType: itemType || 'found',
    itemCollection: itemCollection || 'found_items',
    claimantUid: auth.currentUser.uid,
    claimantName: auth.currentUser.displayName || currentUserProfile?.displayName || 'Campus Student',
    claimantEmail: auth.currentUser.email,
    claimantStudentId: studentId.trim(),
    proof: proof.trim(), // Confidential verification answers
    pickupTime: pickupTime || 'today-afternoon',
    status: 'pending', // Strictly initialized as 'pending'
    adminNotes: '',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: serverTimestamp()
  };

  const docRef = doc(db, 'claims', claimId);
  await setDoc(docRef, claimData);

  // Notify admins of new pending claim
  try {
    await addDoc(collection(db, 'notifications'), {
      targetRole: 'admin',
      userId: 'admin',
      title: 'New Ownership Claim Submitted',
      message: `${claimData.claimantName} filed claim #${claimId} for "${itemTitle}".`,
      type: 'new_claim',
      link: `#admin-claims`,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (nErr) {
    console.warn('[FINDMYTHING] Admin notification dispatch notice:', nErr);
  }

  return {
    success: true,
    ticketNumber: claimId,
    claim: claimData
  };
}

/**
 * Subscribe to claims
 * If user is Admin -> receives all claims across campus
 * If user is Student -> receives only their own submitted claims
 */
export function subscribeClaims(callback, onError) {
  if (!isFirebaseConfigured() || !auth.currentUser) {
    return () => { };
  }

  let q;
  if (isAdmin()) {
    q = collection(db, 'claims');
  } else {
    q = query(collection(db, 'claims'), where('claimantUid', '==', auth.currentUser.uid));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const claims = [];
      snapshot.forEach((docSnap) => {
        claims.push({ ...docSnap.data(), id: docSnap.id });
      });
      // Sort in memory by date descending
      claims.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      callback(claims);
    },
    (err) => {
      console.error('[FINDMYTHING] Claims subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Admin action: Approve or Reject a claim
 * Only authorized admins can invoke this
 */
export async function reviewClaim(claimId, decision, adminNotes = '', claimData = null) {
  if (!isFirebaseConfigured()) {
    return { success: true, localOnly: true };
  }

  if (!isAdmin()) {
    throw new Error('Unauthorized: Only campus administrators can approve or reject claims.');
  }

  if (!['approved', 'rejected'].includes(decision)) {
    throw new Error('Invalid claim decision. Must be "approved" or "rejected".');
  }

  const claimRef = doc(db, 'claims', claimId);
  const updatePayload = {
    status: decision,
    adminNotes: adminNotes || '',
    reviewedBy: auth.currentUser.displayName || auth.currentUser.email,
    reviewedAt: serverTimestamp()
  };

  await updateDoc(claimRef, updatePayload);

  // If approved, mark the corresponding item as 'resolved' / 'claimed'
  if (decision === 'approved' && claimData && claimData.itemId) {
    try {
      const collName = claimData.itemCollection || (claimData.itemType === 'lost' ? 'lost_items' : 'found_items');
      const itemRef = doc(db, collName, claimData.itemId);
      await updateDoc(itemRef, {
        status: 'resolved',
        claimedBy: claimData.claimantUid,
        resolvedAt: serverTimestamp(),
        claimTicketId: claimId
      });
    } catch (itErr) {
      console.warn('[FINDMYTHING] Error marking item resolved upon claim approval:', itErr);
    }
  }

  // Generate notification for claimant
  if (claimData && claimData.claimantUid) {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: claimData.claimantUid,
        title: decision === 'approved' ? 'Ownership Claim Approved! 🎉' : 'Claim Verification Update',
        message: decision === 'approved'
          ? `Your claim for "${claimData.itemTitle}" has been verified. Present your Student ID at ${claimData.pickupStation || 'Campus Desk'} for pickup.`
          : `Your claim for "${claimData.itemTitle}" was reviewed and rejected. Staff notes: ${adminNotes || 'Verification traits did not match.'}`,
        type: decision === 'approved' ? 'claim_approved' : 'claim_rejected',
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (nErr) {
      console.warn('[FINDMYTHING] Claimant notification dispatch notice:', nErr);
    }
  }

  return { success: true };
}

// ============================================================================
// 5. CLOUD FIRESTORE: NOTIFICATIONS MODULE
// ============================================================================

/**
 * Subscribe to notifications for current user
 */

export function subscribeNotifications(callback, onError, userIsAdmin = false) {
  if (!isFirebaseConfigured() || !auth.currentUser) {
    return () => { };
  }

  const user = auth.currentUser;

  const q = userIsAdmin
    ? query(
      collection(db, 'notifications'),
      where('userId', '==', 'admin')
    )
    : query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid)
    );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = [];

      snapshot.forEach((docSnap) => {
        notifications.push({
          ...docSnap.data(),
          id: docSnap.id
        });
      });

      notifications.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      callback(notifications);
    },
    (err) => {
      console.error('[FINDMYTHING] Notification subscription error:', err);
      if (onError) onError(err);
    }
  );
}


/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId) {
  if (!isFirebaseConfigured()) return;
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (err) {
    console.warn('[FINDMYTHING] Failed to mark notification read:', err);
  }
}
