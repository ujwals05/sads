import { userRepository } from "./user.repository.js";

export const userService = {
  async getById(id: string) {
    return userRepository.findById(id);
  },
};