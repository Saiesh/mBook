# Auth API Routes Implementation

## Overview
Implemented three authentication API routes using Supabase Auth, following the existing repository patterns in the codebase.

## API Routes Created

### 1. POST `/api/auth/login`
**Location:** `app/api/auth/login/route.ts`

**Purpose:** Authenticate users with email and password

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "admin|ho_qs|site_qs"
    },
    "session": {
      "access_token": "jwt_token",
      "refresh_token": "refresh_token",
      "expires_at": 1234567890
    }
  }
}
```

**Error Responses:**
- `400`: Missing email or password
- `401`: Invalid credentials
- `500`: Server error

**Implementation Details:**
- Uses `supabase.auth.signInWithPassword()`
- Returns JWT token for subsequent authenticated requests
- Extracts user metadata (name, role) from auth user

---

### 2. POST `/api/auth/logout`
**Location:** `app/api/auth/logout/route.ts`

**Purpose:** Sign out current user and clear session

**Request Body:** None

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `500`: Server error

**Implementation Details:**
- Uses `supabase.auth.signOut()`
- Clears the user session
- Simple and straightforward

---

### 3. GET `/api/auth/me`
**Location:** `app/api/auth/me/route.ts`

**Purpose:** Get current authenticated user details

**Headers Required:**
```
Authorization: Bearer <jwt_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "phone": "+1234567890",
    "role": "admin|ho_qs|site_qs",
    "isActive": true,
    "lastLoginAt": "2024-02-15T10:30:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-02-15T10:30:00Z"
  }
}
```

**Error Responses:**
- `401`: Missing or invalid token
- `404`: User not found
- `500`: Server error

**Implementation Details:**
- Extracts Bearer token from Authorization header
- Uses `supabaseAdmin.auth.getUser(token)` to validate token
- Fetches full user data from `public.users` table
- Returns complete user profile including role and status

---

## Architecture Patterns Followed

### 1. Consistent with Existing Codebase
- Follows the same response format as `/api/projects/route.ts`
- Success: `{ success: true, data: {...} }`
- Error: `{ success: false, error: "message" }`

### 2. Proper Error Handling
- Validates input data
- Returns appropriate HTTP status codes
- Logs errors to console for debugging
- Provides user-friendly error messages

### 3. Supabase Integration
- Uses `supabase` client for authentication operations (login/logout)
- Uses `supabaseAdmin` client for token validation and user data fetching
- Leverages Supabase Auth's built-in JWT and session management

### 4. Type Safety
- Uses TypeScript for type safety
- Imports from Next.js (`NextRequest`, `NextResponse`)
- Compatible with existing `User` and `UserRole` types from `lib/user-management/types.ts`

---

## Usage Examples

### Login Flow
```typescript
// Frontend code
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const { success, data, error } = await response.json();

if (success) {
  // Store access_token for subsequent requests
  localStorage.setItem('access_token', data.session.access_token);
  // Redirect to dashboard
  window.location.href = '/admin';
} else {
  // Show error message
  alert(error);
}
```

### Get Current User
```typescript
// Frontend code
const token = localStorage.getItem('access_token');

const response = await fetch('/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { success, data, error } = await response.json();

if (success) {
  // Use user data
  console.log('Current user:', data);
} else {
  // Token expired or invalid, redirect to login
  window.location.href = '/login';
}
```

### Logout Flow
```typescript
// Frontend code
const response = await fetch('/api/auth/logout', {
  method: 'POST'
});

const { success } = await response.json();

if (success) {
  // Clear stored token
  localStorage.removeItem('access_token');
  // Redirect to login
  window.location.href = '/login';
}
```

---

## Security Considerations

1. **Token Validation**: `/api/auth/me` validates JWT tokens using Supabase Admin API
2. **Password Security**: Passwords are handled by Supabase Auth (hashed, salted, secured)
3. **Session Management**: Leverages Supabase's built-in session handling
4. **Error Messages**: Generic error messages for invalid credentials (doesn't reveal if email exists)

---

## Next Steps

These API routes are ready for integration with:
1. **AuthContext** (frontend context provider)
2. **Login Page** (UI for user login)
3. **Middleware** (route protection for `/admin/*`)
4. **Admin User Management** (user list and creation)

---

## Testing

To test these endpoints manually:

### Test Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Get Current User
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout
```

---

## Files Created
- `app/api/auth/login/route.ts` (2,288 bytes)
- `app/api/auth/logout/route.ts` (1,086 bytes)
- `app/api/auth/me/route.ts` (2,634 bytes)

**Total:** 3 files, ~6KB of code
