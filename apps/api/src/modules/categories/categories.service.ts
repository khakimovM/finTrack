import { Injectable } from '@nestjs/common';
import { Category, CategoryType } from '@prisma/client';
import { CategoryResponse } from '@fintrack/shared';
import { CategoriesRepository, CategoryWithChildren } from './categories.repository';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto/category.dto';
import {
  NotFoundDomainException,
  ConflictDomainException,
  SystemCategoryException,
  DomainException,
} from '../../common/exceptions/domain.exception';

@Injectable()
export class CategoriesService {
  constructor(private readonly repository: CategoriesRepository) {}

  async list(userId: string, type?: CategoryType): Promise<CategoryResponse[]> {
    const categories = await this.repository.findAll(userId, type);
    return categories.map((cat) => this.mapToResponse(cat));
  }

  async getById(userId: string, id: string): Promise<CategoryResponse> {
    const category = await this.repository.findById(userId, id);
    if (!category) {
      throw new NotFoundDomainException('Kategoriya topilmadi');
    }
    return this.mapToResponse(category);
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<CategoryResponse> {
    const type = dto.type as CategoryType;
    const parentId = dto.parentId ?? null;

    if (parentId) {
      const parent = await this.repository.findById(userId, parentId);
      if (!parent) {
        throw new NotFoundDomainException('Ota kategoriya topilmadi');
      }
      if (parent.parentId !== null) {
        throw new DomainException(
          'Kategoriyalarni 2 qavatdan ortiq chuqur joylashtirib bo‘lmaydi',
          'INVALID_CATEGORY_DEPTH',
        );
      }
      if (parent.type !== type) {
        throw new DomainException(
          'Kategoriya turi ota kategoriya turiga mos kelishi kerak',
          'INVALID_CATEGORY_TYPE',
        );
      }
    }

    const duplicate = await this.repository.findByNameAndParent(userId, dto.name, type, parentId);
    if (duplicate) {
      throw new ConflictDomainException('CATEGORY_EXISTS', 'Ushbu nomdagi kategoriya allaqachon mavjud');
    }

    const created = await this.repository.create(userId, {
      name: dto.name,
      type,
      icon: dto.icon ?? '💰',
      color: dto.color ?? '#6366f1',
      parentId,
    });

    return this.mapToResponse(created);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    const category = await this.repository.findById(userId, id);
    if (!category) {
      throw new NotFoundDomainException('Kategoriya topilmadi');
    }

    let parentId = category.parentId;
    if (dto.parentId !== undefined) {
      parentId = dto.parentId;
      if (parentId === id) {
        throw new DomainException('Kategoriya o‘ziga ota bo‘la olmaydi', 'CIRCULAR_CATEGORY');
      }
      if (parentId) {
        const parent = await this.repository.findById(userId, parentId);
        if (!parent) {
          throw new NotFoundDomainException('Ota kategoriya topilmadi');
        }
        if (parent.parentId !== null) {
          throw new DomainException(
            'Kategoriyalarni 2 qavatdan ortiq chuqur joylashtirib bo‘lmaydi',
            'INVALID_CATEGORY_DEPTH',
          );
        }
        if (parent.type !== category.type) {
          throw new DomainException(
            'Kategoriya turi ota kategoriya turiga mos kelishi kerak',
            'INVALID_CATEGORY_TYPE',
          );
        }
      }
    }

    const targetName = dto.name ?? category.name;
    if (targetName !== category.name || parentId !== category.parentId) {
      const duplicate = await this.repository.findByNameAndParent(
        userId,
        targetName,
        category.type,
        parentId,
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictDomainException('CATEGORY_EXISTS', 'Ushbu nomdagi kategoriya allaqachon mavjud');
      }
    }

    const updated = await this.repository.update(userId, id, {
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      parentId: dto.parentId,
    });

    return this.mapToResponse({
      ...updated,
      children: category.children,
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    const category = await this.repository.findById(userId, id);
    if (!category) {
      throw new NotFoundDomainException('Kategoriya topilmadi');
    }

    if (category.isSystem) {
      throw new SystemCategoryException('Tizim kategoriyasini o‘chirib bo‘lmaydi');
    }

    const childIds = category.children?.map((c) => c.id) ?? [];
    await this.repository.delete(userId, id, childIds);
  }

  async reorder(userId: string, dto: ReorderCategoriesDto): Promise<void> {
    await this.repository.reorder(userId, dto.items);
  }

  private mapToResponse(cat: CategoryWithChildren | Category): CategoryResponse {
    const children = 'children' in cat && cat.children
      ? cat.children.map((child) => this.mapToResponse(child))
      : undefined;

    return {
      id: cat.id,
      name: cat.name,
      type: cat.type as CategoryResponse['type'],
      icon: cat.icon,
      color: cat.color,
      parentId: cat.parentId,
      isSystem: cat.isSystem,
      sortOrder: cat.sortOrder,
      children,
      createdAt: cat.createdAt.toISOString(),
      updatedAt: cat.updatedAt.toISOString(),
    };
  }
}
