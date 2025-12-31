# Switch to HuzaifaChaudary GitHub Account

## Problem
- Currently logged in as: `theharism`
- Repository belongs to: `HuzaifaChaudary`
- That's why you get "Repository not found"

## Solution: Switch GitHub Account

### Step 1: Logout Current Account
```bash
gh auth logout
```

### Step 2: Login as HuzaifaChaudary
```bash
gh auth login
```

**Follow these steps:**
1. Select: **GitHub.com**
2. Select: **HTTPS**
3. Select: **Login with a web browser**
4. Press Enter
5. Copy the code shown
6. Press Enter (will open browser)
7. **IMPORTANT**: Make sure you're logged into GitHub as `HuzaifaChaudary` in the browser
8. Paste code in browser
9. Authorize

### Step 3: Verify
```bash
gh auth status
```

Should show: `Logged in to github.com account HuzaifaChaudary`

### Step 4: Test Git
```bash
git pull origin main
```

---

## Alternative: Use Personal Access Token

If you can't switch accounts with GitHub CLI:

1. **Logout:**
   ```bash
   gh auth logout
   ```

2. **Get token for HuzaifaChaudary account:**
   - Go to: https://github.com/settings/tokens (while logged in as HuzaifaChaudary)
   - Generate new token (classic)
   - Check `repo` scope
   - Copy token

3. **Update remote:**
   ```bash
   git remote set-url origin https://YOUR_TOKEN@github.com/HuzaifaChaudary/EheatlthMedAI-Voice-Agent.git
   ```

4. **Test:**
   ```bash
   git pull origin main
   ```

---

## Quick Fix Commands

```bash
# Logout current account
gh auth logout

# Login as HuzaifaChaudary
gh auth login

# Verify
gh auth status

# Test git
git pull origin main
```
