// Default plain-text content for every WhatsApp template type — seeded the
// first time each is requested (see utils/whatsappService.js#getOrSeedWhatsappTemplate),
// same pattern as utils/emailTemplatesDefault.js, but deliberately kept as a
// FULLY SEPARATE default set: plain text, no HTML, no <div>/{{gymName}} header
// wrapper — WhatsApp and email templates must never share content or storage.

const DEFAULT_TEMPLATES = {
  membership_expiry_reminder: {
    name: 'Membership Expiry Reminder',
    body:
`Hi {{memberName}}, 👋

Your *{{membershipPlan}}* membership at {{gymName}} expires on *{{expiryDate}}* ({{daysRemaining}} day(s) left).

Renew soon to keep your progress going without any break!

📍 {{gymAddress}}
📞 {{gymPhone}}`,
  },
  membership_renewal_reminder: {
    name: 'Membership Renewal Reminder',
    body:
`Hi {{memberName}}, 👋

Just a friendly reminder that your *{{membershipPlan}}* membership at {{gymName}} is coming up for renewal.

Reply to this message or visit us to renew and keep your streak going! 💪

📞 {{gymPhone}}`,
  },
  payment_due_reminder: {
    name: 'Payment Due Reminder',
    body:
`Hi {{memberName}}, 👋

This is a reminder that a payment of *{{dueAmount}}* is pending for your {{membershipPlan}} membership at {{gymName}}.

Please clear this at your earliest convenience. 🙏

📞 {{gymPhone}}`,
  },
  payment_received_confirmation: {
    name: 'Payment Received Confirmation',
    body:
`Hi {{memberName}}, ✅

We've received your payment of *{{amount}}* for your {{membershipPlan}} membership at {{gymName}}. Thank you!

See you at the gym! 💪`,
  },
  welcome_message: {
    name: 'Welcome Message',
    body:
`Hi {{memberName}}, 🎉

Welcome to *{{gymName}}*! We're excited to have you join us.

Your fitness journey starts now — let's make it count! 💪

📍 {{gymAddress}}
📞 {{gymPhone}}`,
  },
  general_announcement: {
    name: 'General Announcement',
    body:
`Hi {{memberName}}, 📢

[Write your announcement here.]

— {{gymName}}`,
  },
};

module.exports = { DEFAULT_TEMPLATES };