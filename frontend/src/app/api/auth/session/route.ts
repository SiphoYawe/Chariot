import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SessionData, sessionOptions } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.address) {
    return Response.json({ address: null, authenticated: false });
  }

  return Response.json({
    address: session.address,
    chainId: session.chainId,
    authenticated: true,
  });
}
