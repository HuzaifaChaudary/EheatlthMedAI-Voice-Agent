# User Invitation System

## Overview

The user invitation system allows administrators to invite new users to organizations (sub-accounts) and automatically send them login credentials via email. This eliminates the need to manually create users and share passwords.

## How It Works

### 1. **Inviting Users When Creating an Organization**

When creating a new organization (sub-account), you can:

**Option A: Invite a New User**
- Check "Invite New User to Organization"
- Fill in:
  - First Name
  - Last Name
  - Email
  - Role (User, Doctor, Client, Patient)
- The system will:
  1. Create the user account
  2. Generate a secure temporary password
  3. Assign the user to the new organization
  4. Send an invitation email with login credentials

**Option B: Assign Existing User**
- Leave the checkbox unchecked
- Enter an existing user's email address
- The user will be assigned to the new organization (no email sent)

### 2. **Inviting Users to Existing Organizations**

1. Go to **Admin Dashboard → Sub-Accounts (Organizations)**
2. Click on an organization to view details
3. Click **"+ Invite User"** button
4. Fill in the user details:
   - First Name
   - Last Name
   - Email
   - Role
5. Click **"Send Invitation"**

The system will:
- Create the user account
- Generate a temporary password
- Assign the user to the organization
- Send an invitation email

## Email Invitation

### What Users Receive

Users receive a professional HTML email containing:
- Welcome message
- Organization name
- Login credentials:
  - Email address
  - Temporary password
- Login link to the dashboard
- Security reminder to change password after first login

### Email Configuration

The system uses the same email configuration as appointment reminders:
- **Organization-specific SMTP** (if configured in Settings → Reminders)
- **Global SMTP** (from backend `.env` file) as fallback

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

### If Email Fails

If the email cannot be sent (e.g., SMTP not configured), the system will:
1. Still create the user account
2. Display the temporary password to the admin
3. Show a warning message
4. Admin can manually share the password with the user

**Example:**
```
✓ User created, but email failed
User: user@example.com
⚠️ Please share this temporary password manually:
TempPassword123!
Error: Email service not configured
```

## API Endpoints

### Invite User to Organization
```
POST /api/admin/users/invite
Authorization: Bearer <admin_token>

{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "user",
  "organizationId": 1
}
```

**Response:**
```json
{
  "message": "User invited successfully. Invitation email has been sent.",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "organizationId": 1,
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "emailSent": true
}
```

### Create Organization with Invitation
```
POST /api/organizations
Authorization: Bearer <admin_token>

{
  "name": "Acme Medical Group",
  "subdomain": "acme",
  "subscription_tier": "professional",
  "invite_user": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

## User Login Flow

1. **User receives invitation email**
2. **User clicks login link** (or goes to `/login`)
3. **User enters credentials:**
   - Email: `user@example.com`
   - Password: `[temporary password from email]`
4. **User logs in successfully**
5. **User should change password** (recommended via Settings page)

## Security Features

- **Temporary Passwords**: 12-character random passwords with mix of letters, numbers, and symbols
- **Password Hashing**: All passwords are hashed using bcrypt before storage
- **Email Verification**: Email format is validated before sending
- **Audit Logging**: All invitations are logged in audit_logs table
- **Organization Isolation**: Users can only access their assigned organization's resources

## Troubleshooting

### Email Not Sending

1. **Check SMTP Configuration:**
   - Go to Settings → Reminders
   - Verify SMTP settings are correct
   - Test email configuration

2. **Check Environment Variables:**
   - Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are set
   - For Gmail, use an App Password (not regular password)

3. **Check Backend Logs:**
   ```bash
   pm2 logs ehealth-backend
   ```
   Look for email-related errors

4. **Manual Password Sharing:**
   - If email fails, the temporary password is displayed to admin
   - Admin can manually share credentials with user

### User Already Exists

- If user email already exists in the system:
  - If user has no organization: User is assigned to the new organization
  - If user is in different organization: Error message shown
  - If user is already in this organization: Error message shown

### Email in Spam Folder

- Check user's spam/junk folder
- Verify `SMTP_FROM` email is not blacklisted
- Consider using a professional email service (SendGrid, AWS SES)

## UI Locations

1. **Create Organization with Invitation:**
   - Admin Dashboard → Sub-Accounts → Create New Organization
   - Check "Invite New User to Organization"

2. **Invite User to Existing Organization:**
   - Admin Dashboard → Sub-Accounts
   - Click on organization
   - Click "+ Invite User" button

3. **View Invited Users:**
   - Admin Dashboard → Sub-Accounts
   - Click on organization
   - View "Users" section

## Database Changes

No database schema changes required. The system uses existing tables:
- `users` - Stores user accounts
- `organizations` - Stores organizations
- `audit_logs` - Logs invitation actions

## Future Enhancements

Potential improvements:
- Invitation token system (expiring links)
- Resend invitation email
- Bulk user invitations
- Custom email templates per organization
- Password reset on first login requirement

