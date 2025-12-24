# How Sub-Organizations (Sub-Accounts) Appear and Work

## Overview
Sub-organizations (also called sub-accounts) are separate client accounts that are completely isolated from each other. Each sub-organization has its own:
- Users
- Agents
- Phone Numbers
- Calls and Conversations
- Settings and Configuration

## How Sub-Organizations Appear

### For Admin Users (Master Account)

1. **Admin Dashboard → Sub-Accounts Tab**
   - Go to `/admin` page
   - Click on "Sub-Accounts (Organizations)" tab
   - You'll see a list of ALL organizations with:
     - Organization name
     - Domain/subdomain
     - Resource counts (Users, Agents, Phone Numbers)
     - Subscription tier
     - Active/Inactive status

2. **Viewing Organization Details**
   - Click on any organization card
   - See detailed view showing:
     - All users in that organization
     - All agents configured
     - All phone numbers assigned
     - Call statistics

### For Regular Users (Sub-Account Users)

- Users only see their own organization's resources
- They cannot see other organizations
- Complete data isolation

## How to Create a New Sub-Organization

### Method 1: Via Admin Dashboard (Recommended)

1. **Login as Admin**
   - Go to `/admin` page
   - Click "Sub-Accounts (Organizations)" tab

2. **Click "Create New Organization" Button**
   - Top right of the organizations list

3. **Fill in the Form**:
   - **Organization Name** (required): e.g., "Acme Medical Group"
   - **Subdomain** (optional): e.g., "acme"
   - **Domain** (optional): e.g., "acme.com"
   - **Assign User** (optional): Enter email of existing user to assign to this organization
   - **Subscription Tier**: Starter, Professional, or Enterprise
   - **Max Agents**: Maximum number of agents allowed
   - **Max Users**: Maximum number of users allowed
   - **Max Calls/Month**: Maximum calls per month

4. **Click "Create Organization"**
   - The new organization will appear in the list immediately

### Method 2: Via API

```bash
POST /api/organizations
Authorization: Bearer <admin_token>

{
  "name": "Acme Medical Group",
  "subdomain": "acme",
  "domain": "acme.com",
  "subscription_tier": "professional",
  "max_agents": 10,
  "max_users": 20,
  "max_calls_per_month": 5000,
  "user_email": "user@example.com" // Optional
}
```

## Assigning Users to Organizations

### Option 1: During Organization Creation
- Enter user email in "Assign User" field when creating organization
- User must already exist in the system

### Option 2: After Creation
- Create user via Admin Dashboard → User Management
- User will need to be assigned to organization (can be done via database or future UI feature)

## What Happens When You Create a Sub-Organization

1. **Organization Created**
   - New organization record in database
   - Gets unique ID
   - Isolated from other organizations

2. **If User Email Provided**
   - That user is automatically assigned to the new organization
   - User will see only this organization's resources

3. **Organization Appears in List**
   - Shows up in Admin Dashboard → Sub-Accounts tab
   - Initially has 0 users, 0 agents, 0 phone numbers
   - Admin can click to view details

## Example Flow

1. **Admin creates "Acme Medical Group"**
   - Organization created with ID = 2
   - Assigned user: "doctor@acme.com"

2. **User "doctor@acme.com" logs in**
   - Sees only Acme Medical Group's resources
   - Can create agents, phone numbers, etc.
   - All resources are linked to organization_id = 2

3. **Admin views all organizations**
   - Sees "Acme Medical Group" in list
   - Clicks to see: 1 user, 0 agents, 0 phone numbers
   - Can monitor all sub-accounts from one place

## Data Isolation

- **Agents**: Each organization only sees their own agents
- **Phone Numbers**: Each organization only sees their own phone numbers
- **Users**: Each organization only sees their own users
- **Calls**: Filtered by organization via phone_numbers table
- **Settings**: Each organization has separate settings

## Visual Layout

```
Admin Dashboard
├── User Management Tab
│   └── All users across all organizations
│
└── Sub-Accounts (Organizations) Tab
    ├── [Create New Organization Button]
    │
    └── Organization List
        ├── Organization 1
        │   ├── Name: "Acme Medical"
        │   ├── Domain: "acme.com"
        │   ├── Users: 5
        │   ├── Agents: 3
        │   └── Phone Numbers: 2
        │
        └── Organization 2
            ├── Name: "Beta Clinic"
            ├── Domain: "beta.com"
            ├── Users: 2
            ├── Agents: 1
            └── Phone Numbers: 1
```

## Notes

- Organizations are completely isolated
- Admin can see all organizations but regular users cannot
- Each organization can have multiple users
- Resources (agents, phone numbers) are scoped to organization
- Admin can create unlimited organizations

