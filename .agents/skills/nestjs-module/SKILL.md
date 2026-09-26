---
name: nestjs-module
description: Scaffold a complete NestJS feature module for FinTrack — controller, service, repository, Zod DTOs, Swagger docs, and tests — with the ownership and layering rules already applied. Use whenever adding a new backend resource or endpoint group (accounts, budgets, tags, notifications, exports).
---

# Building a FinTrack backend module

## When to use
Adding any new resource to `apps/api`. Also use it when extending an existing module so the
new endpoint matches the established shape.

## Files to create

```
apps/api/src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts
├── <feature>.repository.ts
├── dto/<feature>.dto.ts          # createZodDto wrappers over packages/shared schemas
├── entities/<feature>.entity.ts  # toDto(): BigInt -> string, computed fields
└── __tests__/<feature>.service.spec.ts
```

Register the module in `src/app.module.ts`.

## Order of work
1. Add or confirm the Zod schemas in `packages/shared/src/schemas/<feature>.ts`
   (create / update / query / response). Export the inferred types.
2. Repository: every method takes `userId` first; every `where` contains
   `{ userId, deletedAt: null }`. Return Prisma models, not DTOs.
3. Service: business rules, `prisma.$transaction` for multi-writes, cache invalidation,
   domain exceptions from `src/common/exceptions/`.
4. Controller: thin. `@CurrentUser('id') userId: string`, one service call, Swagger decorators.
5. Entity mapper: `BigInt` → string, add computed fields (`isOverdue`, `remainingAmount`,
   `amountFormatted` is **not** added server-side — the UI formats).
6. Tests: service unit tests with a mocked repository + an e2e spec covering ownership
   isolation (user A must get 404 on user B's row).

## Controller template

```ts
@ApiTags('<feature>')
@Controller({ path: '<feature>', version: '1' })
export class <Feature>Controller {
  constructor(private readonly service: <Feature>Service) {}

  @Get()
  @ApiOperation({ summary: 'List <feature>' })
  @ApiOkResponse({ type: <Feature>ListResponseDto })
  list(
    @CurrentUser('id') userId: string,
    @Query() query: List<Feature>QueryDto,
  ) {
    return this.service.list(userId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('id') userId: string,
    @Body() dto: Create<Feature>Dto,
  ) {
    return this.service.create(userId, dto);
  }
}
```

## Checklist before finishing
- [ ] No Prisma import in the controller or the service (repository only)
- [ ] Every query filters by `userId`
- [ ] Not-found returns 404 via a domain exception, never a bare `throw new Error`
- [ ] List endpoint paginated, `limit` capped at 100
- [ ] Swagger renders correctly at `/api/docs`
- [ ] Response shape matches `docs/04-API-CONTRACT.md` exactly
- [ ] Any write that touches money is inside `prisma.$transaction` and invalidates the
      balance cache
