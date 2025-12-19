# Email Reminder Troubleshooting Guide

If you see "Reminder sent successfully!" but didn't receive the email, follow these steps:

## Common Issues and Solutions

### 1. Check Spam/Junk Folder
**Most common issue!** Emails often end up in spam folders, especially:
- If using Gmail, check the "Spam" folder
- If using Outlook, check "Junk Email"
- Check your email client's spam filter settings

### 2. Verify Email Configuration

Go to: `http://localhost:3000/architecture/reminders`

**Check these settings:**
- ✅ SMTP Enabled toggle is ON
- ✅ SMTP Host is correct (e.g., `smtp.gmail.com` for Gmail)
- ✅ SMTP Port is correct (587 for Gmail, 465 for SSL)
- ✅ SMTP User (your email) is correct
- ✅ SMTP Password is correct (for Gmail, use an App Password, not your regular password)
- ✅ From Email is valid

### 3. Test Email Configuration

On the reminder configuration page:
1. Enter your email address in the "Test Email" field
2. Click "Test Email"
3. Check if the test email arrives
4. If test email fails, check the error message

### 4. Gmail-Specific Issues

**If using Gmail:**

1. **Enable 2-Factor Authentication** on your Google account
2. **Create an App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
   - Use this password (not your regular Gmail password) in SMTP Password field

3. **SMTP Settings for Gmail:**
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Secure: `false` (SSL/TLS is handled automatically on port 587)
   - User: your Gmail address
   - Password: App Password (16 characters)

### 5. Check Backend Logs

Check your backend console for detailed error messages:

```bash
# Look for errors like:
Error sending email reminder: ...
Full error details: ...
```

Common error codes:
- `EAUTH`: Authentication failed (wrong username/password)
- `ECONNECTION`: Connection failed (wrong host/port)
- `ETIMEDOUT`: Connection timeout
- `EENVELOPE`: Invalid email address

### 6. Verify Email Address

Make sure the appointment has a valid email address:
1. Go to `/appointments`
2. Check the appointment's email field
3. Verify it's a valid email format

### 7. Check Email Service Limits

Some email providers have sending limits:
- **Gmail:** 500 emails/day for free accounts
- **Outlook:** 300 emails/day
- **Custom SMTP:** Check with your provider

### 8. Network/Firewall Issues

If using a corporate network:
- Check if SMTP ports (587, 465) are blocked
- Verify firewall settings
- Try from a different network

### 9. Detailed Error Information

After sending a reminder, check the alert message. It should show:
- ✅ Email sent successfully with Message ID
- ❌ Error details if it failed

If you see an error, it will include:
- Error message
- Error code (if available)
- SMTP response (if available)

## Testing Steps

1. **Test Configuration:**
   ```
   1. Go to /architecture/reminders
   2. Configure SMTP settings
   3. Click "Test Email" button
   4. Check your inbox (and spam)
   ```

2. **Send Reminder:**
   ```
   1. Go to /appointments
   2. Find a scheduled appointment
   3. Click "Send Reminder"
   4. Choose "Send Email Reminder"
   5. Check the alert message for details
   6. Check your email inbox AND spam folder
   ```

3. **Check Backend Logs:**
   ```bash
   # In your backend terminal, look for:
   Email sent successfully: {
     messageId: '...',
     accepted: ['...'],
     ...
   }
   
   # Or errors like:
   Error sending email reminder: ...
   ```

## Quick Fixes

**If test email works but reminders don't:**
- Check the appointment's email address
- Verify the appointment exists and is scheduled

**If test email doesn't work:**
- Verify SMTP credentials
- For Gmail, make sure you're using App Password
- Check SMTP host and port settings
- Try a different email provider

**If emails go to spam:**
- This is normal behavior - check spam folder
- Add the "From Email" to your contacts
- Configure SPF/DKIM records (advanced, for production)

## Still Not Working?

1. Check backend console logs for detailed errors
2. Verify all SMTP settings are correct
3. Test with a different email provider
4. Check if your email provider blocks automated emails
5. Verify the appointment email address is correct

## For Developers

To see more detailed logs, check the backend console when sending reminders. The logs will show:
- Email sending attempts
- SMTP responses
- Error codes and messages
- Accepted/rejected recipients

