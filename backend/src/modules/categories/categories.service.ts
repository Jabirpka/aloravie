import { prisma } from "../../prisma.js";
import { badRequest, conflict, notFound } from "../../lib/http.js";

export function listCategories() {
  return prisma.category.findMany({
    include: { _count: { select: { products: true, children: true } }, parent: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(input: { name: string; slug: string; parentId?: string | null }) {
  const slug = input.slug.trim().toLowerCase();
  if (!slug) throw badRequest("A slug is required");
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw conflict("A category with this slug already exists");
  return prisma.category.create({ data: { name: input.name, slug, parentId: input.parentId ?? null } });
}

export async function updateCategory(
  id: string,
  input: { name?: string; slug?: string; parentId?: string | null },
) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound("Category not found");
  if (input.parentId === id) throw badRequest("A category can't be its own parent");

  const data: { name?: string; slug?: string; parentId?: string | null } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.slug !== undefined) {
    const slug = input.slug.trim().toLowerCase();
    const dup = await prisma.category.findFirst({ where: { slug, id: { not: id } } });
    if (dup) throw conflict("That slug is already in use");
    data.slug = slug;
  }
  if (input.parentId !== undefined) data.parentId = input.parentId;
  return prisma.category.update({ where: { id }, data });
}

// Products in the category have their categoryId set null (optional FK); child
// categories are detached too.
export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw notFound("Category not found");
  await prisma.category.delete({ where: { id } });
}
