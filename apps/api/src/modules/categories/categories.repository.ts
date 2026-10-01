import { Injectable } from '@nestjs/common';
import { Category, CategoryType } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface CategoryWithChildren extends Category {
  children?: Category[];
}

export interface CreateCategoryData {
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  parentId?: string | null;
}

export interface UpdateCategoryData {
  name?: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, type?: CategoryType): Promise<CategoryWithChildren[]> {
    return this.prisma.category.findMany({
      where: {
        userId,
        deletedAt: null,
        parentId: null, // roots
        ...(type ? { type } : {}),
      },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(userId: string, id: string): Promise<CategoryWithChildren | null> {
    return this.prisma.category.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
  }

  async findByNameAndParent(
    userId: string,
    name: string,
    type: CategoryType,
    parentId: string | null = null,
  ): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: {
        userId,
        name,
        type,
        parentId,
        deletedAt: null,
      },
    });
  }

  /** A soft-deleted twin still owns the (userId, name, type, parentId) unique key. */
  async findDeletedByNameAndParent(
    userId: string,
    name: string,
    type: CategoryType,
    parentId: string | null,
  ): Promise<Category | null> {
    return this.prisma.category.findFirst({
      where: { userId, name, type, parentId, deletedAt: { not: null } },
    });
  }

  async restore(userId: string, id: string, data: { icon: string; color: string }): Promise<Category> {
    return this.prisma.category.update({
      where: { id, userId },
      data: { ...data, deletedAt: null },
    });
  }

  async hasChildren(userId: string, id: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { userId, parentId: id, deletedAt: null } })) > 0;
  }

  async create(userId: string, data: CreateCategoryData): Promise<Category> {
    return this.prisma.category.create({
      data: {
        userId,
        name: data.name,
        type: data.type,
        icon: data.icon,
        color: data.color,
        parentId: data.parentId ?? null,
      },
    });
  }

  async update(userId: string, id: string, data: UpdateCategoryData): Promise<Category> {
    return this.prisma.category.update({
      where: { id, userId, deletedAt: null },
      data,
    });
  }

  async delete(userId: string, id: string, childIds: string[]): Promise<void> {
    const allIds = [id, ...childIds];
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Soft delete child categories if any
      if (childIds.length > 0) {
        await tx.category.updateMany({
          where: { id: { in: childIds }, userId },
          data: { deletedAt: now },
        });
      }

      await tx.category.update({
        where: { id, userId },
        data: { deletedAt: now },
      });

      // Transactions survive with no category (acceptance criterion); budgets for a category
      // that no longer exists are meaningless; recurring rules keep running uncategorised.
      await tx.transaction.updateMany({
        where: { categoryId: { in: allIds }, userId },
        data: { categoryId: null },
      });
      await tx.budget.deleteMany({ where: { categoryId: { in: allIds }, userId } });
      await tx.recurringRule.updateMany({
        where: { categoryId: { in: allIds }, userId },
        data: { categoryId: null },
      });
    });
  }

  async reorder(userId: string, items: Array<{ id: string; sortOrder: number }>): Promise<void> {
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.category.updateMany({
          where: { id: item.id, userId, deletedAt: null },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
  }
}
