# Sub-Accounts (Organizations) - Technical Explanation

## How Sub-Accounts Work

The platform uses a multi-tenant architecture where each client gets their own isolated organization (sub-account) in the database. Every resource in the system - users, AI agents, phone numbers, calls, and conversations - is linked to an `organization_id` field, which acts as a data isolation boundary. When a regular user logs in, the system queries only resources where `organization_id` matches their assigned organization, ensuring complete data separation between clients. This means Client A cannot see, access, or modify any data belonging to Client B, even though they're using the same application instance.

As the master administrator, your account has elevated permissions that bypass organization-level filtering. The Admin Dashboard provides a centralized view of all organizations through the `/api/organizations/all` endpoint, which aggregates resource counts (users, agents, phone numbers) for each organization. You can drill down into any specific organization using `/api/organizations/:id/details` to view all its resources, including user lists, agent configurations, phone number assignments, and call statistics. This allows you to monitor, troubleshoot, and manage all client accounts from a single interface while maintaining strict data isolation for regular users.

