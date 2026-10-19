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
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        !("userId" in decoded) ||
        !("email" in decoded) ||
        !("role" in decoded)
    ) {
        throw new Error("Invalid token structure");
    }

    return decoded as JwtPayLoad;
}

export const verifyRefreshToken = (token: string): JwtPayLoad => {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET)

    if (
        typeof decoded !== "object" ||
        decoded === null ||
        !("userId" in decoded) ||
        !("email" in decoded) ||
        !("role" in decoded)
    ) {
        throw new Error("Invalid token structure")
    }

    return decoded as JwtPayLoad
}