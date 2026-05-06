import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { SiweMessage } from "siwe";
import { SessionData, sessionOptions } from "@/lib/session";

export async function POST(request: Request) {
  const { message, signature } = await request.json();

  if (!message || !signature) {
    return Response.json({ error: "Missing message or signature" }, { status: 400 });
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);

  if (!session.nonce) {
    console.error("[SIWE] No nonce in session -- session cookie missing or expired");
    return Response.json({ error: "No nonce in session -- try refreshing and signing in again" }, { status: 422 });
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch (e) {
    console.error("[SIWE] Message parse error:", e);
    return Response.json({ error: "Invalid SIWE message format" }, { status: 422 });
  }

  const result = await siweMessage.verify(
    { signature, nonce: session.nonce },
    { suppressExceptions: true }
  );

  if (!result.success) {
    const reason = result.error?.type ?? "unknown";
    console.error("[SIWE] Verification failed:", reason, result.error);
    return Response.json(
      { error: `Verification failed: ${reason}` },
      { status: 422 }
    );
  }

  session.address = result.data.address;
  session.chainId = result.data.chainId;
  session.issuedAt = result.data.issuedAt ?? new Date().toISOString();
  session.nonce = undefined;
  await session.save();

  return Response.json({ address: session.address });
}
