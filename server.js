// server.js
// Node.js Express server with Google OAuth2 integration (googleapis)
// IMPORTANT: 請在啟動前依說明建立 Google OAuth 憑證，並設定環境變數 CLIENT_ID / CLIENT_SECRET / REDIRECT_URI
require("dotenv").config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const {google} = require('googleapis');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: true,
}));

// serve static files
// app.use('/', express.static(path.join(__dirname, '/')));
app.use(express.static(path.join(__dirname, 'public')));


// OAuth2 client factory 本地執行時，REDIRECT_URI 預設為 http://localhost:3000/auth/google/callback
function createOAuthClient() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const redirectUri = process.env.REDIRECT_URI || `http://localhost:${port}/auth/google/callback`;
  if (!clientId || !clientSecret) {
    console.warn('WARNING: CLIENT_ID or CLIENT_SECRET not set in env');
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// route: start oauth
app.get('/auth/google', (req, res) => {
  const oAuth2Client = createOAuthClient();
  const scopes = ['https://www.googleapis.com/auth/calendar.events'];
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(authUrl);
});

// oauth callback
app.get('/auth/google/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const oAuth2Client = createOAuthClient();
    const {tokens} = await oAuth2Client.getToken(code);
    req.session.tokens = tokens;
    // redirect back to root (or modal will continue)
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error', err);
    res.status(500).send('OAuth callback error');
  }
});

// create calendar event
app.post('/create-event', async (req, res) => {
  const {title, description, start, end} = req.body;
  // if no tokens in session, return auth URL for client to redirect
  if (!req.session.tokens) {
    const oAuth2Client = createOAuthClient();
    const scopes = ['https://www.googleapis.com/auth/calendar.events'];
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
    return res.status(401).json({ error: '需要授權', authUrl });
  }

  try {
    const oAuth2Client = createOAuthClient();
    oAuth2Client.setCredentials(req.session.tokens);
    const calendar = google.calendar({version:'v3', auth: oAuth2Client});
    const event = {
      summary: title,
      description,
      start: { dateTime: new Date(start).toISOString() },
      end: { dateTime: new Date(end).toISOString() }
    };
    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });
    res.json({ success: true, id: created.data.id });
  } catch (err) {
    console.error('create-event error', err);
    // if token expired, clear and ask for re-auth
    if (err.code === 401 || err.code === 400) {
      req.session.tokens = null;
      const oAuth2Client = createOAuthClient();
      const scopes = ['https://www.googleapis.com/auth/calendar.events'];
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
      });
      return res.status(401).json({ error: '需重新授權', authUrl });
    }
    res.status(500).json({ error: '建立事件失敗' });
  }
});

app.listen(port, () => {
  console.log(`Server start running`);
});

