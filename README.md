# Re-Wear Bahrain — Backend API

A RESTful Express/MongoDB API powering Re-Wear Bahrain, a gamified peer-to-peer circular fashion platform. Users earn **Eco-Credits** by giving clothes away and spend them to claim items from neighbours across Bahrain.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Database | MongoDB Atlas (Mongoose 8) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| File Uploads | multer (local disk storage) |
| Environment | dotenv |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env file (see section below)

# 3. Seed the database with sample Bahraini users & items
node seed.js

# 4. Start the server (port 3000)
npm start
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
MONGODB_URI=mongodb://your-host/ReWearBhDataBase
JWT_SECRET=your-super-secret-key
```

> **Note:** A direct `mongodb://` URI is used instead of SRV because some home routers do not resolve SRV DNS records. Replace with your MongoDB Atlas connection string.

---

## API Reference

### Auth `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/sign-up` | — | Register (returns JWT) |
| POST | `/auth/sign-in` | — | Login (returns JWT) |

**Sign-up body:**
```json
{
  "username": "fatima_seef",
  "password": "SecurePass1",
  "neighborhood": "Seef",
  "customNeighborhood": ""
}
```
Usernames: 3–30 chars, alphanumeric + underscore. Password: 6–72 chars.

---

### Items `/items`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/items` | — | Browse available items (paginated) |
| GET | `/items/:id` | — | Single item detail |
| POST | `/items` | ✓ | Create a listing |
| PATCH | `/items/:id` | ✓ | Edit listing (owner, available only) |
| DELETE | `/items/:id` | ✓ | Delete listing (owner only) |

**Browse query params:**
```
?neighborhood=Juffair&category=tops&page=2&limit=12
```
Default: `page=1`, `limit=20`. Categories: `tops` `bottoms` `dresses` `outerwear` `footwear` `accessories` `kids` `other`.

---

### Swaps `/swaps`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/swaps` | ✓ | Request an item (spends credits) |
| GET | `/swaps/mine` | ✓ | All swaps for logged-in user |
| PATCH | `/swaps/:id/respond` | ✓ | Owner replies with a message |
| PATCH | `/swaps/:id/approve` | ✓ | Owner approves pickup |
| PATCH | `/swaps/:id/complete` | ✓ | Owner marks item as collected (+30 credits, badge check) |
| PATCH | `/swaps/:id/cancel` | ✓ | Either party cancels (owner can include a reason) |

**Swap lifecycle:**
```
requested → [owner replies] → approved → completed
         ↘ cancelled (owner includes optional reason, credits refunded)
```

---

### Users `/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me/profile` | ✓ | Own profile + active listings |
| PATCH | `/users/me/location` | ✓ | Update neighbourhood |
| GET | `/users/:id` | — | Public profile |

---

### Upload `/upload`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/upload` | ✓ | Upload item photo |

**Request:** `multipart/form-data`, field name `image`. Max 8 MB, images only.  
**Response:** `{ "url": "http://localhost:3000/uploads/filename.jpg" }`  
Uploaded files are served statically at `/uploads/*`.

---

## Eco-Credit Economy

| Event | Credits |
|---|---|
| Sign up | +100 |
| Claim an item | −(item price, 0–50) |
| Item picked up (as owner) | +30 |

### Badges — awarded to givers

| Badge | Items Given |
|---|---|
| 🌱 Eco Starter | 1 |
| 🌿 Green Giver | 5 |
| 🌍 Sustainability Hero | 15 |
| 🏆 Bahrain Eco Champion | 30 |

---

## Seed Data

```bash
node seed.js
```

Creates **38** Bahraini users spread across all governorates and **52** clothing items (abayas, kanduras, thobes, jalabiyas, Western wear, kids wear, footwear).  
All seed users share the password: `Rewear2025`

---

## Project Structure

```
controllers/
  auth.routes.js      — sign-up / sign-in
  items.routes.js     — item CRUD + paginated browse
  swaps.routes.js     — full swap lifecycle with messaging
  users.routes.js     — profile management
  upload.routes.js    — multer photo upload
middleware/
  verify-token.js     — JWT auth guard
models/
  User.js             — user schema (40+ Bahrain neighbourhoods, badges)
  Item.js             — item schema (GeoJSON location, 2dsphere index)
  Swap.js             — swap schema (messaging, cancel reason, badges)
uploads/              — uploaded images (auto-created on first upload)
seed.js               — database seeder
server.js             — Express entry point
```

---

*Inspired by Omar · Re-Wear Bahrain — keeping clothes in use, one neighbour at a time.*
