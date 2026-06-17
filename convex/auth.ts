import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password,
    Google,
  ],
  // Explicitly tell it to look for the secret in your env vars
  secret: process.env.AUTH_SECRET, 
});