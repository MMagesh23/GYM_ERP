const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const swaggerUi = require('swagger-ui-express');
const openapiSpec = require('./docs/openapi.json');

const app = express();

app.use(helmet());
app.use(compression());

// FIX (P0): previously `process.env.CLIENT_URL || 'http://localhost:5173'`
// unconditionally — if CLIENT_URL was unset in production, CORS would
// silently scope itself to localhost, which either breaks the real frontend
// outright or (depending on deployment topology) mis-scopes credentialed
// requests. server.js now refuses to boot in production without CLIENT_URL
// set, so this fallback only ever applies in local/dev.
app.use(
  cors({
    origin:
      process.env.CLIENT_URL ||
      (process.env.NODE_ENV === 'production' ? false : 'http://localhost:5173'),
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// General API rate limiting (tune per-route limiters for /auth/login separately if desired)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// FIX (P1): dedicated stricter limiter on the login endpoint specifically.
// The per-account lockout in authController already stops repeated guesses
// against ONE email; this stops a low-and-slow credential-stuffing run that
// spreads attempts across many different emails from the same source, which
// the per-account lockout alone does nothing to slow down.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', loginLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;