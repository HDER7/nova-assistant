import { redirect } from "next/navigation";

/** Public sign-up is disabled (NOVA is a personal assistant). */
export default function RegisterPage() {
  redirect("/login");
}
