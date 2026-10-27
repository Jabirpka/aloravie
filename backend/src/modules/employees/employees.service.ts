import type { Department, UserRole } from "@prisma/client";
import { prisma } from "../../prisma.js";
import { hashPassword } from "../../lib/auth.js";
import { conflict, notFound } from "../../lib/http.js";

const publicSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  departments: true,
  isActive: true,
  createdAt: true,
} as const;

export function listEmployees() {
  return prisma.user.findMany({ select: publicSelect, orderBy: { createdAt: "asc" } });
}

export async function createEmployee(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  departments: Department[];
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("A user with this email already exists");
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      departments: input.departments,
    },
    select: publicSelect,
  });
}

export async function updateEmployee(
  id: string,
  actorId: string,
  input: { name?: string; role?: UserRole; departments?: Department[]; isActive?: boolean; password?: string },
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound("Employee not found");

  // Guard against locking everyone out: an OWNER can't demote or deactivate the
  // last active OWNER (themselves included).
  if (existing.role === "OWNER" && (input.role === "STAFF" || input.role === "ADMIN" || input.isActive === false)) {
    const owners = await prisma.user.count({ where: { role: "OWNER", isActive: true } });
    if (owners <= 1) throw conflict("Can't change the last active owner");
  }

  const data: {
    name?: string;
    role?: UserRole;
    departments?: Department[];
    isActive?: boolean;
    passwordHash?: string;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.departments !== undefined) data.departments = input.departments;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  return prisma.user.update({ where: { id }, data, select: publicSelect });
}
