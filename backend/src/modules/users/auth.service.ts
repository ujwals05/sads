
import { supabase } from "../../integrations/supabase/client.js";
import { userService } from "./user.service.js";
import type { LoginInput, RegisterInput } from "./auth.validation.js";

export const authService = {
  async register(input: RegisterInput) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });

    if (error) {
      throw new AuthServiceError(
        "REGISTRATION_FAILED",
        error.message,
      );
    }

    // With email confirmation enabled, a user may exist without
    // an active session. Do not treat that user as authenticated.
    if (data.session && data.user) {
      await userService.provisionAuthenticatedUser(data.user.id);
    }

    return {
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email ?? null,
          }
        : null,
      session: data.session,
      requiresEmailConfirmation: data.user !== null && data.session === null,
    };
  },

  async login(input: LoginInput) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.user || !data.session) {
      throw new AuthServiceError(
        "LOGIN_FAILED",
        "Invalid email or password.",
      );
    }

    await userService.provisionAuthenticatedUser(data.user.id);

    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? null,
      },
      session: data.session,
    };
  },
};

export class AuthServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}
