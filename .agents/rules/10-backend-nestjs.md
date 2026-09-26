# Backend rules — NestJS

## Module structure
Every feature is a self-contained module under `apps/api/src/modules/<feature>/`:

```
transactions/
├── transactions.module.ts
├── transactions.controller.ts     # HTTP only: params in, DTO out
├── transactions.service.ts        # business logic, orchestration
├── transactions.repository.ts     # ALL Prisma calls for this module
├── dto/                           # request/response DTOs (createZodDto)
├── entities/                      # response mappers (toDto)
└── __tests__/
```

## Layer responsibilities — do not blur these
| Layer | May do | Must never do |
|---|---|---|
| Controller | Read `@CurrentUser()`, params, body; call one service method; set HTTP status | Contain business logic; call Prisma |
| Service | Business rules, orchestration, transactions, cache invalidation | Touch `req`/`res`; write raw SQL outside the repository |
| Repository | Prisma queries, raw SQL for aggregation | Contain business rules; throw HTTP exceptions |

## Required conventions
- Global `ValidationPipe` via `nestjs-zod`. Every DTO is generated from a Zod schema in
  `packages/shared`. No `class-validator` decorators.
- Global prefix `api`, URI versioning: routes resolve as `/api/v1/...`.
- Every protected route sits behind the global `JwtAuthGuard`; public routes opt out with
  `@Public()`.
- User identity comes from `@CurrentUser()` (custom decorator reading `request.user`).
  Never read a `userId` from the request body or a query param.
- Every service method that touches user data takes `userId` as its **first** argument.
- Errors: throw domain exceptions from `src/common/exceptions/` (e.g. `InsufficientBalanceException`).
  A global `AllExceptionsFilter` maps them to the documented JSON error envelope.
- Response envelope (`{ success, data, meta? }`) is applied by a global
  `TransformInterceptor`. Do not build the envelope by hand in controllers.
- `BigInt` serialization is handled once, in `main.ts`. Do not sprinkle `.toString()` calls
  through controllers — the response mapper does it.
- Swagger decorators on every public endpoint: `@ApiOperation`, `@ApiResponse`, `@ApiTags`.
- Rate limiting via `@nestjs/throttler`: 5 req/min on auth routes, 100 req/min elsewhere.
- Logging: Pino (`nestjs-pino`), structured, with a request id. Never log tokens, passwords,
  or full request bodies containing them.

## Configuration
- All env access goes through `ConfigService` with a Zod-validated schema in
  `src/config/env.validation.ts`. The app must refuse to boot on a missing/invalid variable.
- Never read `process.env` directly outside that file.

## Database access
- Aggregations use `$queryRaw` with **parameterised** values. String concatenation into SQL
  is forbidden.
- Any multi-write operation uses `prisma.$transaction`.
- Every list endpoint is paginated and has a hard `limit` ceiling of 100.
