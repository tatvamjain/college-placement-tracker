import { cookies } from "next/headers";
import Link from "next/link";

// Only decides which link to show. Nothing here is trusted: every API call is
// checked again by the services, which verify the token's signature. No expiry
// check needed either, because the browser drops the cookie when the token expires.
function roleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function CheckInLink() {
  return (
    <Link href="/login" className="session-link">
      SIGN IN
    </Link>
  );
}

export async function SessionLink() {
  const token = (await cookies()).get("access_token")?.value;
  const role = token ? roleFromToken(token) : null;

  if (!role) return <CheckInLink />;
  return (
    <span className="session-links">
      {role === "admin" && (
        <Link href="/admin" className="session-link is-crew">
          ADMIN
        </Link>
      )}
      <Link href="/profile" className="session-link is-in" aria-label="Your account">
        <span className="session-dot" aria-hidden />
        ACCOUNT
      </Link>
    </span>
  );
}
