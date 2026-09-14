// convex/auth.ts
import Google from "@auth/core/providers/google"; 
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { convexAuth } from "@convex-dev/auth/server";

async function sendAuthCode({ identifier, token }: { identifier: string; token: string }) {
  const serviceUrl = process.env.AURRIQ_EMAIL_SERVICE_URL;
  const serviceSecret = process.env.AURRIQ_EMAIL_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) throw new Error("Password email delivery is not configured");
  const response = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/email/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceSecret}` },
    body: JSON.stringify({
      to: identifier,
      subject: "Your Aurriq security code",
      html: `<p>Your Aurriq security code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${token}</p><p>This code expires soon. If you did not request it, you can ignore this message.</p>`,
    }),
  });
  if (!response.ok) throw new Error("Unable to send the security code");
}

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [
    Password({
      reset: Email({
        sendVerificationRequest: sendAuthCode,
      }),
      verify: Email({ sendVerificationRequest: sendAuthCode }),
    }),
    Google,
  ],
});