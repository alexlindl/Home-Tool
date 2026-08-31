// Placeholder for local development. In the Home Assistant add-on this file is
// overwritten at container start by run.sh with the configured admin secret.
// Locally the app falls back to the VITE_ADMIN_API_SECRET build-time env var.
window.__RUNTIME_CONFIG__ = { ADMIN_API_SECRET: "" };
