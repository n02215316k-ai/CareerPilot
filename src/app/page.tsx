import AuthPanel from "@/components/auth-panel";
import Dashboard from "@/components/dashboard";
import { getSessionFromCookies } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionFromCookies();
  return session ? <Dashboard user={session} /> : <AuthPanel />;
}
