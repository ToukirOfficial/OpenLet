# 002: Choosing the workspace with a header

**Date:** 2 November 2026

One person can be in several workspaces, as staff in one and a tenant in another. The web app sends the chosen workspace in an `X-Workspace-Id` header on every request. The API never trusts it on its own: the global guard looks up the caller's membership (staff routes) or tenant record (portal routes) **in that workspace** on every request and refuses anything else. Every service query is then scoped by the `workspaceId` the guard resolved, never by an id from the request body.

The choice is kept in the browser's local storage only as a convenience. Losing it just means the first workspace is shown.
