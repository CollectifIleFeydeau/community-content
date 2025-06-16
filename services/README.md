# Community Content Services

This directory contains shared services used by the Collectif Feydeau applications to manage community contributions.

## Overview

These services provide a centralized implementation for community-related functionality that can be used across multiple repositories in the Collectif Feydeau project ecosystem. By centralizing these services, we ensure consistent behavior and reduce code duplication.

## Services

### communityService.js

The main service file that provides the following functionality:

- **Fetching community entries**: Get all community contributions or featured entries
- **Deleting community entries**: Remove entries and close associated GitHub issues
- **Toggling likes**: Add or remove likes from entries
- **Submitting contributions**: Process and submit new community contributions
- **Moderating content**: Check content against moderation rules
- **Uploading images**: Process and store images for community contributions

## Usage

The services can be imported into other repositories using a dynamic import bridge. For example, in the main application:

```typescript
// communityServiceBridge.ts
import type { CommunityEntry, ModerationResult } from '../types/communityTypes';

// Dynamic import of the community service from the community-content repository
const communityServicePromise = import('../../community-content/services/communityService.js');

// Export functions that delegate to the imported service
export async function fetchCommunityEntries(): Promise<CommunityEntry[]> {
  const module = await communityServicePromise;
  return module.fetchCommunityEntries();
}

// ... other function exports
```

## Environment Detection

The services automatically detect the environment they're running in:

- **Development**: Uses local storage for data persistence
- **Production**: Interacts with GitHub API via a Cloudflare Worker proxy

## API Endpoints

When running in production mode, the services interact with the following endpoints:

- `/api/fetch-community-entries`: Get all community entries
- `/api/submit-contribution`: Submit a new contribution
- `/api/toggle-like`: Add or remove a like from an entry
- `/api/delete-issue`: Close a GitHub issue (for deleting entries)
- `/api/moderate-content`: Check content against moderation rules
- `/api/upload-image`: Upload and process images

These endpoints are implemented in the Cloudflare Worker (`github-contribution-proxy`).
