# Enders-Sync

A zero-boilerplate RPC (Remote Procedure Call) Fullstack library for Express.js that makes calling server functions from the client feel like calling local functions.

## Features

- 🏆 **Fullstack**: both server-side and client-side libraries
- 🚀 **Zero Boilerplate**: Call server functions directly without writing fetch code
- 🔒 **Built-in Authentication**: Cookie-based auth with customizable validators
- 📡 **Auto-Discovery**: Client automatically discovers available server functions
- 🎯 **Type-Safe**: Full TypeScript support
- 🪶 **Lightweight**: No dependencies except Express
- 🔄 **Promise-Based**: Works seamlessly with async/await

## Table of Content

- [Enders-Sync](#enders-sync)
  - [Features](#features)
  - [Table of Content](#table-of-content)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [Server Setup](#server-setup)
    - [Client Setup](#client-setup)
    - [React Example](#react-example)
  - [Authentication](#authentication)
    - [Custom Validator](#custom-validator)
  - [Security Considerations](#security-considerations)
    - [Multiple RPC Endpoints](#multiple-rpc-endpoints)
  - [API Reference](#api-reference)
    - [Server API](#server-api)
      - [`useExpressRPC(app, path, validator, cookieKey?)`](#useexpressrpcapp-path-validator-cookiekey)
      - [`RPC.add(functionHandler)`](#rpcaddfunctionhandler)
      - [`RPC.dump()`](#rpcdump)
    - [Client API](#client-api)
      - [`new RPC(url)`](#new-rpcurl)
      - [`await rpc.load()`](#await-rpcload)
      - [`await rpc.call(name, params)`](#await-rpccallname-params)
  - [Endpoints](#endpoints)
  - [Error Handling](#error-handling)
    - [Server-Side Errors](#server-side-errors)
    - [Client-Side Error Handling](#client-side-error-handling)
  - [TypeScript Support](#typescript-support)
    - [Server-Side Types](#server-side-types)
    - [Client-Side Types](#client-side-types)
  - [Best Practices](#best-practices)
  - [Example: Complete App](#example-complete-app)
  - [License](#license)
  - [Contributing](#contributing)

## Installation

[Go Back](#table-of-content)

on the server:

```bash
npm install enders-sync
```

on the client:

```bash
npm install enders-sync-client
```

## Quick Start

[Go Back](#table-of-content)

### Server Setup

[Go Back](#table-of-content)

```javascript
import express from 'express';
import { useExpressRPC } from 'enders-sync';

const app = express();
app.use(express.json());

// Create a public RPC endpoint (no authentication required)
const publicRPC = useExpressRPC(app, '/api/public', () => ({
  success: true,
  metadata: { role: 'public' }
}));

// Register your functions
publicRPC.add(function getUser(auth_metadata, userId) {
  return { id: userId, name: 'John Doe', email: 'john@example.com' };
});

publicRPC.add(function calculateSum(auth_metadata, a, b) {
  return a + b;
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Client Setup

[Go Back](#table-of-content)

**api.js**:

```javascript
import { RPC } from 'enders-sync-client';

// Create RPC client instance
export const api = new RPC('/api/public');

// Load available functions (call once on app initialization)
await api.load();

// Now call server functions as if they were local!
const user = await api.getUser(123);
console.log(user); // { id: 123, name: 'John Doe', email: 'john@example.com' }

const sum = await api.calculateSum(5, 10);
console.log(sum); // 15
```

**App.jsx**:

### React Example

[Go Back](#table-of-content)

```jsx
import { useEffect, useState } from 'react';
import { api } from './api';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUser(userId)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  return <div>{user.name}</div>;
}
```

## Authentication

[Go Back](#table-of-content)

### Custom Validator

[Go Back](#table-of-content)

```javascript
import express from 'express';
import jwt from 'jsonwebtoken';
import { useExpressRPC } from 'enders-sync';

const app = express();


// create a validator for your Auth and access control
function authUser(cookie) {
    try {
      const token = cookie; // or parse from cookie string
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      return {
        success: true,
        metadata: { 
          userId: decoded.userId,
          role: decoded.role 
        }
      };
    } catch (error) {
      return { success: false };
    }
}


const authenticatedRPC = useExpressRPC (
    app, 
    '/api/user',
    authUser,
  'auth_token' // custom cookie key (default: 'token')
);


// Access auth metadata in your functions
authenticatedRPC.add( function getMyProfile(auth_metadata) {
  const userId = auth_metadata.userId;
  // Fetch user profile using authenticated userId
  return { id: userId, name: 'Current User' };
});
```

## Security Considerations

[Go Back](#table-of-content)

- Always validate and sanitize RPC function inputs
- Use different validators for different permission levels
- Consider rate limiting for public endpoints
- The auth metadata is trusted - ensure your validator is secure

### Multiple RPC Endpoints

[Go Back](#table-of-content)

```javascript
// Public API (no auth)
const publicRPC = useExpressRPC(app, '/api/public', () => ({
  success: true,
  metadata: {}
}));

// User API (requires authentication)
const userRPC = useExpressRPC(app, '/api/user', validateUserToken);

// Admin API (requires admin role)
const adminRPC = useExpressRPC(app, '/api/admin', validateAdminToken);
```

**Client:**

```javascript
import { RPC } from "enders-sync-client"

export const publicAPI = new RPC('/api/public');
export const userAPI = new RPC('/api/user');
export const adminAPI = new RPC('/api/admin');

// Load all APIs
await Promise.all([
  publicAPI.load(),
  userAPI.load(),
  adminAPI.load()
]);
```

## API Reference

[Go Back](#table-of-content)

### Server API

[Go Back](#table-of-content)

#### `useExpressRPC(app, path, validator, cookieKey?)`

[Go Back](#table-of-content)

Creates an RPC endpoint on your Express app.

**Parameters:**

- `app` (Express): Your Express application instance
- `path` (string): Base path for the RPC endpoint (e.g., `/api/public`)
- `validator` (Function): Authentication validator function
- `cookieKey` (string, optional): Cookie key to extract auth token from (default: `'token'`)

**Returns:** `RPC` instance

**Validator Function:**

```typescript
type Validator = (cookie: string) => {
  success: boolean;
  metadata?: Record<string, string | number>;
}
```

#### `RPC.add(functionHandler)`

[Go Back](#table-of-content)

Registers a function to be callable via RPC.

**Requirements:**

- Function must be a named function (not arrow function)
- First parameter must be `auth_metadata`
- Remaining parameters are the RPC call arguments

```javascript
rpc.add(function myFunction(auth_metadata, param1, param2) {
  // Your logic here
  return result;
});
```

#### `RPC.dump()`

[Go Back](#table-of-content)

Returns an array of all registered function names.

```javascript
const functions = rpc.dump();
console.log(functions); // ['getUser', 'calculateSum', ...]
```

### Client API

[Go Back](#table-of-content)

#### `new RPC(url)`

[Go Back](#table-of-content)

Creates a new RPC client instance.

**Parameters:**

- `url` (string): Base URL of the RPC endpoint (e.g., `/api/public`)

#### `await rpc.load()`

[Go Back](#table-of-content)

Discovers and loads all available RPC functions from the server. Must be called before using any remote functions.

**Returns:** `Promise<void>`

#### `await rpc.call(name, params)`

[Go Back](#table-of-content)

Manually call an RPC function (usually not needed - use auto-generated methods instead).

**Parameters:**

- `name` (string): Function name
- `params` (Array): Function parameters

**Returns:** `Promise<any>`

## Endpoints

[Go Back](#table-of-content)

When you create an RPC endpoint at `/api/public`, two routes are automatically created:

- `GET /api/public/discover` - Returns list of available functions
- `POST /api/public/call` - Executes RPC calls

## Error Handling

[Go Back](#table-of-content)

### Server-Side Errors

[Go Back](#table-of-content)

```javascript
publicRPC.add(function riskyOperation(auth_metadata, data) {
  if (!data) {
    throw new Error('Data is required');
  }
  // Process data
  return result;
});
```

### Client-Side Error Handling

[Go Back](#table-of-content)

```javascript
try {
  const result = await api.riskyOperation(null);
} catch (error) {
  console.error('RPC Error:', error.message);
  // Handle error appropriately
}

// Or with promises
api.riskyOperation(data)
  .then(result => console.log('Success:', result))
  .catch(error => console.error('Error:', error));
```

## TypeScript Support

[Go Back](#table-of-content)

### Server-Side Types

[Go Back](#table-of-content)

```typescript
import { type AuthMetadata } from 'enders-sync';

interface User{
    id:
}

function getUser(
  auth_metadata: AuthMetadata
): User {
  return {
    id: auth_metadata.id! , // members are validated by the validator
    name: 'John Doe',
    email: 'john@example.com'
  };
};


// ...


// then you register the backend function
publicRPC.add(getUser);
```

### Client-Side Types

[Go Back](#table-of-content)

```typescript
import { RPC } from 'enders-sync-client';

export interface PublicAPI {
  getUser(userId: number): Promise<{ id: number, name: string , email: string }>;
  calculateSum(a: number, b: number): Promise<number>;
}

export const public_api = new RPC('/api/public') as PublicAPI;
await public_api.load();

// Now you get full type safety!
const user: User = await public_api.getUser(123);
```

## Best Practices

[Go Back](#table-of-content)

1. **Initialize once**: Call `api.load()` once when your app starts, not on every component mount
2. **Error handling**: Always handle errors from RPC calls
3. **Named functions**: Use named functions (not arrow functions) for RPC handlers
4. **Validation**: Validate input parameters in your RPC functions
5. **Authentication**: Use different RPC endpoints for different permission levels
6. **Async operations**: RPC handlers can be async functions

## Example: Complete App

[Go Back](#table-of-content)

**server.js**:

```javascript
import express from 'express';
import { useExpressRPC } from 'enders-sync';

const app = express();
app.use(express.json());

const publicRPC = useExpressRPC(app, '/api/public', () => ({
  success: true,
  metadata: {}
}));

// Database mock
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' }
];

publicRPC.add(function getUsers(auth_metadata) {
  return users;
});

publicRPC.add(function getUserById(auth_metadata, id) {
  const user = users.find(u => u.id === id);
  if (!user) throw new Error('User not found');
  return user;
});

publicRPC.add(async function searchUsers(auth_metadata, query) {
  // Simulate async database query
  await new Promise(resolve => setTimeout(resolve, 100));
  return users.filter(u => 
    u.name.toLowerCase().includes(query.toLowerCase())
  );
});

app.listen(3000);
```

**api.js**:

```javascript
import { RPC } from 'enders-sync-client';

export const api = new RPC('/api/public');
```

**app.js**:

```javascript
import { api } from './api.js';

// Initialize
await api.load();

// Use anywhere in your app
const users = await api.getUsers();
console.log(users);

const alice = await api.getUserById(1);
console.log(alice);

const results = await api.searchUsers('bob');
console.log(results);
```

## License

[Go Back](#table-of-content)

MIT © Hussein Layth Al-Madhachi

## Contributing

[Go Back](#table-of-content)

Contributions are welcome! Please feel free to submit a Pull Request.
