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
    if (!window.confirm(`Kya aap '${clientName}' aur unka sara billing data permanently delete karna chahte hain?`)) return;

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
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1e1b4b]">
            JhaTech Super Admin Panel
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Workspace management, credentials, status controls aur backup exports.
          </p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full sm:w-auto px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm transition"
        >
          Logout
        </button>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-slate-500">TOTAL CLIENTS</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{clients.length}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-emerald-600">ACTIVE CLIENTS</div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1">{activeCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="text-xs font-bold text-red-600">SUSPENDED CLIENTS</div>
          <div className="text-2xl font-extrabold text-red-600 mt-1">{clients.length - activeCount}</div>
        </div>
      </div>

      {/* Responsive Grid: Mobile me 1 column, Desktop par 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Form Container */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            + Naya Client Banayein
          </h2>

          {message && (
            <div
              className={`p-3 rounded-lg text-xs font-medium mb-4 ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleCreateClient} className="flex flex-col gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                COMPANY / SHOP NAME
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Sharma Traders"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                OWNER NAME
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Sharma"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                LOGIN EMAIL
              </label>
              <input
                type="email"
                required
                placeholder="ramesh@gmail.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                ASSIGN PASSWORD
              </label>
              <input
                type="text"
                required
                placeholder="Pass@1234"
                value={clientPassword}
                onChange={(e) => setClientPassword(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-indigo-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                PHONE (Optional)
              </label>
              <input
                type="text"
                placeholder="9876543210"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:outline-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50 transition"
            >
              {loading ? "Creating..." : "Create Client Workspace"}
            </button>
          </form>
        </div>

        {/* Table Container with Horizontal Scroll support on small screens */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 overflow-hidden">
          <h2 className="text-base font-bold text-slate-900 mb-4">
            Client Management Table
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b-2 border-slate-100 text-slate-500">
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Bills</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-5 text-center text-slate-400">
                      Koi client record nahi mila.
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-3 px-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="py-3 px-3 text-indigo-600">{c.email}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">
                        {c.total_invoices || 0} Bills
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {c.is_active ? "Active" : "Stopped"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex gap-1.5 flex-wrap justify-end">
                          <button
                            onClick={() => toggleClientStatus(c.id, c.is_active)}
                            disabled={actionLoading === `status-${c.id}`}
                            className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold"
                          >
                            {c.is_active ? "Stop ID" : "Chalu"}
                          </button>
                          <button
                            onClick={() => downloadClientBackup(c.id, c.name)}
                            className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold"
                          >
                            Backup
                          </button>
                          <button
                            onClick={() => handleDeleteClient(c.id, c.name)}
                            disabled={actionLoading === `delete-${c.id}`}
                            className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-semibold"
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