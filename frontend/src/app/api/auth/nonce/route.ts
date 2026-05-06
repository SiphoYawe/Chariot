import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { generateNonce } from "siwe";
import { SessionData, sessionOptions } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  const nonce = generateNonce();
  session.nonce = nonce;
  await session.save();
  return Response.json({ nonce }, {
    headers: { "Cache-Control": "no-store" },
  });
}
