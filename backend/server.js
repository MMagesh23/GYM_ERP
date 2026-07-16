require('dotenv').config();
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
