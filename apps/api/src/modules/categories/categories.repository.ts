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
      where: { id },
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

      // 2. Soft delete the category
      await tx.category.update({
        where: { id },
        data: { deletedAt: now },
      });

      // 3. Set categoryId = null for all associated transactions (acceptance criterion)
      await tx.transaction.updateMany({
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
