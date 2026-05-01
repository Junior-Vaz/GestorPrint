# AGENTS.md - GestorPrint Development Guide

## Project Overview

GestorPrint is a multi-tenant SaaS ERP for print shops with:
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Vue 3 + Pinia + TailwindCSS
- **SaaS Admin**: Vue 3 + TailwindCSS (tenant management)
- **WhatsApp AI**: TypeScript + Express (AI agent integration)

## Build Commands

### Backend (NestJS)
```bash
cd backend
npm run build               # Build for production
npm run start               # Run production server
npm run start:dev           # Watch mode development
npm run lint                # Lint & fix with ESLint
npm run format              # Prettier formatting
npm run test                # Run all tests
npm run test -- --testPathPattern=filename  # Run single test
npm run test:watch          # Watch mode for tests
npm run test:cov            # Coverage report
```

### Frontend (Vue 3)
```bash
cd frontend
npm run dev                 # Development server
npm run build              # Production build
npm run type-check         # TypeScript validation
npm run lint               # Run all linters (oxlint + eslint)
npm run lint:oxlint        # Fix with oxlint only
npm run lint:eslint        # Fix with ESLint only
npm run format             # Prettier formatting
npm run preview            # Preview production build
```

### SaaS Admin
```bash
cd saas-admin
npm run dev                # Development server
npm run build              # Production build
npm run type-check         # TypeScript validation
```

### WhatsApp AI
```bash
cd whatsapp-ai
npm run dev                # Watch mode (tsx)
npm run start              # Production start
# No test command configured
```

## Code Style Guidelines

### TypeScript Conventions

- **Always use explicit types** for function parameters and return values
- **Use interfaces** for data structures (not `type` unless union types needed)
- **Avoid `any`** - use `unknown` and type narrow it
- **Use strict null checks** - check for null/undefined explicitly

```typescript
// Good
interface MyPlan {
  plan: string
  displayName: string
  isActive: boolean
}

function findPlan(id: string): MyPlan | null {
  // ...
}

// Avoid
function findPlan(id: string): any { /* ... */ }
```

### Naming Conventions

- **Files**: kebab-case (`tenants.service.ts`, `create-tenant.dto.ts`)
- **Classes/Components**: PascalCase (`TenantsService`, `AppBoard.vue`)
- **Variables/Functions**: camelCase (`findAll`, `loading`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PLANS`)
- **Interfaces**: PascalCase with descriptive names

### Import Organization

Order imports precisely:
1. Node built-ins (`path`, `fs`, `crypto`)
2. External packages (`@nestjs/*`, `axios`, `three`)
3. Relative imports - internal modules (`../tenants/`, `./dto/`)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
```

### Vue 3 Composition API

- Use `<script setup lang="ts">` syntax
- Use `defineStore` from Pinia with composition API
- Use `ref` and `computed` from Vue
- Single-file components, max ~200 lines

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const usePlanStore = defineStore('plan', () => {
  const data = ref<MyPlan | null>(null)
  const loading = ref(false)

  const hasPdf = computed(() => loading.value ? false : (data.value?.hasPdf ?? false))

  return { data, loading, hasPdf }
})
```

### NestJS Patterns

- **Services**: Business logic, injectable, one per module
- **Controllers**: HTTP endpoints, validation with DTOs
- **DTOs**: Use `class-validator` for input validation
- **Guards**: Auth/permissions logic
- **Exception handling**: Use built-in `NotFoundException`, `ConflictException`, `BadRequestException`

```typescript
@Injectable()
export class TenantsService {
  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }
}
```

### Error Handling

- Use NestJS built-in exceptions
- Wrap async operations in try-catch for logging
- Return proper HTTP status codes (404 for NotFound, 409 for Conflict, 400 for BadRequest)

```typescript
async findOne(id: string) {
  const tenant = await this.prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
  return tenant;
}
```

### Database (Prisma)

- Use proper DateTime handling (full ISO format for Prisma)
- Use transactions for multi-table operations
- Prefer typed queries via Prisma client

```typescript
// Handle "2026-03-20" -> "2026-03-20T00:00:00.000Z"
function toDateTime(s?: string | null): string | null | undefined {
  if (!s) return s === null ? null : undefined;
  return s.length === 10 ? `${s}T00:00:00.000Z` : s;
}
```

### Vue Component Patterns

- Use `<script setup>` with TypeScript
- Props with `defineProps<{...}>()` and proper typing
- Emit with `const emit = defineEmits<{ (e: 'update', value: string): void }>()`
- Use TailwindCSS classes for styling

### Multi-Tenant Architecture

- Every tenant-scoped query must filter by `tenantId` (from JWT)
- Use `JwtAuthGuard` for protected routes
- Plan feature enforcement via `usePlanStore` in frontend

### Testing

- Place test files alongside source files (`*.spec.ts`)
- Use NestJS testing utilities (`Test.createTestingModule`)
- Mock Prisma with `jest.mock()` pattern

### General Best Practices

- **No comments** unless explaining complex business logic
- **Fail-closed** for feature gates (default to false while loading)
- **Environment variables** for all secrets (`.env` files)
- **CRON jobs** for scheduled tasks (`@nestjs/schedule`)
- **Logging** with NestJS Logger for observability