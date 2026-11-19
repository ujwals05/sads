import { authedHandler, parseOrThrow } from "../../utils/http.js";
import { searchUsersSchema } from "./user.validation.js";
import { userService } from "./user.service.js";

export const userController = {
  search: authedHandler(async (req, res, userId) => {
    const query = parseOrThrow(
      searchUsersSchema,
      req.query,
      "Invalid search parameters.",
    );
    const result = await userService.search(userId, query);
    res.status(200).json(result);
  }),
};
