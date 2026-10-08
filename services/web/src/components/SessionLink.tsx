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
      CHECK-IN
    </Link>
  );
}

export async function SessionLink() {
  const token = (await cookies()).get("access_token")?.value;
  const role = token ? roleFromToken(token) : null;

  if (role === "admin") {
    return (
      <Link href="/admin" className="session-link is-crew">
        TOWER
      </Link>
    );
  }
  if (role) {
    return <span className="session-link is-in">CHECKED IN</span>;
  }
  return <CheckInLink />;
}
