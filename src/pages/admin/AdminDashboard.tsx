import { useState, useEffect, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

interface ClientCompany {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  is_active: boolean;
  total_invoices?: number;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://bfyljxeminotfxqdmcrx.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable__7gEUE8o_25sYVdba41npQ_2qox2zAT";
const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form states
  const [companyName, setCompanyName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const loadClients = async () => {
    try {
      const { data: companiesData, error: compError } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (compError) throw compError;

      const { data: invoicesData } = await supabase.from("invoices").select("company_id");

      const countMap: Record<string, number> = {};
      invoicesData?.forEach((inv) => {
        countMap[inv.company_id] = (countMap[inv.company_id] || 0) + 1;
      });

      const formatted = (companiesData || []).map((c) => ({
        ...c,
        is_active: c.is_active ?? true,
        total_invoices: countMap[c.id] || 0,
      }));

      setClients(formatted);
    } catch (err: any) {
      console.error("Load error:", err.message);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { data: authData, error: authError } = await tempAuthClient.auth.signUp({
        email: clientEmail.trim(),
        password: clientPassword.trim(),
        options: { data: { full_name: clientName.trim() } },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("User creation failed in Auth engine.");

      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .insert([
          {
            name: companyName.trim(),
            email: clientEmail.trim(),
            phone: clientPhone.trim() || null,
            is_active: true,
          },
        ])
        .select()
        .single();

      if (companyError) throw companyError;

      await supabase.from("profiles").upsert([
        {
          id: authData.user.id,
          company_id: companyData.id,
          full_name: clientName.trim(),
          role: "owner",
        },
      ]);

      setMessage({
        text: `Client created! Email: ${clientEmail} | Password: ${clientPassword}`,
        type: "success",
      });

      setCompanyName("");
      setClientName("");
      setClientEmail("");
      setClientPassword("");
      setClientPhone("");
      loadClients();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to create client", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const toggleClientStatus = async (companyId: string, currentStatus: boolean) => {
    setActionLoading(`status-${companyId}`);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_active: !currentStatus })
        .eq("id", companyId);

      if (error) throw error;
      loadClients();
    } catch (err: any) {
      alert("Status update failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!window.confirm(`Kya aap '${clientName}' aur unka sara billing data delete karna chahte hain?`)) return;

    setActionLoading(`delete-${clientId}`);
    try {
      await supabase.from("invoices").delete().eq("company_id", clientId);
      await supabase.from("profiles").delete().eq("company_id", clientId);
      const { error } = await supabase.from("companies").delete().eq("id", clientId);

      if (error) throw error;
      loadClients();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const downloadClientBackup = async (companyId: string, companyName: string) => {
    try {
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("company_id", companyId);

      if (error) throw error;

      const backupData = {
        company: companyName,
        export_date: new Date().toISOString(),
        total_invoices: invoices?.length || 0,
        invoices: invoices || [],
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${companyName.replace(/\s+/g, "_")}_backup.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Backup export error: " + err.message);
    }
  };

  const activeCount = clients.filter((c) => c.is_active).length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f1f5f9", padding: "16px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#0f172a", boxSizing: "border-box" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", color: "#1e1b4b", fontWeight: 800 }}>
            JhaTech Super Admin Panel
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Workspace management, credentials, status controls aur backup exports.
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ padding: "8px 18px", backgroundColor: "#ef4444", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
        >
          Logout
        </button>
      </div>

      {/* Quick Stats Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>TOTAL CLIENTS</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>{clients.length}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700, textTransform: "uppercase" }}>ACTIVE CLIENTS</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>{activeCount}</div>
        </div>
        <div style={{ background: "#ffffff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700, textTransform: "uppercase" }}>SUSPENDED CLIENTS</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>{clients.length - activeCount}</div>
        </div>
      </div>

      {/* Responsive Layout Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        {/* Form Container */}
        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.04)", height: "fit-content" }}>
          <h2 style={{ fontSize: "16px", color: "#0f172a", margin: "0 0 16px 0", fontWeight: 700 }}>
            + Naya Client Banayein
          </h2>

          {message && (
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "12px",
                backgroundColor: message.type === "success" ? "#ecfdf5" : "#fef2f2",
                color: message.type === "success" ? "#065f46" : "#b91c1c",
                border: message.type === "success" ? "1px solid #a7f3d0" : "1px solid #fecaca",
              }}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleCreateClient} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>COMPANY / SHOP NAME</label>
              <input type="text" required placeholder="e.g. Sharma Traders" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>OWNER NAME</label>
              <input type="text" required placeholder="e.g. Ramesh Sharma" value={clientName} onChange={(e) => setClientName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>LOGIN EMAIL</label>
              <input type="email" required placeholder="ramesh@gmail.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>ASSIGN PASSWORD</label>
              <input type="text" required placeholder="Pass@1234" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>PHONE (Optional)</label>
              <input type="text" placeholder="9876543210" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} style={inputStyle} />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: "6px",
                padding: "11px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#4f46e5",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Creating..." : "Create Client Workspace"}
            </button>
          </form>
        </div>

        {/* Table Container */}
        <div style={{ background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 2px 4px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <h2 style={{ fontSize: "16px", color: "#0f172a", margin: "0 0 16px 0", fontWeight: 700 }}>
            Client Management Table
          </h2>

          <div style={{ overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px", minWidth: "480px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f1f5f9", color: "#64748b" }}>
                  <th style={{ padding: "10px" }}>Company</th>
                  <th style={{ padding: "10px" }}>Email</th>
                  <th style={{ padding: "10px" }}>Bills</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>
                      Koi client record nahi mila.
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 10px", fontWeight: 700, color: "#1e293b" }}>{c.name}</td>
                      <td style={{ padding: "12px 10px", color: "#6366f1" }}>{c.email}</td>
                      <td style={{ padding: "12px 10px", fontWeight: 700, color: "#0f172a" }}>
                        {c.total_invoices || 0} Bills
                      </td>
                      <td style={{ padding: "12px 10px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: 700,
                            backgroundColor: c.is_active ? "#dcfce7" : "#fee2e2",
                            color: c.is_active ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {c.is_active ? "Active" : "Stopped"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 10px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "6px" }}>
                          <button
                            onClick={() => toggleClientStatus(c.id, c.is_active)}
                            disabled={actionLoading === `status-${c.id}`}
                            style={{
                              padding: "5px 9px",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#f8fafc",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            {c.is_active ? "Stop ID" : "Chalu"}
                          </button>
                          <button
                            onClick={() => downloadClientBackup(c.id, c.name)}
                            style={{
                              padding: "5px 9px",
                              borderRadius: "6px",
                              border: "none",
                              backgroundColor: "#e0e7ff",
                              color: "#4338ca",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            Backup
                          </button>
                          <button
                            onClick={() => handleDeleteClient(c.id, c.name)}
                            disabled={actionLoading === `delete-${c.id}`}
                            style={{
                              padding: "5px 9px",
                              borderRadius: "6px",
                              border: "none",
                              backgroundColor: "#fee2e2",
                              color: "#b91c1c",
                              cursor: "pointer",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "13px",
  boxSizing: "border-box",
  outline: "none",
  backgroundColor: "#f8fafc",
};