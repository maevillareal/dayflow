import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { localRepo } from "../../data/localRepo";
import { demoHistory, starterData } from "../../data/seed";
import { Store, StoreProvider, useSnap } from "../../data/store";
import { supabase, supabaseRepo } from "../../data/supabase";
import { DEMO } from "../../lib/env";
import { todayKey } from "../../lib/dates";
import { useToast } from "../../app/providers";
import { Login, NewPassword } from "./Login";

export interface Account {
  email: string;
  demo: boolean;
  signOut: () => Promise<void>;
}

function Loader({ store, children }: { store: Store; children: ReactNode }) {
  const snap = useSnap();
  if (snap.status === "loading")
    return (
      <div className="splash">
        <div className="logo-mark big" aria-hidden />
        <p className="muted">Loading your day…</p>
      </div>
    );
  if (snap.status === "error")
    return (
      <div className="splash">
        <h2>Couldn't load your data</h2>
        <p className="muted" style={{ maxWidth: 420, textAlign: "center" }}>{snap.error}</p>
        <button className="btn" onClick={() => void store.load()}>Try again</button>
      </div>
    );
  return <>{children}</>;
}

/** Demo mode: no login, local data with sample history. Otherwise: Supabase email + password. */
export function AuthGate({ children }: { children: (account: Account) => ReactNode }) {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(DEMO);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  const store = useMemo(() => {
    if (DEMO) {
      const s = new Store(localRepo, toast);
      void s.load((db) => {
        if (db.profiles.length) return null;
        const start = starterData(todayKey(), "Norleen");
        return { ...start, ...demoHistory({ ...db, ...start } as typeof db, todayKey()) };
      });
      return s;
    }
    if (!supabase || !userId) return null;
    const s = new Store(supabaseRepo(supabase), toast);
    const meta = session?.user.user_metadata as { display_name?: string } | undefined;
    const name = meta?.display_name || session?.user.email?.split("@")[0] || "";
    void s.load((db) => (db.profiles.length ? null : starterData(todayKey(), name)));
    return s;
    // The store is per signed-in user; token refreshes must not rebuild it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, toast]);

  if (!ready) return <div className="splash"><p className="muted">Loading…</p></div>;
  if (!DEMO && recovering && supabase) return <NewPassword onDone={() => setRecovering(false)} />;
  if (!store) return <Login />;

  const account: Account = DEMO
    ? { email: "Demo mode", demo: true, signOut: async () => toast("Demo mode has no account to sign out of.") }
    : { email: session?.user.email ?? "", demo: false, signOut: async () => void (await supabase?.auth.signOut()) };

  return (
    <StoreProvider store={store}>
      <Loader store={store}>{children(account)}</Loader>
    </StoreProvider>
  );
}
