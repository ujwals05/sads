import jwt from "jsonwebtoken";
import type { Secret, SignOptions } from "jsonwebtoken"
import { env } from "../config/env.js"


export interface JwtPayLoad {
    id:string
    email: string  
}

export const signAccessToken = (payload: JwtPayLoad): string => {
    const secret: Secret = env.JWT_ACCESS_SECRET
    const options: SignOptions = {
        expiresIn: env.JWT_ACCESS_EXPIRES
    }
    return jwt.sign(payload, secret, options)
}

export const signRefreshToken = (payload: JwtPayLoad): string => {
    const secret: Secret = env.JWT_REFRESH_SECRET

    const options: SignOptions = {
        expiresIn: env.JWT_REFRESH_EXPIRES
    }

    return jwt.sign(payload, secret, options)
}


export const verifyAccessToken = (token: string): JwtPayLoad => {
  const decoded: unknown = jwt.verify(
    token,
    env.JWT_ACCESS_SECRET,
  );

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded) ||
    typeof decoded.id !== "string" ||
    !("email" in decoded) ||
    typeof decoded.email !== "string"
  ) {
    throw new Error("Invalid access token structure");
  }

  return {
    id: decoded.id,
    email: decoded.email,
  };
};

export const verifyRefreshToken = (token: string): JwtPayLoad => {
  const decoded: unknown = jwt.verify(
    token,
    env.JWT_REFRESH_SECRET,
  );

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    !("id" in decoded) ||
    typeof decoded.id !== "string" ||
    !("email" in decoded) ||
    typeof decoded.email !== "string"
  ) {
    throw new Error("Invalid refresh token structure");
  }

  return {
    id: decoded.id,
    email: decoded.email,
  };
};
