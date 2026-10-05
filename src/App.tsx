import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import Login from "./pages/auth/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
// Yahan naye client dashboard ka path dein:
import ClientDashboard from "./pages/dashboard/ClientDashboard";

const SUPER_ADMIN_EMAIL = "info.jhatechsolution@gmail.com";

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          color: "#475569",
        }}
      >
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const isAdmin = user.email === SUPER_ADMIN_EMAIL;

  return isAdmin ? <AdminDashboard /> : <ClientDashboard />;
}

export default App;