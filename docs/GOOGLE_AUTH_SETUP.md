# Google authorization setup

Gameweek Data V2 includes optional Google sign-in through Firebase Authentication. This phase connects a user identity only. No draft database is used: drafts stay in the current browser and can be downloaded or restored as portable JSON.

## Current project status

- Firebase web configuration is installed for `fpl-league-graphics-studio`.
- The Google provider is enabled and responds correctly.
- `localhost` is authorized for local testing.
- Still add `127.0.0.1` for the alternate local URL and `yakirc0412.github.io` before testing the GitHub Pages deployment.

## 1. Create the Firebase web app

1. Open the [Firebase console](https://console.firebase.google.com/) and create or select a project.
2. In **Project settings**, add a **Web app**.
3. Copy the generated `firebaseConfig` object.

The web configuration is a public project identifier and can be deployed with the site. Never add a service-account JSON file, Admin SDK credential or private key to this repository.

No Firestore database, Storage bucket rules or billing upgrade is required for this identity-only phase.

## 2. Enable Google sign-in

1. Open **Firebase Authentication**.
2. Under **Sign-in method**, enable **Google**.
3. Choose the project support email and save.
4. Under **Authentication → Settings → Authorized domains**, add every domain that will host the site. For the current deployment this includes `yakirc0412.github.io`. Add the local hostnames used for development as needed, such as `localhost` and `127.0.0.1`.

Firebase projects created after April 2025 may not include `localhost` automatically, so confirm it is present rather than assuming local sign-in is authorized.

## 3. Add the public configuration

The public configuration is stored in `config/firebase.js`. If the Firebase web app changes, replace that object with the new configuration:

```js
window.FPL_FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

The V2 page detects this object automatically. When it is missing, the account dialog stays in guest mode and no Firebase files are downloaded. The project is a static application, so it loads Firebase's modular SDK through script modules and does not require npm or a bundler.

Keep the default popup flow for GitHub Pages. Firebase redirect sign-in depends on an auth helper that modern browsers can block when it is on another origin. If the site is later moved to Firebase Hosting or a compatible custom auth domain is configured, mobile redirect can be enabled explicitly:

```js
window.FPL_FIREBASE_CONFIG = {
  // standard Firebase web configuration fields...
  authFlow: "redirect"
};
```

Do not add `authFlow: "redirect"` to the current GitHub Pages deployment unless the redirect-domain requirements in Firebase's documentation have also been completed.

## 4. Test over HTTP

Open the V2 route through the local server, not as a `file://` page:

`http://localhost:4173/app/gameweek-data-v2.html`

Check these flows:

- Guest mode still opens and drafts save locally.
- **Sign in with Google** opens the Google account picker.
- Test Google sign-in on both desktop and a real phone. GitHub Pages uses the popup flow by default on both.
- The header changes from **Guest mode** to the signed-in user's first name or avatar.
- Reloading the page keeps the Firebase session.
- **Sign out** returns the header to Guest mode.
- Signing in or out does not remove, duplicate or upload local drafts.

## Troubleshooting

- `auth/unauthorized-domain`: add the exact hostname to **Authentication → Settings → Authorized domains**. Do not include `https://` or a path.
- Popup blocked: allow popups for the site and try again. The sign-in action is triggered directly by the user's click, which minimizes this risk.
- Google button remains in setup mode: check that `apiKey`, `authDomain`, `projectId` and `appId` in `config/firebase.js` contain the real web-app values rather than the example placeholders.
- Local sign-in works but GitHub Pages does not: confirm `yakirc0412.github.io` is authorized and that the deployed `config/firebase.js` contains the same Firebase project configuration.

## Current boundary

Authentication is intentionally separate from draft storage. A later cloud-sync phase can use the Firebase user ID as the owner of each remote draft after database rules and migration behavior are designed.
