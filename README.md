# The Agentcy UK - Backend API Service

A production-ready Node.js REST API backend powering **The Agentcy UK** AI-native property advice platform ([lovely-bonbon-c174b5.netlify.app](https://lovely-bonbon-c174b5.netlify.app/)).

Features include:
- **Authentication**: User signup, login, password reset (`/auth/*`), JWT token generation, and PBKDF2 password hashing.
- **Multi-Agent Property Specialist AI Router**: Intelligent routing for **Aida** (Head of Property) and 7 UK property specialists (**Valentina** - Valuations, **Miles** - Mortgages, **Noah** - Landlords & Tenants, **Sienna** - Seller Strategy, **Clara** - Buying, **Theo** - Investment, **Iris** - Conveyancing) with automatic `@@specialist` routing tags.
- **AI Engine Support**: Native Anthropic Claude API, OpenAI API, and Gemini API integration with automatic fallback to a built-in UK Property AI intelligence engine.
- **User Dashboard & Conversation History**: Tracks user sessions, question counts, and multi-turn message history (`/me`, `/history`, `/chat`).
- **Human Handover System**: Automated brief generation (`/handover`) when a user requests to speak to a licensed human professional.
- **Team Console Admin Portal API**: Internal management endpoints (`/admin/users`, `/admin/conversation`) secured via `ADMIN_KEY`.

---

## 🚀 Quick Start (Local Development)

### 1. Run Server
Run using `agy-node`:
```bash
agy-node src/server.js
```
Or standard Node.js:
```bash
node src/server.js
```

### 2. Run Integration Tests
Verify all API endpoints and database operations:
```bash
agy-node test-backend.js
```

The server runs on **`http://localhost:3000`**.

---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file in the project root:

```env
PORT=3000
JWT_SECRET=agentcy_uk_jwt_secret_key_2026_super_secure
ADMIN_KEY=agentcy_admin_secret_2026

# Optional: Add LLM API keys for live AI completion
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

FRONTEND_URL=https://lovely-bonbon-c174b5.netlify.app
```

---

## 🔗 Connecting Your Netlify Frontend

To connect your frontend site (`https://lovely-bonbon-c174b5.netlify.app/`) to this backend:

1. Open `js/config.js` in your Netlify site repository.
2. Set `window.AIDA_ENDPOINT`:
```js
window.AIDA_ENDPOINT = "http://localhost:3000"; // For local testing
// OR your deployed backend URL:
// window.AIDA_ENDPOINT = "https://your-backend-api.onrender.com";
```
3. Deploy or refresh your Netlify frontend.

---

## 📚 API Endpoint Reference

### 1. Public & Auth Endpoints
| Method | Endpoint | Description | Payload |
|---|---|---|---|
| `GET` | `/health` | Server status | None |
| `POST` | `/chat/anon` | Homepage taster chat | `{ "message": "..." }` |
| `POST` | `/auth/signup` | Create account | `{ "email": "...", "password": "...", "name": "..." }` |
| `POST` | `/auth/login` | Sign in | `{ "email": "...", "password": "..." }` |
| `POST` | `/auth/forgot` | Password reset link | `{ "email": "..." }` |
| `POST` | `/auth/reset` | Set new password | `{ "token": "...", "newPassword": "..." }` |

### 2. Consumer Advice Room (Requires `Authorization: Bearer <token>`)
| Method | Endpoint | Description | Response / Payload |
|---|---|---|---|
| `GET` | `/me` | Get profile & msg stats | `{ name, email, msgCount, handover }` |
| `GET` | `/history` | Conversation transcript | `{ messages: [...] }` |
| `POST` | `/chat` | Send question | `{ "message": "..." }` -> `{ reply: "@@specialist ..." }` |
| `POST` | `/handover` | Request human handover | `{ "note": "..." }` |

### 3. Team Console (Requires Admin Key)
| Method | Endpoint | Description | Query Params |
|---|---|---|---|
| `GET` | `/admin/users` | List consumers & handover flags | `?key=agentcy_admin_secret_2026` |
| `GET` | `/admin/conversation` | Full transcript & brief for user | `?email=user@example.com&key=agentcy_admin_secret_2026` |
