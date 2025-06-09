require('dotenv').config();
const express = require('express');
const session = require('express-session');
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');
const path = require('path');

const app = express();
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: `${process.env.BASE_URL}/callback`
});

app.get('/', (req, res) => {
  if (!req.session.accessToken) {
    const scopes = ['user-top-read'];
    const authUrl = spotifyApi.createAuthorizeURL(scopes, null);
    return res.render('index', { authUrl });
  }
  res.redirect('/concerts');
});

app.get('/callback', async (req, res, next) => {
  const code = req.query.code || null;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    req.session.accessToken = data.body['access_token'];
    spotifyApi.setAccessToken(req.session.accessToken);
    res.redirect('/concerts');
  } catch (err) {
    next(err);
  }
});

app.get('/concerts', async (req, res, next) => {
  try {
    spotifyApi.setAccessToken(req.session.accessToken);
    const topData = await spotifyApi.getMyTopArtists({ limit: 10 });
    const artists = topData.body.items.map(a => a.name);

    const eventsByArtist = {};
    await Promise.all(artists.map(async name => {
      const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(name)}/events`;
      const resp = await axios.get(url, {
        params: { app_id: process.env.BANDSINTOWN_APP_ID }
      });
      eventsByArtist[name] = resp.data || [];
    }));

    res.render('concerts', { eventsByArtist });
  } catch (err) {
    next(err);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { message: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Listening on http://localhost:${PORT}`));
