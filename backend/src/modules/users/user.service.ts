import { userRepository } from "./user.repository.js";
import type { SearchUsersInput } from "./user.validation.js";

export const userService = {
  async getById(id: string) {
    return userRepository.findById(id);
  },
  search(input: SearchUsersInput) {
    return userRepository.searchUsers(input);
  },
};