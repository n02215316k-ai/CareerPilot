import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, sessionCookieName, verifyPassword } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { findUserByEmail } from "@/lib/db";
import { authSchema } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = authSchema.parse(await request.json());
    const user = await findUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const sessionUser = { id: user.id, email: user.email };
    const response = NextResponse.json({ user: sessionUser });
    response.cookies.set(sessionCookieName, await createSessionToken(sessionUser), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    return errorResponse(error, "Could not sign in.", 400);
  }
}
