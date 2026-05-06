import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { generateNonce } from "siwe";
import { SessionData, sessionOptions } from "@/lib/session";

export async function GET() {
  if (!process.env.SESSION_SECRET) {
    console.error("[SIWE] SESSION_SECRET env var is not set -- cannot create session");
    return Response.json({ error: "Server misconfiguration: SESSION_SECRET is not set" }, { status: 500 });
  }
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const nonce = generateNonce();
  session.nonce = nonce;
  await session.save();
  return Response.json({ nonce }, {
    headers: { "Cache-Control": "no-store" },
  });
}
