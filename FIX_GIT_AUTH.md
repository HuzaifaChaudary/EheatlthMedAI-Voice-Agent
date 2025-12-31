# Fix Git Authentication for huzaifachaudary

## Current Issue
- Git remote is set to: `https://github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git`
- Git user is: `theharism` (needs to be `HuzaifaChaudary`)
- Getting "Repository not found" error

## Solution

### Option 1: Use GitHub Personal Access Token (Recommended)

1. **Create a Personal Access Token**:
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token" → "Generate new token (classic)"
   - Name: "EHealthMedAI Local Development"
   - Scopes: Check `repo` (full control of private repositories)
   - Click "Generate token"
   - **Copy the token** (you won't see it again!)

2. **Update Git Remote with Token**:
   ```bash
   # Replace YOUR_TOKEN with the token you just created
   git remote set-url origin https://YOUR_TOKEN@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git
   ```

3. **Test**:
   ```bash
   git pull origin main
   ```

### Option 2: Use SSH (More Secure)

1. **Check if you have SSH key**:
   ```bash
   ls -la ~/.ssh/id_rsa.pub
   ```

2. **If no key, generate one**:
   ```bash
   ssh-keygen -t rsa -b 4096 -C "chhuzaifaiftikhar@gmail.com"
   # Press Enter to accept default location
   # Press Enter for no passphrase (or set one)
   ```

3. **Add SSH key to GitHub**:
   ```bash
   # Copy your public key
   cat ~/.ssh/id_rsa.pub
   # Copy the output
   ```
   
   Then:
   - Go to: https://github.com/settings/keys
   - Click "New SSH key"
   - Title: "MacBook Pro" (or your computer name)
   - Paste the key
   - Click "Add SSH key"

4. **Update Git Remote to SSH**:
   ```bash
   git remote set-url origin git@github.com:HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git
   ```

5. **Test**:
   ```bash
   git pull origin main
   ```

### Option 3: Use GitHub CLI (Easiest)

1. **Install GitHub CLI** (if not installed):
   ```bash
   brew install gh
   ```

2. **Authenticate**:
   ```bash
   gh auth login
   # Follow prompts:
   # - GitHub.com
   # - HTTPS
   # - Login with web browser
   # - Authorize
   ```

3. **Test**:
   ```bash
   git pull origin main
   ```

---

## Quick Fix (If You Have Token)

```bash
# Get your token from GitHub settings
# Then run:
git remote set-url origin https://YOUR_TOKEN@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git

# Test
git pull origin main
```

---

## Verify Setup

```bash
# Check remote URL
git remote -v

# Check git user
git config user.name
git config user.email

# Test connection
git ls-remote origin
```

---

## After Fixing

Once authentication works:

```bash
# Stage changes
git add .

# Commit
git commit -m "Add auto-answer endpoint for testing"

# Push
git push origin main

# Deploy to production
./deploy-to-production.sh
```
