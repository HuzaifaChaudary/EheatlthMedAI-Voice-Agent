# User Login Credentials Flow

## Complete User Authentication Flow

### 1. **Initial User Invitation (New Users)**

When an admin creates a sub-account and adds a person:

**Step 1: Admin Invites User**
- Admin creates organization OR clicks "Invite User" on existing organization
- Fills in: First Name, Last Name, Email, Role
- System automatically:
  1. Creates user account
  2. Generates secure temporary password (12 characters)
  3. Sends invitation email with login credentials

**Step 2: User Receives Email**
- Email contains:
  - Welcome message
  - Organization name
  - **Email address** (their login username)
  - **Temporary password**
  - Login link to dashboard
  - Security reminder to change password

**Step 3: User First Login**
- User goes to `/login` page
- Enters:
  - **Email**: `user@example.com` (from invitation email)
  - **Password**: `[temporary password from email]`
- User logs in successfully
- **Recommended**: User should change password immediately (via Settings page)

---

### 2. **Forgot Password (Existing Users)**

If a user forgets their password in the future:

**Step 1: User Requests Password Reset**
- User goes to `/login` page
- Clicks **"Forgot password?"** link
- Goes to `/forgot-password` page
- Enters their email address
- Clicks "Send Reset Link"

**Step 2: System Sends Reset Email**
- System generates secure reset token (expires in 1 hour)
- Sends email with:
  - Password reset link
  - Instructions
  - Security warning (1 hour expiration)

**Step 3: User Resets Password**
- User clicks link in email
- Goes to `/reset-password?token=...` page
- Enters new password (twice for confirmation)
- Clicks "Reset Password"
- Password is updated
- User is redirected to login page

**Step 4: User Logs In**
- User goes to `/login`
- Enters:
  - **Email**: `user@example.com` (same as before)
  - **Password**: `[new password they just set]`
- User logs in successfully

---

## Login Credentials Summary

### What Users Need to Know:

1. **Username/Email**: 
   - Always their email address (e.g., `user@example.com`)
   - Never changes (unless admin updates it)

2. **Password**:
   - **First time**: Temporary password from invitation email
   - **After reset**: New password they set via reset link
   - **Can be changed**: Via Settings page (when logged in)

---

## Email Configuration

Both invitation emails and password reset emails use the same SMTP configuration:

### Organization-Specific (Recommended)
- Configured in: **Settings → Reminders**
- Each organization can have its own SMTP settings
- Used for both appointment reminders AND user emails

### Global Fallback
- Configured in: Backend `.env` file
- Used if organization-specific config not available

**Required Environment Variables:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@ehealthmedai.com
SMTP_FROM_NAME=EHealth Med AI
FRONTEND_URL=https://your-domain.com
```

---

## User Pages

### Login Flow Pages:
1. **`/login`** - Main login page
   - Email + Password fields
   - "Forgot password?" link
   - "Sign in with Google" option
   - "Sign up" link (for new registrations)

2. **`/forgot-password`** - Request password reset
   - Email input field
   - Sends reset link to email

3. **`/reset-password?token=...`** - Reset password
   - New password field
   - Confirm password field
   - Uses token from email link

4. **`/signup`** - Self-registration (optional)
   - For users who want to create their own account
   - Not typically used for invited users

---

## Security Features

### Password Security:
- ✅ **Temporary passwords**: 12-character random passwords
- ✅ **Password hashing**: All passwords hashed with bcrypt
- ✅ **Reset tokens**: Secure, expiring tokens (1 hour)
- ✅ **Email verification**: Email format validated
- ✅ **Audit logging**: All password changes logged

### Email Security:
- ✅ **Token expiration**: Reset links expire in 1 hour
- ✅ **One-time use**: Reset tokens cleared after use
- ✅ **No email enumeration**: System doesn't reveal if email exists

---

## Troubleshooting

### User Can't Login

1. **Check Email Address**
   - Must match exactly (case-sensitive for some systems)
   - Check for typos

2. **Check Password**
   - If first login: Use temporary password from invitation email
   - If forgot: Use "Forgot password?" to reset

3. **Check Account Status**
   - Admin can verify user is active in Admin Dashboard
   - Check if user is assigned to correct organization

### Email Not Received

1. **Check Spam Folder**
   - Invitation and reset emails may go to spam
   - Check junk/spam folder

2. **Check SMTP Configuration**
   - Verify SMTP settings in Settings → Reminders
   - Test email configuration
   - Check backend logs for email errors

3. **Manual Password Sharing**
   - If email fails, admin can see temporary password
   - Admin can manually share credentials
   - Or use "Forgot password?" flow

### Password Reset Link Expired

- Reset links expire after 1 hour
- User must request a new reset link
- Go to `/forgot-password` again

---

## Admin Actions

### View User Credentials
- Admin cannot see user passwords (they're hashed)
- Admin can see user email addresses
- Admin can reset user password via:
  - Admin Dashboard → User Management → Reset Password (if implemented)
  - Or use backend script: `node scripts/reset-password.js <email> <newPassword>`

### Resend Invitation
- Currently: Must invite user again (creates duplicate if user exists)
- Future: Could add "Resend Invitation" button

### Change User Email
- Admin can update user email in Admin Dashboard
- User will need to use new email for login

---

## Complete Flow Diagram

```
NEW USER INVITATION:
Admin → Create Org + Invite User
  ↓
System → Create Account + Generate Temp Password
  ↓
System → Send Invitation Email
  ↓
User → Receives Email (Email + Temp Password)
  ↓
User → Goes to /login
  ↓
User → Enters Email + Temp Password
  ↓
User → Logs In Successfully
  ↓
User → (Optional) Changes Password in Settings

FORGOT PASSWORD:
User → Forgets Password
  ↓
User → Goes to /forgot-password
  ↓
User → Enters Email
  ↓
System → Generates Reset Token + Sends Email
  ↓
User → Clicks Link in Email
  ↓
User → Goes to /reset-password?token=...
  ↓
User → Enters New Password
  ↓
System → Updates Password
  ↓
User → Redirected to /login
  ↓
User → Logs In with New Password
```

---

## Summary

✅ **Yes, we have a complete system for user login credentials:**

1. **Initial Login**: Users get credentials via invitation email
2. **Forgot Password**: Users can reset password via email link
3. **Email System**: Both use the same SMTP configuration
4. **Security**: Passwords are hashed, tokens expire, audit logs maintained
5. **User-Friendly**: Clear UI pages for all authentication flows

Users will always know:
- **Username**: Their email address
- **Password**: From invitation email (first time) or reset via "Forgot password?" (later)

