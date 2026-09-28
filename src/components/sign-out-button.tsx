import { signOut } from "@/app/actions/auth";

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOut} className={compact ? "ec-signout-compact" : "premium-signout"}>
      <button
        type="submit"
        className={compact ? "ec-signout-button ec-signout-button-compact" : "ec-nav-item ec-signout-button w-full text-left"}
        aria-label="Sair da plataforma"
      >
        <span className="ec-nav-icon" aria-hidden="true">↪</span>
        <span>Sair</span>
      </button>
    </form>
  );
}
