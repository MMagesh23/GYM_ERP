require('dotenv').config();

// FIX (P0): validate required environment variables at boot instead of
// failing silently or cryptically at first request. Missing MONGO_URI or JWT
// secrets previously either crashed on the first login attempt with an
// opaque error, or (for CLIENT_URL) silently fell back to a localhost CORS
// origin in production — see app.js for the matching CORS fix.
const REQUIRED_ENV = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
if (process.env.NODE_ENV === 'production') {
  REQUIRED_ENV.push('CLIENT_URL');
}

const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(
    `Refusing to start: missing required environment variable(s): ${missingEnv.join(', ')}. ` +
      'Check your .env file against .env.example.'
  );
  process.exit(1);
}

const app = require('./app');
const connectDB = require('./config/db');
const cron = require('node-cron');
const { runDailyGeneration } = require('./utils/notificationGenerator');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Gym ERP API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  });

  // Runs every day at 8:00 AM server time - membership expiry, payment due, birthdays,
  // equipment service due, low revenue alert, daily collection summary.
  cron.schedule('0 8 * * *', async () => {
    try {
      const result = await runDailyGeneration();
      console.log('Daily notification generation complete:', result);
    } catch (err) {
      console.error('Daily notification generation failed:', err);
    }
  });
};

start();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});