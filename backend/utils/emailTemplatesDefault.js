// Default subject/body for every template type. Used to seed EmailTemplate
// documents the first time each is needed (see emailService.getOrSeedTemplate)
// so the feature works out of the box, while remaining fully editable by the
// Admin afterwards from Settings > Email > Templates.
//
// Body is simple HTML with {{placeholder}} tokens - see EmailTemplate.js for
// the supported placeholder list and utils/emailService.js#renderTemplate for
// how they're substituted.

const wrap = (title, message) => `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto; color: #1f2937;">
  <h2 style="color: #3390fa; margin-bottom: 4px;">{{gymName}}</h2>
  <h3 style="margin-top: 0;">${title}</h3>
  ${message}
  <p style="margin-top: 32px; font-size: 12px; color: #9ca3af;">This is an automated message from {{gymName}}.</p>
</div>
`;

const DEFAULT_TEMPLATES = {
  welcome: {
    name: 'Welcome Email',
    subject: 'Welcome to {{gymName}}, {{memberName}}!',
    body: wrap(
      'Welcome aboard!',
      `<p>Hi {{memberName}},</p>
       <p>We're thrilled to have you join <strong>{{gymName}}</strong>. Your fitness journey starts now, and we're here to support you every step of the way.</p>
       <p>If you have any questions, just reply to this email or speak with our front desk team.</p>`
    ),
  },
  membership_registration: {
    name: 'Membership Registration',
    subject: 'Your {{membershipPlan}} membership is confirmed',
    body: wrap(
      'Membership confirmed',
      `<p>Hi {{memberName}},</p>
       <p>Your <strong>{{membershipPlan}}</strong> membership at {{gymName}} has been successfully registered.</p>
       <p><strong>Valid until:</strong> {{expiryDate}}</p>
       <p>See you at the gym!</p>`
    ),
  },
  membership_renewal_reminder: {
    name: 'Membership Renewal Reminder',
    subject: 'Your {{membershipPlan}} membership expires on {{expiryDate}}',
    body: wrap(
      'Time to renew',
      `<p>Hi {{memberName}},</p>
       <p>Your <strong>{{membershipPlan}}</strong> membership at {{gymName}} is set to expire on <strong>{{expiryDate}}</strong>.</p>
       <p>Renew today to keep your progress going without interruption.</p>`
    ),
  },
  membership_expiry_notice: {
    name: 'Membership Expiry Notice',
    subject: 'Your {{gymName}} membership has expired',
    body: wrap(
      'Membership expired',
      `<p>Hi {{memberName}},</p>
       <p>Your <strong>{{membershipPlan}}</strong> membership expired on <strong>{{expiryDate}}</strong>.</p>
       <p>Visit us or renew online to reactivate your membership and continue training.</p>`
    ),
  },
  payment_receipt: {
    name: 'Payment Receipt',
    subject: 'Payment received - {{amount}}',
    body: wrap(
      'Payment received',
      `<p>Hi {{memberName}},</p>
       <p>We've received your payment of <strong>{{amount}}</strong> for your {{membershipPlan}} membership. Thank you!</p>
       <p>A copy of your invoice is attached where applicable.</p>`
    ),
  },
  payment_reminder: {
    name: 'Payment Reminder',
    subject: 'Payment reminder - {{amount}} due',
    body: wrap(
      'Payment due',
      `<p>Hi {{memberName}},</p>
       <p>This is a reminder that a payment of <strong>{{amount}}</strong> is pending for your {{membershipPlan}} membership at {{gymName}}.</p>
       <p>Please settle this at your earliest convenience.</p>`
    ),
  },
  password_reset: {
    name: 'Password Reset',
    subject: 'Reset your {{gymName}} password',
    body: wrap(
      'Password reset requested',
      `<p>Hi {{memberName}},</p>
       <p>We received a request to reset your password. Click the link below to choose a new one. This link expires in 30 minutes.</p>
       <p><a href="{{resetLink}}" style="color:#3390fa;">Reset your password</a></p>
       <p>If you didn't request this, you can safely ignore this email.</p>`
    ),
  },
  announcement: {
    name: 'Announcement',
    subject: 'An update from {{gymName}}',
    body: wrap(
      'Announcement',
      `<p>Hi {{memberName}},</p>
       <p>[Write your announcement here.]</p>`
    ),
  },
};

module.exports = { DEFAULT_TEMPLATES };
