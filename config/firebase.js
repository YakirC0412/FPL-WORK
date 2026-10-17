/*
 * Firebase web configuration for Google authorization.
 *
 * The Firebase web config identifies the public Firebase project; it is not a
 * service-account secret. This object was copied from:
 * Firebase Console -> Project settings -> Your apps -> Web app.
 *
 * Never place a service-account key or Admin SDK credential in this file.
 *
 * Optional: `authFlow: "redirect"` enables redirect sign-in on phones only.
 * Leave it omitted for GitHub Pages. Redirect requires a compatible same-origin
 * Firebase auth helper/custom auth domain; popup is the reliable default.
 */
window.FPL_FIREBASE_CONFIG = window.FPL_FIREBASE_CONFIG || {
  apiKey: "AIzaSyDu9AHLiKJkPDQNCjNiMd0qJGG-OnRNJgE",
  authDomain: "fpl-league-graphics-studio.firebaseapp.com",
  projectId: "fpl-league-graphics-studio",
  storageBucket: "fpl-league-graphics-studio.firebasestorage.app",
  messagingSenderId: "407019528266",
  appId: "1:407019528266:web:143c7dd67051d9d52a06b3",
  measurementId: "G-PQ3CF9RSR8"
};
