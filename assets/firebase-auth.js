const accountButtons = [...document.querySelectorAll("[data-account-button]")];
const modalRoot = document.getElementById("modalRoot");
const drawerModeLabel = document.getElementById("drawerModeLabel");
const draftStorageTitle = document.getElementById("draftStorageTitle");
const draftStorageDetail = document.getElementById("draftStorageDetail");
const leagueGate = document.getElementById("leagueGate");
const continueWithGoogle = document.getElementById("continueWithGoogle");
const guestAccessForm = document.getElementById("guestAccessForm");
const guestNameInput = document.getElementById("guestNameInput");
const guestAccessError = document.getElementById("guestAccessError");
const inlineAuthPanel = document.getElementById("inlineAuthPanel");
const leagueLoadPanel = document.getElementById("leagueLoadPanel");
const authWelcomeName = document.getElementById("authWelcomeName");
const authWelcomeMode = document.getElementById("authWelcomeMode");
const changeAccessButton = document.getElementById("changeAccessButton");
let accessResolved = false;
let guestName = (() => { try { return sessionStorage.getItem("fpl-studio-guest-name") || ""; } catch { return ""; } })();

const authState = {
  configured: false,
  ready: false,
  user: null,
  error: "",
  auth: null,
  provider: null,
  signInWithPopup: null,
  signInWithRedirect: null,
  getRedirectResult: null,
  signOut: null,
};

const requiredConfigFields = ["apiKey", "authDomain", "projectId", "appId"];
const config = window.FPL_FIREBASE_CONFIG;
const isUsableConfigValue = (value) => {
  const normalized = String(value || "").trim();
  return normalized && normalized !== "..." && !normalized.includes("your-project");
};
authState.configured = Boolean(
  config && requiredConfigFields.every((field) => isUsableConfigValue(config[field]))
);

function userInitial(user) {
  const source = user?.displayName || user?.email || guestName || "G";
  return source.trim().charAt(0).toUpperCase() || "G";
}

function userLabel(user) {
  if (!user) return guestName || "Guest mode";
  return (user.displayName || user.email || "Google account").split(/\s+/)[0];
}

function userFullLabel(user) {
  return user?.displayName || user?.email || guestName || "Guest";
}

function safePhotoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function prefersRedirectSignIn() {
  /*
   * Redirect auth needs a same-origin auth helper on browsers that partition
   * third-party storage. GitHub Pages cannot proxy Firebase's /__/auth helper,
   * so popup is the reliable default there, including on mobile. Projects that
   * deliberately configure a compatible custom auth domain can opt in.
   */
  return config?.authFlow === "redirect" && window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
}

function announceAuthState(type, detail = {}) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function updateAccountUi() {
  const photo = safePhotoUrl(authState.user?.photoURL);
  accountButtons.forEach((accountButton) => {
    const icon = accountButton.querySelector("i");
    const label = accountButton.querySelector(".account-label");
    accountButton.classList.toggle("signed-in", Boolean(authState.user || guestName));
    accountButton.setAttribute(
      "aria-label",
      authState.user ? `Google account: ${userLabel(authState.user)}` : guestName ? `Guest profile: ${guestName}` : "Open account options"
    );
    if (label) label.textContent = userLabel(authState.user);
    if (icon) {
      icon.textContent = photo ? "" : userInitial(authState.user);
      icon.style.backgroundImage = photo ? `url("${photo.replace(/"/g, "%22")}")` : "";
    }
  });
  if (drawerModeLabel) drawerModeLabel.textContent = authState.user ? "Google account" : guestName ? `Guest · ${guestName}` : "Guest mode";
  if (draftStorageTitle) draftStorageTitle.textContent = "Saved locally + JSON backup";
  if (draftStorageDetail) {
    draftStorageDetail.textContent = authState.user
      ? "No database is used. Drafts stay in this browser and can be moved with the portable JSON controls below."
      : "Guest drafts stay in this browser. Download JSON before changing devices or clearing browser data.";
  }
  const productWelcome = document.getElementById("productChoiceWelcome");
  if (productWelcome) productWelcome.textContent = `Welcome, ${userFullLabel(authState.user)}`;
}

function closeAccountModal() {
  if (modalRoot?.querySelector("[data-account-overlay]")) modalRoot.innerHTML = "";
}

function unlockLeagueLoader(mode, name) {
  accessResolved = true;
  if (mode === "guest") {
    guestName = name;
    try { sessionStorage.setItem("fpl-studio-guest-name",guestName); } catch {}
  }
  if (inlineAuthPanel) inlineAuthPanel.classList.add("complete");
  if (authWelcomeName) authWelcomeName.textContent = `Welcome, ${name}`;
  if (authWelcomeMode) authWelcomeMode.textContent = mode === "google" ? "Google account connected. You can now load your league." : "Guest mode is ready. Drafts will stay in this browser.";
  if (leagueLoadPanel) {
    leagueLoadPanel.classList.remove("auth-locked");
    leagueLoadPanel.setAttribute("aria-hidden", "false");
  }
  updateAccountUi();
  requestAnimationFrame(() => {
    leagueLoadPanel?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest" });
    document.getElementById("leagueIdInput")?.focus({ preventScroll: true });
  });
}

function resetAccessPanel() {
  accessResolved = false;
  guestName = "";
  try { sessionStorage.removeItem("fpl-studio-guest-name"); } catch {}
  if (leagueGate) leagueGate.hidden = false;
  if (inlineAuthPanel) { inlineAuthPanel.hidden = false; inlineAuthPanel.classList.remove("complete"); }
  if (leagueLoadPanel) {
    leagueLoadPanel.classList.add("auth-locked");
    leagueLoadPanel.setAttribute("aria-hidden", "true");
  }
  if (guestAccessError) guestAccessError.textContent = "";
  if (guestNameInput) guestNameInput.value = "";
  document.body.style.overflow = "hidden";
  updateAccountUi();
  requestAnimationFrame(() => continueWithGoogle?.focus());
}

function handleGuestAccess(event) {
  event.preventDefault();
  const name = String(guestNameInput?.value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    if (guestAccessError) guestAccessError.textContent = "Please enter your name to continue as a guest.";
    guestNameInput?.focus();
    return;
  }
  if (guestAccessError) guestAccessError.textContent = "";
  unlockLeagueLoader("guest", name.slice(0, 40));
}

function accountStatusCopy() {
  if (!authState.configured) {
    return {
      eyebrow: "Guest access",
      title: "Google sign-in is not configured yet",
      body: "You can keep using the studio as a guest. The site owner can enable Google sign-in by adding the Firebase web configuration.",
    };
  }
  if (authState.error) {
    return { eyebrow: "Sign-in unavailable", title: "Google sign-in needs attention", body: authState.error };
  }
  if (!authState.ready) {
    return { eyebrow: "Account", title: "Preparing Google sign-in…", body: "This should only take a moment." };
  }
  if (authState.user) {
    return {
      eyebrow: "Signed in",
      title: authState.user.displayName || "Google account",
      body: "Your identity is connected. Drafts still remain on this device until cloud sync is added in a later step.",
    };
  }
  return {
    eyebrow: "Optional account",
    title: "Sign in with Google",
    body: "Sign in now to establish your account. Guest mode remains available, and drafts use local storage plus portable JSON in this version.",
  };
}

function renderAccountModal() {
  if (!modalRoot) return;
  const user = authState.user;
  const photo = safePhotoUrl(user?.photoURL);
  const connected = Boolean(user || guestName);
  modalRoot.innerHTML = connected ? `
    <div class="modal-overlay account-overlay" data-account-overlay>
      <div class="modal-card account-card account-card-compact" role="dialog" aria-modal="true" aria-label="Account options">
        <button class="modal-close" data-close-account type="button" aria-label="Close account options">×</button>
        <div class="account-profile">
          <div class="account-avatar"></div>
          <div><b class="account-name"></b><span class="account-email"></span></div>
        </div>
        <div class="account-actions"><button class="button secondary" data-account-sign-out type="button">SIGN OUT</button><button class="button primary" data-change-tool type="button">CHANGE TOOL</button></div>
      </div>
    </div>` : `
    <div class="modal-overlay account-overlay" data-account-overlay>
      <div class="modal-card account-card" role="dialog" aria-modal="true" aria-labelledby="accountModalTitle">
        <div class="modal-head"><div><span class="account-eyebrow">Account</span><h3 id="accountModalTitle">Continue to the studio</h3></div><button class="modal-close" data-close-account type="button" aria-label="Close account options">×</button></div>
        <div class="account-actions"></div>
      </div>
    </div>`;
  const profile = modalRoot.querySelector(".account-profile");
  if (connected) {
    const avatar = profile.querySelector(".account-avatar");
    avatar.textContent = photo ? "" : userInitial(user);
    avatar.style.backgroundImage = photo ? `url("${photo.replace(/"/g, "%22")}")` : "";
    profile.querySelector(".account-name").textContent = userFullLabel(user);
    profile.querySelector(".account-email").textContent = user ? "Signed in with Google" : "Guest mode";
  }
  const actions = modalRoot.querySelector(".account-actions");
  if (!connected && authState.configured && authState.ready) {
    actions.innerHTML = '<button class="button secondary" data-close-account type="button">CONTINUE AS GUEST</button><button class="button google-sign-in" data-account-sign-in type="button"><img src="../assets/brand/google-g.svg" alt="">SIGN IN WITH GOOGLE</button>';
  } else if (!connected) {
    actions.innerHTML = '<button class="button primary" data-close-account type="button">CONTINUE AS GUEST</button>';
  }
  modalRoot.querySelectorAll("[data-close-account]").forEach((button) => button.addEventListener("click", closeAccountModal));
  modalRoot.querySelector("[data-account-overlay]").addEventListener("click", (event) => {
    if (event.target.dataset.accountOverlay !== undefined) closeAccountModal();
  });
  modalRoot.querySelector("[data-account-sign-in]")?.addEventListener("click", handleSignIn);
  modalRoot.querySelector("[data-account-sign-out]")?.addEventListener("click", handleSignOut);
  modalRoot.querySelector("[data-change-tool]")?.addEventListener("click", () => {
    closeAccountModal();
    if (location.pathname.includes("gameweek-recap")) location.href = "gameweek-data-v2.html?tools=1";
    else window.dispatchEvent(new CustomEvent("fpl-change-tool"));
  });
}

function friendlyAuthError(error) {
  const code = String(error?.code || "");
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in was cancelled. You can try again whenever you are ready.";
  if (code === "auth/popup-blocked") return "The browser blocked the Google sign-in window. Allow popups for this site and try again.";
  if (code === "auth/unauthorized-domain") return "This website domain is not authorized in Firebase Authentication yet.";
  if (code === "auth/network-request-failed") return "Google sign-in could not reach the network. Check the connection and try again.";
  return error?.message || "Google sign-in could not be completed. Please try again.";
}

async function handleSignIn() {
  const button = modalRoot?.querySelector("[data-account-sign-in]");
  if (!authState.ready || !authState.auth || !authState.signInWithPopup || !authState.signInWithRedirect) return;
  authState.error = "";
  if (button) {
    button.disabled = true;
    button.textContent = prefersRedirectSignIn() ? "REDIRECTING TO GOOGLE…" : "OPENING GOOGLE…";
  }
  try {
    if (prefersRedirectSignIn()) {
      await authState.signInWithRedirect(authState.auth, authState.provider);
    } else {
      await authState.signInWithPopup(authState.auth, authState.provider);
      closeAccountModal();
    }
  } catch (error) {
    authState.error = friendlyAuthError(error);
    renderAccountModal();
  }
}

async function handleEntryGoogle() {
  if (!authState.configured || !authState.ready) {
    renderAccountModal();
    return;
  }
  if (continueWithGoogle) continueWithGoogle.disabled = true;
  const originalLabel = continueWithGoogle?.innerHTML;
  authState.error = "";
  if (continueWithGoogle) continueWithGoogle.textContent = prefersRedirectSignIn() ? "Redirecting to Google…" : "Opening Google…";
  try {
    if (prefersRedirectSignIn()) {
      await authState.signInWithRedirect(authState.auth, authState.provider);
    } else {
      await authState.signInWithPopup(authState.auth, authState.provider);
    }
  } catch (error) {
    authState.error = friendlyAuthError(error);
    renderAccountModal();
  } finally {
    if (continueWithGoogle) {
      continueWithGoogle.disabled = false;
      continueWithGoogle.innerHTML = originalLabel;
    }
  }
}

async function handleSignOut() {
  const button = modalRoot?.querySelector("[data-account-sign-out]");
  if (button) button.disabled = true;
  try {
    if (authState.user && authState.ready && authState.auth && authState.signOut) await authState.signOut(authState.auth);
    guestName = "";
    try { sessionStorage.removeItem("fpl-studio-guest-name"); } catch {}
    closeAccountModal();
    resetAccessPanel();
    if (location.pathname.includes("gameweek-recap")) location.href = "gameweek-data-v2.html";
    else window.dispatchEvent(new CustomEvent("fpl-signed-out"));
  } catch (error) {
    authState.error = friendlyAuthError(error);
    renderAccountModal();
  }
}

window.FPLGoogleAuth = {
  get configured() { return authState.configured; },
  get ready() { return authState.ready; },
  get user() { return authState.user; },
  open: renderAccountModal,
  signOut: handleSignOut,
};

accountButtons.forEach((button) => button.addEventListener("click", renderAccountModal));
document.querySelectorAll("[data-studio-sign-out]").forEach((button) => button.addEventListener("click", handleSignOut));
continueWithGoogle?.addEventListener("click", handleEntryGoogle);
guestAccessForm?.addEventListener("submit", handleGuestAccess);
changeAccessButton?.addEventListener("click", async () => {
  if (authState.user && authState.ready && authState.signOut) {
    try { await authState.signOut(authState.auth); } catch (error) { authState.error = friendlyAuthError(error); renderAccountModal(); }
  }
  resetAccessPanel();
});
updateAccountUi();
if (guestName) unlockLeagueLoader("guest",guestName);
else requestAnimationFrame(() => continueWithGoogle?.focus());

if (authState.configured) {
  try {
    const [appModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(config);
    authState.auth = authModule.getAuth(app);
    await authModule.setPersistence(authState.auth, authModule.browserLocalPersistence);
    authState.provider = new authModule.GoogleAuthProvider();
    authState.provider.setCustomParameters({ prompt: "select_account" });
    authState.signInWithPopup = authModule.signInWithPopup;
    authState.signInWithRedirect = authModule.signInWithRedirect;
    authState.getRedirectResult = authModule.getRedirectResult;
    authState.signOut = authModule.signOut;
    try {
      await authState.getRedirectResult(authState.auth);
    } catch (error) {
      authState.error = friendlyAuthError(error);
      announceAuthState("fpl-auth-error", { message: authState.error, code: String(error?.code || "") });
    }
    authModule.onAuthStateChanged(authState.auth, (user) => {
      authState.user = user;
      authState.ready = true;
      if (user) authState.error = "";
      updateAccountUi();
      announceAuthState("fpl-auth-ready", { configured: true, user });
      announceAuthState("fpl-auth-change", { user });
      if (user && !accessResolved) unlockLeagueLoader("google", user.displayName || user.email || "Google user");
      if (modalRoot?.querySelector("[data-account-overlay]")) renderAccountModal();
    });
  } catch (error) {
    authState.ready = false;
    authState.error = "Google sign-in could not be initialized. Check the Firebase web configuration and network connection.";
    console.error("Firebase Auth initialization failed", error);
    announceAuthState("fpl-auth-error", { message: authState.error, code: String(error?.code || "") });
    updateAccountUi();
  }
} else {
  announceAuthState("fpl-auth-ready", { configured: false, user: null });
}
