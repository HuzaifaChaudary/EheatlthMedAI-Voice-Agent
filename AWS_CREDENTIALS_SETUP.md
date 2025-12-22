# AWS Credentials Setup Guide

## What are AWS Credentials?

AWS credentials are like a username and password that allow the AWS CLI (Command Line Interface) to access your AWS account programmatically. Even though you can log into the AWS Console with your regular account, the CLI needs special "access keys" to work.

## Two Types of Access:

1. **AWS Console Access** (what you have now)
   - You log in with email/password or SSO
   - Works through the web browser
   - Can't be used by command-line tools

2. **Programmatic Access** (what we need)
   - Uses Access Key ID and Secret Access Key
   - Works with AWS CLI, SDKs, and scripts
   - Required for automated deployments

---

## How to Get AWS Credentials

### Option 1: Create Access Keys for Your User (Recommended)

1. **Log into AWS Console**
   - Go to: https://console.aws.amazon.com
   - Sign in with your account

2. **Go to IAM (Identity and Access Management)**
   - Click on your username (top right)
   - Click **"Security credentials"**
   - OR go directly to: https://console.aws.amazon.com/iam/home#/security_credentials

3. **Create Access Key**
   - Scroll down to **"Access keys"** section
   - Click **"Create access key"**
   - Choose use case: **"Command Line Interface (CLI)"**
   - Click **"Next"**
   - Add description (optional): "EC2 Deployment"
   - Click **"Create access key"**

4. **Save Your Keys**
   - **Access Key ID**: Copy this (looks like: `AKIAIOSFODNN7EXAMPLE`)
   - **Secret Access Key**: Copy this immediately - you can only see it once!
   - Click **"Download .csv file"** to save them securely
   - ⚠️ **IMPORTANT**: Never share these keys or commit them to Git!

### Option 2: Use AWS SSO (If Your Organization Uses It)

If your AWS account uses Single Sign-On (SSO):

```bash
# Configure AWS SSO
aws configure sso

# Follow the prompts:
# - SSO start URL: (your organization's SSO URL)
# - SSO region: (e.g., us-east-1)
# - Account ID: (your AWS account ID)
# - Role name: (usually "AdministratorAccess" or similar)
```

---

## How to Configure AWS CLI

### Method 1: Interactive Configuration (Easiest)

```bash
aws configure
```

You'll be asked for:
1. **AWS Access Key ID**: Paste your Access Key ID
2. **AWS Secret Access Key**: Paste your Secret Access Key
3. **Default region name**: e.g., `us-east-1`, `us-west-2`, etc.
4. **Default output format**: `json` (recommended)

This saves credentials to: `~/.aws/credentials`

### Method 2: Environment Variables

Set them in your terminal session:

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_DEFAULT_REGION=us-east-1
```

Or add to your `~/.zshrc` or `~/.bashrc`:

```bash
echo 'export AWS_ACCESS_KEY_ID=your-access-key-id' >> ~/.zshrc
echo 'export AWS_SECRET_ACCESS_KEY=your-secret-access-key' >> ~/.zshrc
echo 'export AWS_DEFAULT_REGION=us-east-1' >> ~/.zshrc
source ~/.zshrc
```

### Method 3: Credentials File (Manual)

Create/edit `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = your-access-key-id
aws_secret_access_key = your-secret-access-key
```

Create/edit `~/.aws/config`:

```ini
[default]
region = us-east-1
output = json
```

---

## Verify Your Configuration

After configuring, test it:

```bash
# Check if credentials work
aws sts get-caller-identity

# Should return something like:
# {
#     "UserId": "AIDAXXXXXXXXXXXXXXXXX",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/your-username"
# }
```

---

## Security Best Practices

1. **Never Commit Credentials to Git**
   - Add `~/.aws/` to `.gitignore`
   - Never put keys in code files

2. **Use IAM Roles** (For EC2 instances)
   - Instead of storing keys on EC2, use IAM roles
   - More secure and easier to manage

3. **Rotate Keys Regularly**
   - Change access keys every 90 days
   - Delete old keys after creating new ones

4. **Use Least Privilege**
   - Don't give admin access if not needed
   - Create specific IAM policies for deployment

5. **Use AWS Secrets Manager** (For production)
   - Store secrets securely
   - Rotate automatically

---

## Quick Setup Commands

```bash
# 1. Install AWS CLI (if not installed)
# macOS:
brew install awscli

# Or download from: https://aws.amazon.com/cli/

# 2. Configure credentials
aws configure

# 3. Test configuration
aws sts get-caller-identity

# 4. List your EC2 instances (test)
aws ec2 describe-instances --region us-east-1

# 5. List your key pairs (needed for deployment)
aws ec2 describe-key-pairs --region us-east-1
```

---

## Troubleshooting

### "Unable to locate credentials"
- Run `aws configure` to set up credentials
- Or set environment variables

### "Access Denied"
- Check your IAM user has necessary permissions
- Verify the access key is active
- Check if your account has billing enabled

### "Invalid credentials"
- Verify Access Key ID and Secret Access Key are correct
- Check if keys were rotated/deleted
- Create new access keys if needed

---

## For Your Deployment Script

Once you have credentials configured, you can run:

```bash
./deploy-ec2.sh
```

The script will automatically:
- Use your configured credentials
- Ask for region and key pair name
- Create the EC2 instance with all settings

---

## Alternative: Use AWS Console (No CLI Needed)

If you prefer not to use CLI, you can:
1. Go to AWS Console → EC2
2. Click "Launch instance"
3. Follow the manual steps in `AWS_EHEALTH.md`

But using the script is much faster! 🚀

