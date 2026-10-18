
import { userRepository } from "./user.repository.js";

export const userService = {
  async provisionAuthenticatedUser(id: string) {
    return userRepository.provision(id);
  },

  async getById(id: string) {
    return userRepository.findById(id);
  },
};
