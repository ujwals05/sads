
import { prisma } from "../../db/prisma.js";

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  provision(id: string) {
    return prisma.user.upsert({
      where: { id },
      update: {},
      create: { id },
    });
  },
};
