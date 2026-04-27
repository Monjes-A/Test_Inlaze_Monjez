import type { Operator, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../lib/prisma';

export async function createOperator(data: Prisma.OperatorCreateInput): Promise<Operator> {
  return getPrismaClient().operator.create({ data });
}

export async function listOperators(): Promise<Operator[]> {
  return getPrismaClient().operator.findMany({
    orderBy: { name: 'asc' },
  });
}

export async function getOperatorById(id: string): Promise<Operator | null> {
  return getPrismaClient().operator.findUnique({ where: { id } });
}

export async function updateOperator(
  id: string,
  data: Prisma.OperatorUpdateInput,
): Promise<Operator> {
  return getPrismaClient().operator.update({
    where: { id },
    data,
  });
}

export async function deleteOperator(id: string): Promise<Operator> {
  return getPrismaClient().operator.delete({ where: { id } });
}
