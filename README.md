# Re-Wear Bahrain — Backend API

Express and MongoDB API for Re-Wear BH, a bilingual community fashion exchange. Eco-Credits are non-cash community points: the requester’s credits are reserved when a request is made and transferred to the owner only after both people confirm the real handover.

## Requirements and local setup

Use Node.js 20.19+ (or 22.12+) and a MongoDB replica set. Swap creation, cancellation, dispute resolution, and settlement use MongoDB transactions; a standalone MongoDB server is not sufficient.

```bash
npm install
# Configure the environment below, then:
npm run dev
```

The API listens on port `3000` by default. `npm start` runs it without watch mode, and `npm test` runs the credit policy and schema tests.

## Configuration

Set these values in the deployment environment or a local, untracked `.env` file:

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | Yes | Replica-set MongoDB connection string |
| `JWT_SECRET` | Yes | Signing key of at least 32 characters |
| `CLIENT_ORIGINS` | Production | Comma-separated exact frontend origins; defaults to `http://localhost:5173` |
| `PUBLIC_API_URL` | Production | Public HTTPS API origin used to generate upload URLs |
| `MODERATOR_USER_IDS` | For dispute resolution | Comma-separated MongoDB user IDs permitted to review reports |
| `PORT` | No | HTTP port; defaults to `3000` |

Production signup and trading require an adult self-attestation; phone verification is not used, avoiding paid SMS services. This lowers account identity assurance, so retain the rate limits and transaction safeguards. Production trusts one reverse-proxy hop for client IP handling and rate limits (as on Render). Public production deployments must use a HTTPS-only `PUBLIC_API_URL` origin (no path), set the frontend origin allowlist, provision moderator IDs, and use a durable volume or external image store for `/uploads`; local disk storage is not suitable for ephemeral hosting. Never commit credentials.

## Product and trust rules

- Registration requires an adult self-attestation. Accounts start with 100 Eco-Credits, matching the existing product balance.
- Listing requires 1–5 photos, honest item details, a confirmation checklist, and a pickup address and Bahrain map pin. Accepted credit values come from `config/credit-policy.js`, grouped by category and condition; brand, retail price, and claimed age do not raise the cap.
- Public responses expose only approximate coordinates. Exact pickup details are withheld until owner approval and are returned only to the owner and swap participants.
- Sample records are marked as demos and cannot be signed into or traded.
- A request reserves credits and makes the listing unavailable. Approval creates an expiring, one-time handover code; settlement requires both the requester’s code confirmation and the owner’s confirmation. There is no automatic pickup bonus.
- Messaging stays open while a swap is requested, approved, or disputed. A dispute pauses settlement for moderator review. Reviews are visible to both parties only after both submit.
- Existing listings without valid root-level `pickupLocation` data are blocked from swap requests and approval. Legacy nested pickup data is removed from public responses. Back up and assess existing data before launch; there is no automatic legacy-data migration.

The community guidance is a product standard, not legal advice. Have privacy, consumer, age-verification, moderation, and data-retention terms reviewed locally in Bahrain before public launch.

## API overview

| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/sign-up`, `/auth/sign-in` | Create an adult-confirmed account or sign in |
| `GET` | `/policy/credits` | Return published credit bands and category mappings |
| `GET` | `/items`, `/items/:id` | Browse or view listings; private pickup data is access-controlled |
| `POST`, `PATCH`, `DELETE` | `/items`, `/items/:id` | Create, edit, and remove an owner’s available listing |
| `POST` | `/upload` | Upload JPEG, PNG, or WEBP image (8 MB maximum) |
| `POST` | `/swaps` | Request an item and reserve credits |
| `GET` | `/swaps/mine` | Get the current user’s swaps and eligible private pickup details |
| `PATCH` | `/swaps/:id/approve` | Owner approves and receives a one-time handover code |
| `POST` | `/swaps/:id/confirm-handover`, `/swaps/:id/confirm-owner` | Record requester and owner confirmations; settle after both |
| `POST` | `/swaps/:id/refresh-handover-code`, `/swaps/:id/cancel`, `/swaps/:id/dispute` | Refresh code, cancel/refund an eligible swap, or pause it for review |
| `GET`, `POST` | `/swaps/:id/messages`, `/swaps/:id/reviews` | Participant conversation and mutual reviews |
| `GET`, `POST` | `/swaps/moderation/disputes`, `/swaps/moderation/disputes/:id/resolve` | Moderator-only dispute queue and resolution |
| `GET`, `PATCH` | `/users/me/profile`, `/users/me/location`, `/users/me/adult-confirmation` | Own profile and account verification |
| `GET` | `/users/:id`, `/users/:id/items` | Public profile and listings without private pickup details |

Listing payloads use `images` (array of uploaded URLs) and `pickupLocation` with `type`, `address`, `instructions`, and `[longitude, latitude]` coordinates. The complete item form and swap lifecycle are implemented in the connected frontend repository.

## Demo data

Run `node seed.js` only when you intend to create sample records in the configured database. Seed users and listings are explicitly marked as demos, display a sample image, and are read-only/non-tradeable. Use a non-production database for demos.
