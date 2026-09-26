import { PrismaService } from '../prisma.service';

/** Runs `$transaction(fn)` callbacks against a fake transaction client for service unit tests. */
export function prismaStub<T extends object>(tx: T = {} as T) {
  const stub = {
    tx,
    $transaction: jest.fn(async (fn: (client: T) => unknown) => fn(tx)),
  };
  return stub as typeof stub & PrismaService;
}
