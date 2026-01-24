# Legacy Code Archive

This directory contains code that has been deprecated or replaced by the new architecture.

## Contents

### `/backend`
*   **Original Role:** Central API server using FastAPI.
*   **Reason for Deprecation:** Migrated to a decentralized Edge Worker + Supabase Cloud architecture. The frontend now talks directly to Supabase, removing the need for this middleware server.
*   **Status:** Archived for reference regarding original business logic.
