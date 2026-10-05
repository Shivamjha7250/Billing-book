import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "../../lib/supabase";

interface InvoiceItem {
  name: string;
  qty: number;
  rate: number;
}

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  payment_status: "paid" | "pending";
  items: InvoiceItem[];
  created_at: string;
}

interface ServiceItem {
  id: string;
  name: string;
  default_rate: number;
}

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "customers" | "services" | "payments" | "reports" | "settings">("dashboard");
  const [darkMode, setDarkMode] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer View & Search State
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  // Modal & Print states
  const [showBillModal, setShowBillModal] = useState(false);
  const [printingInvoice, setPrintingInvoice] = useState<InvoiceRecord | null>(null);

  // Bill creation inputs
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [billItems, setBillItems] = useState<InvoiceItem[]>([{ name: "", qty: 1, rate: 0 }]);
  const [taxPercent, setTaxPercent] = useState(0);
  const [initialPaymentStatus, setInitialPaymentStatus] = useState<"paid" | "pending">("paid");
  const [savingBill, setSavingBill] = useState(false);

  // Service Management Inputs & Edit Mode
  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceRate, setNewServiceRate] = useState<number | "">("");
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [savingService, setSavingService] = useState(false);

  // Settings inputs
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [gstin, setGstin] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Reports duration filter
  const [reportDuration, setReportDuration] = useState<"daily" | "weekly" | "monthly" | "3m" | "6m" | "9m" | "12m">("monthly");

  useEffect(() => {
    fetchWorkspace();
  }, []);

  const fetchWorkspace = async () => {
    try {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        window.location.href = "/";
        return;
      }
      setUser(authUser);

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile?.company_id) {
        const { data: comp } = await supabase
          .from("companies")
          .select("*")
          .eq("id", profile.company_id)
          .maybeSingle();

        setCompany(comp);
        if (comp) {
          setCompanyName(comp.name || "");
          setCompanyEmail(comp.email || "");
          setCompanyPhone(comp.phone || "");
          setBusinessAddress(comp.business_address || "");
          setBankName(comp.bank_name || "");
          setAccountNumber(comp.account_number || "");
          setIfscCode(comp.ifsc_code || "");
          setUpiId(comp.upi_id || "");
          setLogoUrl(comp.logo_url || "");
          setGstin(comp.gstin || "");
        }

        const { data: invList } = await supabase
          .from("invoices")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false });

        if (invList) {
          setInvoices(
            invList.map((i: any) => ({
              ...i,
              customer_phone: i.customer_phone || "",
              payment_status: i.payment_status || (i.status === "paid" ? "paid" : "pending"),
              items: Array.isArray(i.items) ? i.items : [],
            }))
          );
        }

        const { data: srvList } = await supabase
          .from("services")
          .select("*")
          .eq("company_id", profile.company_id)
          .order("created_at", { ascending: false });

        if (srvList) setServices(srvList);
      }
    } catch (err: any) {
      console.error("Dashboard Loading Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocalLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("Logo image size must be less than 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newServiceName.trim();
    if (!trimmedName) return alert("Service name is required.");

    const isDuplicate = services.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingServiceId
    );
    if (isDuplicate) {
      return alert(`A service named '${trimmedName}' already exists.`);
    }

    setSavingService(true);
    try {
      if (editingServiceId) {
        const { error } = await supabase
          .from("services")
          .update({
            name: trimmedName,
            default_rate: Number(newServiceRate) || 0,
          })
          .eq("id", editingServiceId);

        if (error) throw error;
        setServices(
          services.map((s) =>
            s.id === editingServiceId ? { ...s, name: trimmedName, default_rate: Number(newServiceRate) || 0 } : s
          )
        );
        setEditingServiceId(null);
        alert("Service updated successfully.");
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert({
            company_id: company.id,
            name: trimmedName,
            default_rate: Number(newServiceRate) || 0,
          })
          .select()
          .single();

        if (error) throw error;
        setServices([data, ...services]);
        alert("Service added successfully.");
      }
      setNewServiceName("");
      setNewServiceRate("");
    } catch (err: any) {
      alert("Error saving service: " + err.message);
    } finally {
      setSavingService(false);
    }
  };

  const handleStartEditService = (srv: ServiceItem) => {
    setEditingServiceId(srv.id);
    setNewServiceName(srv.name);
    setNewServiceRate(srv.default_rate);
  };

  const handleCancelEditService = () => {
    setEditingServiceId(null);
    setNewServiceName("");
    setNewServiceRate("");
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;
    try {
      await supabase.from("services").delete().eq("id", id);
      setServices(services.filter((s) => s.id !== id));
      if (editingServiceId === id) handleCancelEditService();
    } catch (err: any) {
      alert("Failed to delete service: " + err.message);
    }
  };

  const handleSelectServiceForItem = (index: number, serviceName: string) => {
    const target = services.find((s) => s.name === serviceName);
    const updated = [...billItems];
    if (target) {
      updated[index] = {
        name: target.name,
        qty: updated[index].qty || 1,
        rate: Number(target.default_rate) || 0,
      };
    } else {
      updated[index] = { ...updated[index], name: serviceName };
    }
    setBillItems(updated);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return alert("Company name is required.");
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          name: companyName.trim(),
          email: companyEmail.trim(),
          phone: companyPhone.trim(),
          business_address: businessAddress.trim(),
          bank_name: bankName,
          account_number: accountNumber,
          ifsc_code: ifscCode,
          upi_id: upiId,
          logo_url: logoUrl,
          gstin: gstin,
        })
        .eq("id", company.id);

      if (error) throw error;
      setCompany((prev: any) => ({
        ...prev,
        name: companyName.trim(),
        email: companyEmail.trim(),
        phone: companyPhone.trim(),
        business_address: businessAddress.trim(),
        bank_name: bankName,
        account_number: accountNumber,
        ifsc_code: ifscCode,
        upi_id: upiId,
        logo_url: logoUrl,
        gstin: gstin,
      }));
      alert("Workspace and payment settings updated successfully.");
    } catch (err: any) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const togglePaymentStatus = async (invoiceId: string, currentStatus: "paid" | "pending") => {
    const nextStatus = currentStatus === "paid" ? "pending" : "paid";
    try {
      const { error } = await supabase
        .from("invoices")
        .update({ payment_status: nextStatus, status: nextStatus })
        .eq("id", invoiceId);

      if (error) throw error;
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, payment_status: nextStatus } : inv))
      );
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to permanently delete Invoice #${invoiceNumber}?`)) return;
    try {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
      if (error) throw error;
      setInvoices(invoices.filter((inv) => inv.id !== invoiceId));
      alert(`Invoice #${invoiceNumber} deleted successfully.`);
    } catch (err: any) {
      alert("Failed to delete invoice: " + err.message);
    }
  };

  const subTotal = billItems.reduce((acc, curr) => acc + (Number(curr.qty) || 0) * (Number(curr.rate) || 0), 0);
  const taxAmount = (subTotal * taxPercent) / 100;
  const grandTotal = subTotal + taxAmount;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) return alert("Customer name is required.");
    if (grandTotal <= 0) return alert("Please specify valid items and rates.");

    setSavingBill(true);
    try {
      const invNum = `INV-${Date.now().toString().slice(-6)}`;
      const { data, error } = await supabase
        .from("invoices")
        .insert({
          company_id: company.id,
          invoice_number: invNum,
          customer_name: customerName,
          customer_phone: customerPhone,
          total_amount: grandTotal,
          payment_status: initialPaymentStatus,
          status: initialPaymentStatus,
          items: billItems,
        })
        .select()
        .single();

      if (error) throw error;
      setInvoices([data, ...invoices]);
      setShowBillModal(false);
      setCustomerName("");
      setCustomerPhone("");
      setBillItems([{ name: "", qty: 1, rate: 0 }]);
      setTaxPercent(0);
      alert(`Invoice ${invNum} created successfully.`);
    } catch (err: any) {
      alert("Failed to create invoice: " + err.message);
    } finally {
      setSavingBill(false);
    }
  };

  const sendWhatsApp = (inv: InvoiceRecord) => {
    const upiLink = company?.upi_id
      ? `upi://pay?pa=${company.upi_id}&pn=${encodeURIComponent(company.name)}&am=${inv.total_amount}&cu=INR`
      : "";
    const msg = encodeURIComponent(
      `*Tax Invoice from ${company?.name || "Our Business"}*\n\n` +
      `*Invoice No:* ${inv.invoice_number}\n` +
      `*Customer:* ${inv.customer_name}\n` +
      `*Total Amount:* ₹${inv.total_amount}\n` +
      `*Payment Status:* ${inv.payment_status.toUpperCase()}\n` +
      (inv.payment_status === "pending" && company?.upi_id ? `\n*Pay via UPI:* ${upiLink}\n` : "") +
      `\nThank you for your business!`
    );
    const phone = inv.customer_phone ? inv.customer_phone.replace(/\D/g, "") : "";
    window.open(phone ? `https://wa.me/91${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
  };

  const triggerCleanPrint = () => {
    const printContent = document.getElementById("clean-invoice-print-area");
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${printingInvoice?.invoice_number || "Invoice"}</title>
          <style>
            @page {
              margin: 10mm;
              size: auto;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #000;
              margin: 0;
              padding: 0;
              background: #fff;
            }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            * {
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 400);
  };

  const customersList = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; totalBills: number; totalAmount: number; invoices: InvoiceRecord[] }>();
    invoices.forEach((inv) => {
      const key = (inv.customer_phone && inv.customer_phone.trim()) ? inv.customer_phone.trim() : inv.customer_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: inv.customer_name,
          phone: inv.customer_phone || "N/A",
          totalBills: 1,
          totalAmount: Number(inv.total_amount),
          invoices: [inv],
        });
      } else {
        const item = map.get(key)!;
        item.totalBills += 1;
        item.totalAmount += Number(inv.total_amount);
        item.invoices.push(inv);
      }
    });

    const arr = Array.from(map.values());
    if (!customerSearch.trim()) return arr;
    const q = customerSearch.toLowerCase();
    return arr.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [invoices, customerSearch]);

  const filteredReportInvoices = useMemo(() => {
    const now = new Date();
    return invoices.filter((inv) => {
      const invDate = new Date(inv.created_at);
      const diffMs = now.getTime() - invDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (reportDuration === "daily") return diffDays <= 1;
      if (reportDuration === "weekly") return diffDays <= 7;
      if (reportDuration === "monthly") return diffDays <= 30;
      if (reportDuration === "3m") return diffDays <= 90;
      if (reportDuration === "6m") return diffDays <= 180;
      if (reportDuration === "9m") return diffDays <= 270;
      if (reportDuration === "12m") return diffDays <= 365;
      return true;
    });
  }, [invoices, reportDuration]);

  const totalSales = invoices.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
  const totalReceived = invoices
    .filter((i) => i.payment_status === "paid")
    .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
  const totalPending = invoices
    .filter((i) => i.payment_status === "pending")
    .reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);

  const theme = darkMode
    ? {
        bg: "#0f172a",
        sidebar: "#1e293b",
        cardBg: "#1e293b",
        cardBorder: "#334155",
        text: "#f8fafc",
        textSecondary: "#94a3b8",
        navHover: "#334155",
        inputBg: "#0f172a",
        inputBorder: "#475569",
      }
    : {
        bg: "#f8fafc",
        sidebar: "#ffffff",
        cardBg: "#ffffff",
        cardBorder: "#e2e8f0",
        text: "#0f172a",
        textSecondary: "#64748b",
        navHover: "#f1f5f9",
        inputBg: "#ffffff",
        inputBorder: "#cbd5e1",
      };

  const navItems = [
    { id: "dashboard", label: "📊 Dashboard" },
    { id: "customers", label: "👥 Customers" },
    { id: "services", label: "🏷️ Services & Rates" },
    { id: "payments", label: "💰 Payments & Due" },
    { id: "reports", label: "📈 Sales Reports" },
    { id: "settings", label: "⚙️ Settings" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        Loading Workspace...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: theme.bg, color: theme.text, minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* TOP HEADER */}
      <header style={{ backgroundColor: theme.sidebar, borderBottom: `1px solid ${theme.cardBorder}`, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" style={{ width: "36px", height: "36px", maxWidth: "36px", maxHeight: "36px", borderRadius: "8px", objectFit: "contain", border: `1px solid ${theme.cardBorder}` }} />
          ) : (
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
              {company?.name?.slice(0, 1) || "J"}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: "15px", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company?.name || "Workspace"}</div>
            <div style={{ fontSize: "11px", color: theme.textSecondary }}>Billing Suite</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setShowBillModal(true)}
            style={{ backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "8px 14px", borderRadius: "8px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
          >
            + Create Bill
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ backgroundColor: theme.navHover, color: theme.text, border: `1px solid ${theme.cardBorder}`, padding: "8px 12px", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* TOP NAVIGATION TABS BAR */}
      <div style={{ backgroundColor: theme.sidebar, borderBottom: `1px solid ${theme.cardBorder}`, padding: "8px 16px", display: "flex", gap: "8px", overflowX: "auto", whiteSpace: "nowrap" }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as any);
              setSelectedCustomer(null);
            }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              border: "none",
              fontSize: "12px",
              fontWeight: 700,
              backgroundColor: activeTab === item.id ? "#4f46e5" : "transparent",
              color: activeTab === item.id ? "#ffffff" : theme.textSecondary,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* MOBILE DRAWER IF OPEN */}
      {mobileMenuOpen && (
        <div style={{ backgroundColor: theme.cardBg, borderBottom: `1px solid ${theme.cardBorder}`, padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12px", color: theme.textSecondary }}>Signed in as: <b>{user?.email}</b></div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setDarkMode(!darkMode)}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, background: "transparent", color: theme.text, fontSize: "12px" }}
            >
              {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button
              onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}
              style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: "bold", fontSize: "12px" }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{ padding: "16px", maxWidth: "1200px", margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        
        {/* TAB: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "14px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: theme.textSecondary, fontWeight: 700 }}>TOTAL REVENUE</div>
                <div style={{ fontSize: "20px", fontWeight: 800, marginTop: "4px" }}>₹{totalSales.toLocaleString("en-IN")}</div>
              </div>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "14px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#16a34a", fontWeight: 700 }}>PAID COLLECTED</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>₹{totalReceived.toLocaleString("en-IN")}</div>
              </div>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "14px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700 }}>DUE OUTSTANDING</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#dc2626", marginTop: "4px" }}>₹{totalPending.toLocaleString("en-IN")}</div>
              </div>
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "14px", borderRadius: "12px" }}>
                <div style={{ fontSize: "11px", color: "#4f46e5", fontWeight: 700 }}>ACTIVE CLIENTS</div>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#4f46e5", marginTop: "4px" }}>{customersList.length}</div>
              </div>
            </div>

            <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "15px" }}>Recent Invoices</h3>
              <InvoiceTable
                invoices={invoices.slice(0, 10)}
                theme={theme}
                onPrint={(inv) => setPrintingInvoice(inv)}
                onWhatsApp={sendWhatsApp}
                onToggleStatus={togglePaymentStatus}
                onDeleteInvoice={handleDeleteInvoice}
              />
            </div>
          </div>
        )}

        {/* TAB: CUSTOMERS */}
        {activeTab === "customers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>Customer Directory</h3>
                <input
                  type="text"
                  placeholder="🔍 Search name or mobile..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", width: "100%", maxWidth: "260px" }}
                />
              </div>

              {customersList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: theme.textSecondary, fontSize: "13px" }}>No customers found.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "460px" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "10px" }}>
                        <th style={{ padding: "8px" }}>Name</th>
                        <th style={{ padding: "8px" }}>Mobile</th>
                        <th style={{ padding: "8px" }}>Bills</th>
                        <th style={{ padding: "8px" }}>Total Spend</th>
                        <th style={{ padding: "8px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customersList.map((c, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                          <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{c.name}</td>
                          <td style={{ padding: "10px 8px", color: theme.textSecondary }}>{c.phone}</td>
                          <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{c.totalBills} Bills</td>
                          <td style={{ padding: "10px 8px", fontWeight: "bold", color: "#16a34a" }}>₹{c.totalAmount.toLocaleString("en-IN")}</td>
                          <td style={{ padding: "10px 8px", textAlign: "right" }}>
                            <button
                              onClick={() => setSelectedCustomer(c.name)}
                              style={{ backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", cursor: "pointer" }}
                            >
                              View ({c.totalBills})
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px" }}>Invoices for: <span style={{ color: "#4f46e5" }}>{selectedCustomer}</span></h4>
                  <button onClick={() => setSelectedCustomer(null)} style={{ border: "none", background: "none", color: "#dc2626", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>Close ✕</button>
                </div>
                <InvoiceTable
                  invoices={invoices.filter((i) => i.customer_name.toLowerCase() === selectedCustomer.toLowerCase())}
                  theme={theme}
                  onPrint={(inv) => setPrintingInvoice(inv)}
                  onWhatsApp={sendWhatsApp}
                  onToggleStatus={togglePaymentStatus}
                  onDeleteInvoice={handleDeleteInvoice}
                  showStatusToggleAction={true}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB: SERVICES */}
        {activeTab === "services" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px", height: "fit-content" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>{editingServiceId ? "✏️ Edit Service" : "+ Add Service"}</h3>
              <form onSubmit={handleSaveService} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Service / Item Name</label>
                  <input type="text" required placeholder="e.g. Graphic Design" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Rate (₹)</label>
                  <input type="number" min="0" required placeholder="e.g. 1200" value={newServiceRate} onChange={(e) => setNewServiceRate(e.target.value === "" ? "" : Number(e.target.value))} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button type="submit" disabled={savingService} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", backgroundColor: editingServiceId ? "#16a34a" : "#4f46e5", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>
                    {savingService ? "Saving..." : editingServiceId ? "Update" : "Save Service"}
                  </button>
                  {editingServiceId && (
                    <button type="button" onClick={handleCancelEditService} style={{ padding: "9px 14px", borderRadius: "8px", border: `1px solid ${theme.cardBorder}`, background: "transparent", color: theme.text, fontSize: "12px" }}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Catalog ({services.length})</h3>
              {services.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: theme.textSecondary, fontSize: "12px" }}>No items saved.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "10px" }}>
                        <th style={{ padding: "6px" }}>Item</th>
                        <th style={{ padding: "6px" }}>Rate</th>
                        <th style={{ padding: "6px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((srv) => (
                        <tr key={srv.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                          <td style={{ padding: "8px 6px", fontWeight: "bold" }}>{srv.name}</td>
                          <td style={{ padding: "8px 6px", color: "#16a34a", fontWeight: "bold" }}>₹{Number(srv.default_rate).toLocaleString("en-IN")}</td>
                          <td style={{ padding: "8px 6px", textAlign: "right" }}>
                            <button onClick={() => handleStartEditService(srv)} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: "#e0e7ff", color: "#4338ca", fontSize: "10px", fontWeight: "bold", marginRight: "4px", cursor: "pointer" }}>Edit</button>
                            <button onClick={() => handleDeleteService(srv.id)} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", backgroundColor: "#fee2e2", color: "#dc2626", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PAYMENTS */}
        {activeTab === "payments" && (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "15px" }}>Payments & Due Ledger</h3>
              <div style={{ padding: "6px 12px", borderRadius: "8px", background: "#fee2e2", color: "#b91c1c", fontWeight: "bold", fontSize: "12px" }}>
                Total Due: ₹{totalPending.toLocaleString("en-IN")}
              </div>
            </div>
            <InvoiceTable
              invoices={invoices}
              theme={theme}
              onPrint={(inv) => setPrintingInvoice(inv)}
              onWhatsApp={sendWhatsApp}
              onToggleStatus={togglePaymentStatus}
              onDeleteInvoice={handleDeleteInvoice}
              showStatusToggleAction={true}
            />
          </div>
        )}

        {/* TAB: REPORTS */}
        {activeTab === "reports" && (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <h3 style={{ margin: 0, fontSize: "15px" }}>Sales Performance</h3>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {(["daily", "weekly", "monthly", "3m", "6m", "9m", "12m"] as const).map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setReportDuration(dur)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      backgroundColor: reportDuration === dur ? "#4f46e5" : theme.navHover,
                      color: reportDuration === dur ? "#fff" : theme.textSecondary,
                      cursor: "pointer",
                    }}
                  >
                    {dur}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
              <div style={{ padding: "12px", borderRadius: "10px", background: theme.navHover }}>
                <div style={{ fontSize: "11px", color: theme.textSecondary }}>Period Bills</div>
                <div style={{ fontSize: "18px", fontWeight: "bold", marginTop: "4px" }}>{filteredReportInvoices.length}</div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: theme.navHover }}>
                <div style={{ fontSize: "11px", color: "#16a34a" }}>Collected</div>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#16a34a", marginTop: "4px" }}>
                  ₹{filteredReportInvoices.filter((i) => i.payment_status === "paid").reduce((s, c) => s + Number(c.total_amount), 0).toLocaleString("en-IN")}
                </div>
              </div>
              <div style={{ padding: "12px", borderRadius: "10px", background: theme.navHover }}>
                <div style={{ fontSize: "11px", color: "#dc2626" }}>Pending</div>
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#dc2626", marginTop: "4px" }}>
                  ₹{filteredReportInvoices.filter((i) => i.payment_status === "pending").reduce((s, c) => s + Number(c.total_amount), 0).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            <InvoiceTable
              invoices={filteredReportInvoices}
              theme={theme}
              onPrint={(inv) => setPrintingInvoice(inv)}
              onWhatsApp={sendWhatsApp}
              onToggleStatus={togglePaymentStatus}
              onDeleteInvoice={handleDeleteInvoice}
            />
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeTab === "settings" && (
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "18px", maxWidth: "600px" }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: "16px" }}>Business Profile & Bank Details</h3>

            <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Logo Upload Box (Controlled Dimensions) */}
              <div style={{ padding: "12px", borderRadius: "10px", border: `1px dashed ${theme.cardBorder}`, background: theme.navHover, display: "flex", alignItems: "center", gap: "14px" }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ width: "48px", height: "48px", maxWidth: "48px", maxHeight: "48px", borderRadius: "8px", objectFit: "contain", background: "#fff", border: "1px solid #cbd5e1" }} />
                ) : (
                  <div style={{ width: "48px", height: "48px", borderRadius: "8px", border: "1px dashed #94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: theme.textSecondary }}>No Logo</div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>Business Logo</label>
                  <input type="file" accept="image/*" onChange={handleLocalLogoUpload} style={{ fontSize: "11px", width: "100%" }} />
                </div>
                {logoUrl && (
                  <button type="button" onClick={() => setLogoUrl("")} style={{ padding: "4px 8px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#dc2626", fontSize: "11px", fontWeight: "bold" }}>Remove</button>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Company / Shop Name *</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Mobile Phone</label>
                <input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Billing Email</label>
                <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Physical Address</label>
                <textarea rows={2} value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>

              <div style={{ borderTop: `1px solid ${theme.cardBorder}`, paddingTop: "10px" }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "13px" }}>Bank & UPI Information</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Bank Name</label>
                    <input type="text" placeholder="HDFC Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "11px", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Account Number</label>
                    <input type="text" placeholder="501002345678" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "11px", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>IFSC Code</label>
                    <input type="text" placeholder="HDFC0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "11px", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>UPI ID (For QR)</label>
                    <input type="text" placeholder="name@okhdfc" value={upiId} onChange={(e) => setUpiId(e.target.value)} style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "11px", boxSizing: "border-box" }} />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={savingSettings} style={{ padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#4f46e5", color: "#fff", fontWeight: "bold", fontSize: "12px", cursor: "pointer", marginTop: "6px" }}>
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </form>
          </div>
        )}
      </main>

      {/* CREATE BILL MODAL */}
      {showBillModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
          <div style={{ backgroundColor: theme.cardBg, color: theme.text, width: "100%", maxWidth: "520px", borderRadius: "14px", padding: "18px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${theme.cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Generate New Invoice</h3>
              <button onClick={() => setShowBillModal(false)} style={{ background: "none", border: "none", color: theme.textSecondary, fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>Customer Name *</label>
                <input type="text" required placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "7px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>WhatsApp Phone</label>
                <input type="text" placeholder="9876543210" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "7px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px", boxSizing: "border-box" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "4px" }}>Items</label>
                {billItems.map((item, index) => (
                  <div key={index} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                    <input
                      list={`srv-list-${index}`}
                      type="text"
                      placeholder="Item..."
                      value={item.name}
                      onChange={(e) => handleSelectServiceForItem(index, e.target.value)}
                      style={{ flex: 2, padding: "7px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px" }}
                      required
                    />
                    <datalist id={`srv-list-${index}`}>
                      {services.map((s) => (
                        <option key={s.id} value={s.name}>₹{s.default_rate}</option>
                      ))}
                    </datalist>

                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={item.qty}
                      onChange={(e) => {
                        const n = [...billItems];
                        n[index].qty = Number(e.target.value);
                        setBillItems(n);
                      }}
                      style={{ width: "50px", padding: "7px", textAlign: "center", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px" }}
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      min="0"
                      value={item.rate || ""}
                      onChange={(e) => {
                        const n = [...billItems];
                        n[index].rate = Number(e.target.value);
                        setBillItems(n);
                      }}
                      style={{ width: "75px", padding: "7px", textAlign: "right", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px" }}
                      required
                    />
                    {billItems.length > 1 && (
                      <button type="button" onClick={() => setBillItems(billItems.filter((_, i) => i !== index))} style={{ border: "none", background: "none", color: "#ef4444", fontWeight: "bold", cursor: "pointer" }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setBillItems([...billItems, { name: "", qty: 1, rate: 0 }])} style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: "bold", fontSize: "12px", cursor: "pointer", padding: 0 }}>+ Add Item</button>
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>Payment</label>
                  <select value={initialPaymentStatus} onChange={(e) => setInitialPaymentStatus(e.target.value as any)} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px" }}>
                    <option value="paid">✅ Paid</option>
                    <option value="pending">⏳ Pending</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", marginBottom: "3px" }}>Tax</label>
                  <select value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} style={{ width: "100%", padding: "7px", borderRadius: "6px", border: `1px solid ${theme.inputBorder}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: "12px" }}>
                    <option value={0}>0% Tax</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                  </select>
                </div>
              </div>

              <div style={{ background: theme.navHover, padding: "10px", borderRadius: "8px", display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px" }}>
                <span>Total:</span>
                <span style={{ color: "#4f46e5" }}>₹{grandTotal.toFixed(2)}</span>
              </div>

              <button type="submit" disabled={savingBill} style={{ padding: "10px", borderRadius: "8px", border: "none", backgroundColor: "#4f46e5", color: "#fff", fontWeight: "bold", fontSize: "13px", cursor: "pointer" }}>
                {savingBill ? "Generating..." : `Create Invoice (₹${grandTotal.toFixed(2)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {printingInvoice && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
          <div style={{ backgroundColor: "#ffffff", color: "#000000", width: "100%", maxWidth: "600px", borderRadius: "12px", padding: "20px", maxHeight: "95vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
              <button onClick={triggerCleanPrint} style={{ backgroundColor: "#4f46e5", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>
                🖨️ Print / Save PDF
              </button>
              <button onClick={() => setPrintingInvoice(null)} style={{ background: "none", border: "none", fontSize: "18px", color: "#64748b", cursor: "pointer" }}>✕</button>
            </div>

            <div id="clean-invoice-print-area">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "12px" }}>
                <div>
                  {company?.logo_url && (
                    <img src={company.logo_url} alt="Logo" style={{ height: "40px", maxHeight: "40px", objectFit: "contain", marginBottom: "6px", display: "block" }} />
                  )}
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>{company?.name}</h2>
                  {company?.phone && <div style={{ fontSize: "11px", color: "#475569" }}>Mobile: {company.phone}</div>}
                  {company?.business_address && <div style={{ fontSize: "11px", color: "#475569" }}>{company.business_address}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "#4f46e5" }}>TAX INVOICE</h3>
                  <div style={{ fontSize: "11px", marginTop: "4px" }}><b>#{printingInvoice.invoice_number}</b></div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{new Date(printingInvoice.created_at).toLocaleDateString("en-IN")}</div>
                </div>
              </div>

              <div style={{ margin: "12px 0", fontSize: "12px" }}>
                <div style={{ color: "#64748b", fontSize: "10px", fontWeight: "bold" }}>BILLED TO:</div>
                <div style={{ fontWeight: "bold", fontSize: "14px" }}>{printingInvoice.customer_name}</div>
                {printingInvoice.customer_phone && <div style={{ color: "#475569" }}>Phone: {printingInvoice.customer_phone}</div>}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", margin: "12px 0", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #000", textTransform: "uppercase", fontSize: "10px" }}>
                    <th style={{ textAlign: "left", padding: "6px 0" }}>Description</th>
                    <th style={{ textAlign: "center", padding: "6px 0" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "6px 0" }}>Rate</th>
                    <th style={{ textAlign: "right", padding: "6px 0" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printingInvoice.items && printingInvoice.items.length > 0 ? (
                    printingInvoice.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 0" }}>{it.name}</td>
                        <td style={{ textAlign: "center", padding: "8px 0" }}>{it.qty}</td>
                        <td style={{ textAlign: "right", padding: "8px 0" }}>₹{Number(it.rate).toFixed(2)}</td>
                        <td style={{ textAlign: "right", padding: "8px 0", fontWeight: "bold" }}>₹{(it.qty * it.rate).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 0" }}>Items</td>
                      <td style={{ textAlign: "center", padding: "8px 0" }}>1</td>
                      <td style={{ textAlign: "right", padding: "8px 0" }}>₹{printingInvoice.total_amount}</td>
                      <td style={{ textAlign: "right", padding: "8px 0", fontWeight: "bold" }}>₹{printingInvoice.total_amount}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: "2px solid #000", fontWeight: "bold", fontSize: "14px" }}>
                    <td colSpan={3} style={{ padding: "10px 0", textAlign: "right" }}>Total:</td>
                    <td style={{ padding: "10px 0", textAlign: "right", color: "#4f46e5" }}>₹{Number(printingInvoice.total_amount).toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px dashed #cbd5e1", paddingTop: "12px" }}>
                <div style={{ fontSize: "11px", color: "#334155" }}>
                  {company?.bank_name && <div>Bank: <b>{company.bank_name}</b></div>}
                  {company?.account_number && <div>A/c: <b>{company.account_number}</b></div>}
                  {company?.ifsc_code && <div>IFSC: <b>{company.ifsc_code}</b></div>}
                  {company?.upi_id && <div>UPI: <b>{company.upi_id}</b></div>}
                </div>
                {company?.upi_id && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                        `upi://pay?pa=${company.upi_id}&pn=${company.name}&am=${printingInvoice.total_amount}&cu=INR`
                      )}`}
                      alt="UPI QR"
                      style={{ width: "75px", height: "75px", border: "1px solid #e2e8f0", padding: "2px", borderRadius: "6px" }}
                    />
                    <div style={{ fontSize: "9px", color: "#64748b", marginTop: "2px" }}>Scan & Pay UPI</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InvoiceTable({
  invoices,
  theme,
  onPrint,
  onWhatsApp,
  onToggleStatus,
  onDeleteInvoice,
  showStatusToggleAction = false,
}: {
  invoices: InvoiceRecord[];
  theme: any;
  onPrint: (inv: InvoiceRecord) => void;
  onWhatsApp: (inv: InvoiceRecord) => void;
  onToggleStatus: (id: string, st: "paid" | "pending") => void;
  onDeleteInvoice: (id: string, invoiceNumber: string) => void;
  showStatusToggleAction?: boolean;
}) {
  if (invoices.length === 0) {
    return <div style={{ color: theme.textSecondary, textAlign: "center", padding: "24px", fontSize: "12px" }}>No invoice records available.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px", minWidth: "480px" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "10px" }}>
            <th style={{ padding: "8px" }}>Invoice #</th>
            <th style={{ padding: "8px" }}>Customer</th>
            <th style={{ padding: "8px" }}>Amount</th>
            <th style={{ padding: "8px" }}>Status</th>
            <th style={{ padding: "8px", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
              <td style={{ padding: "10px 8px", fontWeight: "bold" }}>{inv.invoice_number}</td>
              <td style={{ padding: "10px 8px" }}>
                <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
                {inv.customer_phone && <div style={{ color: theme.textSecondary, fontSize: "10px" }}>{inv.customer_phone}</div>}
              </td>
              <td style={{ padding: "10px 8px", fontWeight: "bold" }}>₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
              <td style={{ padding: "10px 8px" }}>
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: "bold",
                    backgroundColor: inv.payment_status === "paid" ? "#dcfce7" : "#fee2e2",
                    color: inv.payment_status === "paid" ? "#15803d" : "#b91c1c",
                  }}
                >
                  {inv.payment_status.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "10px 8px", textAlign: "right" }}>
                <div style={{ display: "inline-flex", gap: "4px" }}>
                  {showStatusToggleAction && (
                    <button
                      onClick={() => onToggleStatus(inv.id, inv.payment_status)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "5px",
                        border: "none",
                        fontSize: "10px",
                        fontWeight: "bold",
                        cursor: "pointer",
                        backgroundColor: inv.payment_status === "paid" ? "#f1f5f9" : "#22c55e",
                        color: inv.payment_status === "paid" ? "#475569" : "#ffffff",
                      }}
                    >
                      {inv.payment_status === "paid" ? "Due" : "Paid"}
                    </button>
                  )}
                  <button
                    onClick={() => onWhatsApp(inv)}
                    style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", padding: "4px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    WA
                  </button>
                  <button
                    onClick={() => onPrint(inv)}
                    style={{ backgroundColor: theme.navHover, color: theme.text, border: `1px solid ${theme.cardBorder}`, padding: "4px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Print
                  </button>
                  <button
                    onClick={() => onDeleteInvoice(inv.id, inv.invoice_number)}
                    style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "none", padding: "4px 8px", borderRadius: "5px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Del
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}