// Default plain-text content for every WhatsApp template type, per
// language. English defaults are unchanged from the original feature;
// Tamil defaults are new. Placeholders are identical across languages
// (rendered by the same shared renderTemplate utility) — only the
// surrounding wording changes.

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

// NEW — Tamil defaults. `name` stays in English (it's an internal admin-
// facing label shown in the Settings template list, not part of the
// message sent to members) — only `body` is Tamil.
const TAMIL_TEMPLATES = {
  membership_expiry_reminder: {
    name: 'Membership Expiry Reminder (Tamil)',
    body:
`வணக்கம் {{memberName}}, 👋

{{gymName}}-ல் உங்கள் *{{membershipPlan}}* உறுப்பினர் சேவை *{{expiryDate}}* அன்று முடிவடைகிறது ({{daysRemaining}} நாள்(கள்) மீதம் உள்ளன).

இடைவெளி இல்லாமல் தொடர, விரைவில் புதுப்பித்துக் கொள்ளுங்கள்!

📍 {{gymAddress}}
📞 {{gymPhone}}`,
  },
  membership_renewal_reminder: {
    name: 'Membership Renewal Reminder (Tamil)',
    body:
`வணக்கம் {{memberName}}, 👋

{{gymName}}-ல் உங்கள் *{{membershipPlan}}* உறுப்பினர் சேவையை புதுப்பிக்க வேண்டிய நேரம் நெருங்குகிறது என்பதை நினைவூட்ட விரும்புகிறோம்.

புதுப்பிக்க எங்களைத் தொடர்பு கொள்ளுங்கள் அல்லது நேரில் வாருங்கள்! 💪

📞 {{gymPhone}}`,
  },
  payment_due_reminder: {
    name: 'Payment Due Reminder (Tamil)',
    body:
`வணக்கம் {{memberName}}, 👋

{{gymName}}-ல் உங்கள் {{membershipPlan}} உறுப்பினர் சேவைக்கான *{{dueAmount}}* தொகை நிலுவையில் உள்ளது என்பதை நினைவூட்டுகிறோம்.

விரைவில் செலுத்தி உதவுங்கள். 🙏

📞 {{gymPhone}}`,
  },
  payment_received_confirmation: {
    name: 'Payment Received Confirmation (Tamil)',
    body:
`வணக்கம் {{memberName}}, ✅

உங்கள் {{membershipPlan}} உறுப்பினர் சேவைக்கான *{{amount}}* தொகையை {{gymName}} பெற்றுக்கொண்டது. நன்றி!

ஜிம்மில் சந்திப்போம்! 💪`,
  },
  welcome_message: {
    name: 'Welcome Message (Tamil)',
    body:
`வணக்கம் {{memberName}}, 🎉

*{{gymName}}*-க்கு வரவேற்கிறோம்! நீங்கள் எங்களுடன் இணைந்ததில் மகிழ்ச்சி அடைகிறோம்.

உங்கள் உடற்பயிற்சி பயணம் இப்போது தொடங்குகிறது — சிறப்பாக செய்வோம்! 💪

📍 {{gymAddress}}
📞 {{gymPhone}}`,
  },
  general_announcement: {
    name: 'General Announcement (Tamil)',
    body:
`வணக்கம் {{memberName}}, 📢

[உங்கள் அறிவிப்பை இங்கே எழுதவும்.]

— {{gymName}}`,
  },
};

module.exports = { DEFAULT_TEMPLATES, TAMIL_TEMPLATES };