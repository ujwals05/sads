import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { userController } from "./user.controller.js";

export const userRouter = Router();

userRouter.use(authenticate);
userRouter.get("/search", userController.search);
