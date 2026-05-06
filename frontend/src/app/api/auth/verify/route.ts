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
    return Response.json({ error: "No nonce in session. Request a nonce first." }, { status: 422 });
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch {
    return Response.json({ error: "Invalid SIWE message format" }, { status: 422 });
  }

  try {
    const result = await siweMessage.verify({
      signature,
      nonce: session.nonce,
    });

    if (!result.success) {
      return Response.json({ error: "Signature verification failed" }, { status: 422 });
    }

    session.address = result.data.address;
    session.chainId = result.data.chainId;
    session.issuedAt = result.data.issuedAt ?? new Date().toISOString();
    session.nonce = undefined;
    await session.save();

    return Response.json({ address: session.address });
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 422 });
  }
}
