import { Prisma } from '@prisma/client';

/**
 * A Prisma client usable both standalone and inside `prisma.$transaction(async (tx) => ...)`.
 * Repositories accept it so services can compose several writes into one atomic unit.
 */
export type Db = Prisma.TransactionClient;
