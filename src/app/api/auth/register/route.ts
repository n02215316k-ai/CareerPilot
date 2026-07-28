import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, hashPassword, sessionCookieName } from "@/lib/auth";
import { createUser } from "@/lib/db";
import { authSchema } from "@/lib/schemas";
import { errorResponse } from "@/lib/api";

export async function POST(request: NextRequest) {
  try {
    const body = authSchema.parse(await request.json());
    const user = await createUser(body.email, await hashPassword(body.password));
    const token = await createSessionToken(user);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error && error.message.includes("unique")
      ? "An account already exists for that email."
      : "Could not create account.";
    return errorResponse(error, message, 400);
  }
}
