import "server-only";

import { isActiveAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";

export async function requireActiveAdmin() {
  const session = await getSession();
  if (!session?.isAdmin || !session.session?.user) {
    return null;
  }

  const active = await isActiveAdmin(session.session.user.id);
  if (!active) {
    return null;
  }

  return session;
}
