// convex/auth.ts
import Google from "@auth/core/providers/google"; 
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: Email({
        async sendVerificationRequest({ identifier, token }) {
          const apiKey = process.env.RESEND_API_KEY;
          if (!apiKey) throw new Error("Password reset email is not configured");
          const from = process.env.RESEND_FROM ?? "Aurriq <notifications@aurriq.com>";
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify({
              from,
              to: identifier,
              subject: "Your Aurriq password reset code",
              html: `<p>Your Aurriq password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${token}</p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`,
            }),
          });
          if (!response.ok) throw new Error("Unable to send password reset email");
        },
      }),
    }),
    Google,
  ],
});