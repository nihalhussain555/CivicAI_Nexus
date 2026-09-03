/**
 * Google/Microsoft sign-in buttons — UI only, intentionally not wired to
 * any auth flow. Real "Sign in with Google/Microsoft" requires a backend
 * to verify the provider's token and create/look up the matching user,
 * which was explicitly out of scope here. These are ready to attach an
 * onClick (and a corresponding backend endpoint) to whenever that's built.
 */

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.5c-2 1.4-4.6 2.2-7.7 2.2-5.2 0-9.6-3.3-11.2-7.9l-6.6 5.1C9.9 39.6 16.4 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.5C41.6 35.9 44 30.4 44 24c0-1.2-.1-2.4-.4-3.5z" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 23 23">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

const SocialLoginButtons = () => (
  <div style={{ display: "flex", gap: 10 }}>
    <button type="button" className="btn btn-secondary btn-block" style={{ gap: 10 }}>
      <GoogleIcon /> Google
    </button>
    <button type="button" className="btn btn-secondary btn-block" style={{ gap: 10 }}>
      <MicrosoftIcon /> Microsoft
    </button>
  </div>
);

export default SocialLoginButtons;