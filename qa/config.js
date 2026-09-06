'use strict';
/** Shared QA config — local dev stack only. */
module.exports = {
  WEB: 'http://localhost:8080',
  API: 'http://localhost:3000/api',
  ADMIN: 'http://localhost:3001',
  // Seeded accounts (README "Default Credentials") — used only for verification.
  CREDS: {
    SUPER_ADMIN: { email: 'admin@aamako.agro', password: 'Admin123!' },
    STAFF_ADMIN: { email: 'admin2@aamako.agro', password: 'Admin123!' },
    STAFF_MANAGER: { email: 'manager@aamako.agro', password: 'Manager123!' },
    STAFF_SALES: { email: 'sales@aamako.agro', password: 'Sales123!' },
    CONTENT_MANAGER: { email: 'content@aamako.agro', password: 'Content123!' },
    STAFF_SUPPORT: { email: 'support@aamako.agro', password: 'Support123!' },
    RETAIL_CUSTOMER: { email: 'customer@aamako.agro', password: 'Customer123!' },
    WHOLESALE_CUSTOMER: { email: 'wholesale@aamako.agro', password: 'Wholesale123!' },
  },
  STAFF_ROLES: ['STAFF_SALES', 'STAFF_SUPPORT', 'CONTENT_MANAGER', 'STAFF_MANAGER', 'STAFF_ADMIN', 'SUPER_ADMIN'],
  ARTIFACTS: __dirname + '/artifacts',
};
