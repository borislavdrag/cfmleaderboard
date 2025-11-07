window.CFM_CONFIG = {
  /**
   * CSV or JSON endpoint (Google Sheets publish-to-web link works) used to populate the leaderboard.
   * Leave blank to use the empty placeholder data that ships with the repo.
   */
  leaderboardFeed: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQGFxPxXfyHj8GY7fSRb8QyM4kmOr0ETS7UPmJ7oe7J8akr3puxMHLVztTxYysdnLa3hc0MIOHaHOHO/pub?output=csv',

  /**
   * Optional HTTPS endpoint that accepts POST requests to capture score submissions.
   * Point this to a Google Apps Script Web App, Supabase Edge Function, etc.
   */
  scoreEndpoint: 'https://script.google.com/macros/s/AKfycby5W07KDWDNcNl5fqjtVklQP7kcZMp_Y3lneAqiSGZBz6u4lytSL5nvxeN3DNzCRgNV/exec',
  /**
   * Extra headers (API keys, Authorization, etc.) to be merged into the submission request.
   * Example: { 'x-api-key': 'YOUR_KEY' }
   */
  scoreEndpointHeaders: {},

  /**
   * Optional token that will be included with each submission payload for basic authentication.
   */
  submissionToken: '',

  /**
   * Human-readable label shown in the UI so athletes know where scores end up.
   */
  sheetLabel: 'Google Sheet (set in config.js)',

  /**
   * Simple passphrase required to open the client-side admin panel.
   */
  adminPassword: 'admin',
};
