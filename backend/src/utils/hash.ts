import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12

export const hashedPassword = async (passowrd: string): Promise<string> => {
    return bcrypt.hash(passowrd, SALT_ROUNDS)
}

export const comparePassword = async (plain: string, hashed: string): Promise<Boolean> => {
    return bcrypt.compare(plain, hashed)
}