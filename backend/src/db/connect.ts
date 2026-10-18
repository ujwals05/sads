import { prisma } from "./prisma.js";

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();

  // Verify that a simple database query succeeds.
  await prisma.$queryRaw`SELECT 1`;

  console.log("Database connection established.");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();

  console.log("Database connection closed.");
}