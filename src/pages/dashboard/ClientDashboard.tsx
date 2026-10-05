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

  // Settings inputs (Company profile, Bank, UPI, Logo)
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

  // Local Logo File Upload
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

  // Add / Edit Service (Duplicate Check Included)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newServiceName.trim();
    if (!trimmedName) return alert("Service name is required.");

    const isDuplicate = services.some(
      (s) => s.name.toLowerCase() === trimmedName.toLowerCase() && s.id !== editingServiceId
    );
    if (isDuplicate) {
      return alert(`A service named '${trimmedName}' already exists. Please choose a different name or edit the existing service.`);
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

  // Save Settings
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

  // Bill Calculations
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

  // CLEAN PDF PRINT METHOD (REMOVES URL, HEADER, FOOTER, BUTTONS ENTIRELY)
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

  // Grouped Unique Customers list
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

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        Loading Workspace...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: theme.bg, color: theme.text, fontFamily: "system-ui, sans-serif" }}>
      {/* 1. SIDEBAR */}
      <aside style={{ width: "260px", backgroundColor: theme.sidebar, borderRight: `1px solid ${theme.cardBorder}`, display: "flex", flexDirection: "column", padding: "20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px", padding: "0 8px" }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" style={{ width: "40px", height: "40px", borderRadius: "8px", objectFit: "contain", border: `1px solid ${theme.cardBorder}` }} />
          ) : (
            <div style={{ width: "40px", height: "40px", borderRadius: "8px", backgroundColor: "#4f46e5", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "18px" }}>
              {company?.name?.slice(0, 1) || "J"}
            </div>
          )}
          <div>
            <div style={{ fontWeight: "700", fontSize: "16px" }}>{company?.name || "Workspace"}</div>
            <div style={{ fontSize: "11px", color: theme.textSecondary }}>Billing Suite</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
          {[
            { id: "dashboard", label: "📊 Dashboard" },
            { id: "customers", label: "👥 Customers" },
            { id: "services", label: "🏷️ Services & Rates" },
            { id: "payments", label: "💰 Payments & Outstanding" },
            { id: "reports", label: "📈 Sales Reports" },
            { id: "settings", label: "⚙️ Company & Bank Settings" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setSelectedCustomer(null);
              }}
              style={{
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "none",
                fontSize: "14px",
                fontWeight: activeTab === item.id ? "700" : "500",
                backgroundColor: activeTab === item.id ? "#4f46e5" : "transparent",
                color: activeTab === item.id ? "#ffffff" : theme.textSecondary,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: `1px solid ${theme.cardBorder}`, paddingTop: "16px" }}>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: `1px solid ${theme.cardBorder}`,
              backgroundColor: "transparent",
              color: theme.text,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}
            style={{
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <header style={{ height: "64px", borderBottom: `1px solid ${theme.cardBorder}`, backgroundColor: theme.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
          <div style={{ fontSize: "14px", color: theme.textSecondary }}>
            Account: <b>{user?.email}</b>
          </div>
          <button
            onClick={() => setShowBillModal(true)}
            style={{
              backgroundColor: "#4f46e5",
              color: "#ffffff",
              border: "none",
              padding: "9px 18px",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            + Create Invoice
          </button>
        </header>

        <main style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "20px", borderRadius: "14px" }}>
                  <div style={{ fontSize: "12px", color: theme.textSecondary, fontWeight: "600" }}>TOTAL REVENUE</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", marginTop: "8px" }}>₹{totalSales.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "20px", borderRadius: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>PAID COLLECTED</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#16a34a", marginTop: "8px" }}>₹{totalReceived.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "20px", borderRadius: "14px" }}>
                  <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>OUTSTANDING DUE</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#dc2626", marginTop: "8px" }}>₹{totalPending.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, padding: "20px", borderRadius: "14px" }}>
                  <div style={{ fontSize: "12px", color: theme.textSecondary, fontWeight: "600" }}>ACTIVE CUSTOMERS</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#4f46e5", marginTop: "8px" }}>{customersList.length}</div>
                </div>
              </div>

              <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Recent Invoices</h3>
                <InvoiceTable
                  invoices={invoices.slice(0, 10)}
                  theme={theme}
                  onPrint={(inv) => setPrintingInvoice(inv)}
                  onWhatsApp={sendWhatsApp}
                  onToggleStatus={togglePaymentStatus}
                  onDeleteInvoice={handleDeleteInvoice}
                />
              </div>
            </>
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === "customers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "20px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "18px" }}>Customer Directory</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.textSecondary }}>
                      Comprehensive customer directory, contact numbers, and billing transactions.
                    </p>
                  </div>
                  <div style={{ position: "relative", minWidth: "260px" }}>
                    <input
                      type="text"
                      placeholder="🔍 Search name or mobile..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    />
                  </div>
                </div>

                {customersList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: theme.textSecondary, fontSize: "14px" }}>
                    No matching customer records found.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "11px" }}>
                          <th style={{ padding: "10px" }}>Customer Name</th>
                          <th style={{ padding: "10px" }}>Mobile Number</th>
                          <th style={{ padding: "10px" }}>Total Invoices</th>
                          <th style={{ padding: "10px" }}>Total Spend</th>
                          <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customersList.map((c, idx) => (
                          <tr key={idx} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                            <td style={{ padding: "12px 10px", fontWeight: "600" }}>{c.name}</td>
                            <td style={{ padding: "12px 10px", color: theme.textSecondary }}>{c.phone}</td>
                            <td style={{ padding: "12px 10px", fontWeight: "700" }}>{c.totalBills} Invoices</td>
                            <td style={{ padding: "12px 10px", fontWeight: "700", color: "#16a34a" }}>₹{c.totalAmount.toLocaleString("en-IN")}</td>
                            <td style={{ padding: "12px 10px", textAlign: "right" }}>
                              <button
                                onClick={() => setSelectedCustomer(c.name)}
                                style={{
                                  backgroundColor: "#4f46e5",
                                  color: "#ffffff",
                                  border: "none",
                                  padding: "6px 14px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  cursor: "pointer",
                                }}
                              >
                                View Invoices ({c.totalBills})
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
                <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px" }}>
                        Invoices for: <span style={{ color: "#4f46e5" }}>{selectedCustomer}</span>
                      </h4>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: theme.textSecondary }}>
                        All historical billing records for this customer are listed below.
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      style={{ background: "none", border: "none", color: "#dc2626", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}
                    >
                      Close View ✕
                    </button>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
              <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "18px" }}>
                  {editingServiceId ? "✏️ Edit Service" : "+ Add New Service"}
                </h3>
                <p style={{ fontSize: "12px", color: theme.textSecondary, marginBottom: "20px" }}>
                  {editingServiceId ? "Modify service name and default rate." : "Duplicate names are automatically prevented."}
                </p>

                <form onSubmit={handleSaveService} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <label style={labelStyle}>Service / Product Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Website Design or Repair"
                      required
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Default Price / Rate (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      required
                      value={newServiceRate}
                      onChange={(e) => setNewServiceRate(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <button
                      type="submit"
                      disabled={savingService}
                      style={{
                        flex: 1,
                        backgroundColor: editingServiceId ? "#16a34a" : "#4f46e5",
                        color: "#fff",
                        border: "none",
                        padding: "10px",
                        borderRadius: "8px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {savingService ? "Saving..." : editingServiceId ? "Update Service" : "Save Service"}
                    </button>
                    {editingServiceId && (
                      <button
                        type="button"
                        onClick={handleCancelEditService}
                        style={{
                          backgroundColor: "#f1f5f9",
                          color: "#475569",
                          border: "none",
                          padding: "10px 16px",
                          borderRadius: "8px",
                          fontWeight: "600",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: "18px" }}>Saved Catalog ({services.length})</h3>
                {services.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px", color: theme.textSecondary, fontSize: "14px" }}>
                    No services in the catalog yet. Use the form on the left to add one.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "11px", textAlign: "left" }}>
                        <th style={{ padding: "10px" }}>Service Name</th>
                        <th style={{ padding: "10px" }}>Standard Rate</th>
                        <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((srv) => (
                        <tr key={srv.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
                          <td style={{ padding: "12px 10px", fontWeight: "600" }}>{srv.name}</td>
                          <td style={{ padding: "12px 10px", fontWeight: "700", color: "#16a34a" }}>₹{Number(srv.default_rate).toLocaleString("en-IN")}</td>
                          <td style={{ padding: "12px 10px", textAlign: "right" }}>
                            <button
                              onClick={() => handleStartEditService(srv)}
                              style={{ backgroundColor: "#e0e7ff", color: "#4338ca", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", marginRight: "6px" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteService(srv.id)}
                              style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* TAB: PAYMENTS */}
          {activeTab === "payments" && (
            <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>Payment Tracker & Ledger</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.textSecondary }}>
                    Monitor outstanding receivables and reconcile payments with a single click.
                  </p>
                </div>
                <div style={{ padding: "8px 16px", backgroundColor: "#fee2e2", color: "#b91c1c", borderRadius: "8px", fontWeight: "700", fontSize: "14px" }}>
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
            <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>Sales & Financial Analytics</h3>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: theme.textSecondary }}>
                    Aggregate performance over Daily, Weekly, Monthly, Quarterly, and Yearly intervals.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(["daily", "weekly", "monthly", "3m", "6m", "9m", "12m"] as const).map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setReportDuration(dur)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "600",
                        textTransform: "uppercase",
                        backgroundColor: reportDuration === dur ? "#4f46e5" : theme.navHover,
                        color: reportDuration === dur ? "#fff" : theme.textSecondary,
                        cursor: "pointer",
                      }}
                    >
                      {dur === "daily" ? "Daily" : dur === "weekly" ? "Weekly" : dur === "monthly" ? "Monthly" : dur}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: theme.navHover }}>
                  <div style={{ fontSize: "12px", color: theme.textSecondary }}>Period Invoices</div>
                  <div style={{ fontSize: "22px", fontWeight: "700" }}>{filteredReportInvoices.length}</div>
                </div>
                <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: theme.navHover }}>
                  <div style={{ fontSize: "12px", color: "#16a34a" }}>Revenue Collected</div>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#16a34a" }}>
                    ₹{filteredReportInvoices.filter((i) => i.payment_status === "paid").reduce((s, c) => s + Number(c.total_amount), 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div style={{ padding: "16px", borderRadius: "10px", backgroundColor: theme.navHover }}>
                  <div style={{ fontSize: "12px", color: "#dc2626" }}>Pending Balances</div>
                  <div style={{ fontSize: "22px", fontWeight: "700", color: "#dc2626" }}>
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
            <div style={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.cardBorder}`, borderRadius: "14px", padding: "28px", maxWidth: "800px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>Organization & Payment Settings</h3>
              <p style={{ color: theme.textSecondary, fontSize: "13px", marginBottom: "24px" }}>
                Update your business branding, contact data, and settlement credentials. All details dynamically synchronize with the printable invoice template.
              </p>

              <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Logo file */}
                <div style={{ padding: "16px", borderRadius: "12px", border: `1px dashed ${theme.cardBorder}`, backgroundColor: theme.navHover, display: "flex", alignItems: "center", gap: "20px" }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview" style={{ width: "70px", height: "70px", borderRadius: "8px", objectFit: "contain", backgroundColor: "#fff", border: "1px solid #cbd5e1" }} />
                  ) : (
                    <div style={{ width: "70px", height: "70px", borderRadius: "8px", border: "1px dashed #94a3b8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: theme.textSecondary, textAlign: "center" }}>
                      No Logo
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, fontSize: "13px" }}>Business Logo (From Device)</label>
                    <input type="file" accept="image/*" onChange={handleLocalLogoUpload} style={{ fontSize: "12px", marginTop: "4px" }} />
                    <div style={{ fontSize: "11px", color: theme.textSecondary, marginTop: "4px" }}>PNG, JPG or SVG (Max 2MB)</div>
                  </div>
                  {logoUrl && (
                    <button type="button" onClick={() => setLogoUrl("")} style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer" }}>
                      Remove
                    </button>
                  )}
                </div>

                {/* Company details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={labelStyle}>Company / Trade Name *</label>
                    <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Business Contact Phone *</label>
                    <input type="text" placeholder="e.g. +91 98765 43210" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div>
                    <label style={labelStyle}>Business Email</label>
                    <input type="email" placeholder="billing@organization.com" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                  </div>
                  <div>
                    <label style={labelStyle}>GSTIN / Tax Registration No. (Optional)</label>
                    <input type="text" placeholder="e.g. 27AAAAA0000A1Z5" value={gstin} onChange={(e) => setGstin(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Physical Office / Store Address</label>
                  <textarea rows={2} placeholder="Suite No, Street Address, City, State, PIN..." value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                </div>

                {/* Bank & Payment */}
                <div style={{ borderTop: `1px solid ${theme.cardBorder}`, paddingTop: "14px" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Bank Account & UPI Settlement Credentials</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={labelStyle}>Bank Name</label>
                      <input type="text" placeholder="HDFC Bank" value={bankName} onChange={(e) => setBankName(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Account Number</label>
                      <input type="text" placeholder="501002345678" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                    </div>
                    <div>
                      <label style={labelStyle}>IFSC / Routing Code</label>
                      <input type="text" placeholder="HDFC0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                    </div>
                  </div>
                  <div style={{ marginTop: "12px" }}>
                    <label style={labelStyle}>VPA / UPI ID (Generates Dynamic Bill QR Code)</label>
                    <input type="text" placeholder="e.g. payments@okhdfcbank" value={upiId} onChange={(e) => setUpiId(e.target.value)} style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }} />
                  </div>
                </div>

                <button type="submit" disabled={savingSettings} style={{ alignSelf: "flex-start", backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }}>
                  {savingSettings ? "Saving Settings..." : "Save Configuration"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* CREATE BILL MODAL */}
      {showBillModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "20px" }}>
          <div style={{ backgroundColor: theme.cardBg, color: theme.text, width: "100%", maxWidth: "620px", borderRadius: "16px", padding: "24px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${theme.cardBorder}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px" }}>Generate New Invoice</h3>
              <button onClick={() => setShowBillModal(false)} style={{ background: "none", border: "none", color: theme.textSecondary, fontSize: "20px", cursor: "pointer" }}>✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>WhatsApp Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                  />
                </div>
              </div>

              {/* Items Auto Fill */}
              <div>
                <label style={labelStyle}>Line Items (Select service to auto-fill rate)</label>
                {billItems.map((item, index) => (
                  <div key={index} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                    <input
                      list={`srv-list-${index}`}
                      type="text"
                      placeholder="Type or select service..."
                      value={item.name}
                      onChange={(e) => handleSelectServiceForItem(index, e.target.value)}
                      style={{ ...inputStyle, flex: 2, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      required
                    />
                    <datalist id={`srv-list-${index}`}>
                      {services.map((s) => (
                        <option key={s.id} value={s.name}>
                          ₹{s.default_rate}
                        </option>
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
                      style={{ ...inputStyle, flex: 0.7, textAlign: "center", backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    />
                    <input
                      type="number"
                      placeholder="Rate (₹)"
                      min="0"
                      value={item.rate || ""}
                      onChange={(e) => {
                        const n = [...billItems];
                        n[index].rate = Number(e.target.value);
                        setBillItems(n);
                      }}
                      style={{ ...inputStyle, flex: 1, textAlign: "right", backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      required
                    />
                    {billItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBillItems(billItems.filter((_, i) => i !== index))}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: "16px", cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setBillItems([...billItems, { name: "", qty: 1, rate: 0 }])}
                  style={{ background: "none", border: "none", color: "#4f46e5", fontWeight: "600", fontSize: "13px", cursor: "pointer", padding: "4px 0" }}
                >
                  + Add Item
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: `1px solid ${theme.cardBorder}`, paddingTop: "12px" }}>
                <div>
                  <label style={labelStyle}>Payment Status</label>
                  <select
                    value={initialPaymentStatus}
                    onChange={(e) => setInitialPaymentStatus(e.target.value as any)}
                    style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                  >
                    <option value="paid">✅ Paid (Settled)</option>
                    <option value="pending">⏳ Pending (Due / Credit)</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Applicable Tax</label>
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    style={{ ...inputStyle, backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                  >
                    <option value={0}>0% Tax</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: theme.navHover, padding: "12px", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "16px", fontWeight: "700" }}>
                <span>Grand Total:</span>
                <span style={{ color: "#4f46e5" }}>₹{grandTotal.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={savingBill}
                style={{ backgroundColor: "#4f46e5", color: "#fff", border: "none", padding: "12px", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}
              >
                {savingBill ? "Processing Invoice..." : `Generate & Save (₹${grandTotal.toFixed(2)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL (CLEAN PDF TEMPLATE) */}
      {printingInvoice && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ backgroundColor: "#ffffff", color: "#000000", width: "100%", maxWidth: "720px", borderRadius: "12px", padding: "28px", maxHeight: "95vh", overflowY: "auto", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}>
            {/* Modal Controls (Not Printed) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <button
                onClick={triggerCleanPrint}
                style={{
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  border: "none",
                  padding: "9px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "14px",
                }}
              >
                🖨️ Print / Save as PDF
              </button>
              <button
                onClick={() => setPrintingInvoice(null)}
                style={{ background: "none", border: "none", fontSize: "20px", color: "#64748b", cursor: "pointer", fontWeight: "bold" }}
              >
                ✕ Close
              </button>
            </div>

            {/* Clean Invoice Printable Container */}
            <div id="clean-invoice-print-area">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #e2e8f0", paddingBottom: "16px" }}>
                <div>
                  {company?.logo_url && (
                    <img src={company.logo_url} alt="Logo" style={{ height: "52px", objectFit: "contain", marginBottom: "8px", display: "block" }} />
                  )}
                  <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{company?.name}</h2>
                  {company?.business_address && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#475569" }}>{company.business_address}</p>}
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#475569" }}>
                    {company?.phone && <span>Mobile: <b>{company.phone}</b></span>}
                    {company?.phone && company?.email && <span> | </span>}
                    {company?.email && <span>Email: <b>{company.email}</b></span>}
                  </p>
                  {company?.gstin && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#475569" }}>GSTIN: <b>{company.gstin}</b></p>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <h3 style={{ margin: 0, fontSize: "20px", color: "#4f46e5", letterSpacing: "1px" }}>TAX INVOICE</h3>
                  <div style={{ fontSize: "13px", marginTop: "6px", color: "#1e293b" }}><b>Invoice #:</b> {printingInvoice.invoice_number}</div>
                  <div style={{ fontSize: "13px", color: "#1e293b" }}><b>Date:</b> {new Date(printingInvoice.created_at).toLocaleDateString("en-IN")}</div>
                  <div style={{ marginTop: "8px" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "bold", backgroundColor: printingInvoice.payment_status === "paid" ? "#dcfce7" : "#fee2e2", color: printingInvoice.payment_status === "paid" ? "#15803d" : "#b91c1c", display: "inline-block" }}>
                      STATUS: {printingInvoice.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ margin: "18px 0", fontSize: "14px" }}>
                <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.5px" }}>Billed To:</div>
                <div style={{ fontSize: "17px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{printingInvoice.customer_name}</div>
                {printingInvoice.customer_phone && <div style={{ color: "#475569", fontSize: "13px", marginTop: "2px" }}>Phone: {printingInvoice.customer_phone}</div>}
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", margin: "18px 0" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #0f172a", fontSize: "12px", textTransform: "uppercase", color: "#334155" }}>
                    <th style={{ textAlign: "left", padding: "8px 0" }}>Description</th>
                    <th style={{ textAlign: "center", padding: "8px 0", width: "70px" }}>Qty</th>
                    <th style={{ textAlign: "right", padding: "8px 0", width: "110px" }}>Rate</th>
                    <th style={{ textAlign: "right", padding: "8px 0", width: "120px" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printingInvoice.items && printingInvoice.items.length > 0 ? (
                    printingInvoice.items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                        <td style={{ padding: "10px 0", color: "#1e293b" }}>{it.name}</td>
                        <td style={{ textAlign: "center", padding: "10px 0", color: "#475569" }}>{it.qty}</td>
                        <td style={{ textAlign: "right", padding: "10px 0", color: "#475569" }}>₹{Number(it.rate).toFixed(2)}</td>
                        <td style={{ textAlign: "right", padding: "10px 0", fontWeight: "600", color: "#0f172a" }}>₹{(it.qty * it.rate).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr style={{ borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
                      <td style={{ padding: "10px 0" }}>Products / Services Rendered</td>
                      <td style={{ textAlign: "center", padding: "10px 0" }}>1</td>
                      <td style={{ textAlign: "right", padding: "10px 0" }}>₹{printingInvoice.total_amount}</td>
                      <td style={{ textAlign: "right", padding: "10px 0", fontWeight: "600" }}>₹{printingInvoice.total_amount}</td>
                    </tr>
                  )}
                  <tr style={{ borderTop: "2px solid #0f172a", fontWeight: "700", fontSize: "16px" }}>
                    <td colSpan={3} style={{ padding: "14px 0", textAlign: "right", color: "#0f172a" }}>Grand Total:</td>
                    <td style={{ padding: "14px 0", textAlign: "right", color: "#4f46e5", fontSize: "18px" }}>
                      ₹{Number(printingInvoice.total_amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px dashed #cbd5e1", paddingTop: "16px", marginTop: "24px" }}>
                <div style={{ fontSize: "12px", color: "#334155", lineHeight: "1.6" }}>
                  <div style={{ fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>Bank & Payment Information:</div>
                  {company?.bank_name && <div>Bank: <b>{company.bank_name}</b></div>}
                  {company?.account_number && <div>Account No: <b>{company.account_number}</b></div>}
                  {company?.ifsc_code && <div>IFSC Code: <b>{company.ifsc_code}</b></div>}
                  {company?.upi_id && <div>UPI ID: <b>{company.upi_id}</b></div>}
                </div>

                {company?.upi_id && (
                  <div style={{ textAlign: "center" }}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                        `upi://pay?pa=${company.upi_id}&pn=${company.name}&am=${printingInvoice.total_amount}&cu=INR`
                      )}`}
                      alt="UPI QR"
                      style={{ width: "95px", height: "95px", border: "1px solid #e2e8f0", padding: "4px", borderRadius: "8px", display: "block", margin: "0 auto" }}
                    />
                    <div style={{ fontSize: "10px", color: "#64748b", marginTop: "3px", fontWeight: "500" }}>Scan & Pay via UPI</div>
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
    return <div style={{ textAlign: "center", padding: "32px", color: theme.textSecondary, fontSize: "14px" }}>No invoice records available.</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.cardBorder}`, color: theme.textSecondary, textTransform: "uppercase", fontSize: "11px" }}>
            <th style={{ padding: "10px" }}>Invoice #</th>
            <th style={{ padding: "10px" }}>Customer</th>
            <th style={{ padding: "10px" }}>Phone</th>
            <th style={{ padding: "10px" }}>Date</th>
            <th style={{ padding: "10px" }}>Amount</th>
            <th style={{ padding: "10px" }}>Status</th>
            <th style={{ padding: "10px", textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
              <td style={{ padding: "12px 10px", fontFamily: "monospace", fontWeight: "600" }}>{inv.invoice_number}</td>
              <td style={{ padding: "12px 10px", fontWeight: "600" }}>{inv.customer_name}</td>
              <td style={{ padding: "12px 10px", color: theme.textSecondary }}>{inv.customer_phone || "-"}</td>
              <td style={{ padding: "12px 10px", color: theme.textSecondary }}>{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
              <td style={{ padding: "12px 10px", fontWeight: "700" }}>₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
              <td style={{ padding: "12px 10px" }}>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: "700",
                    backgroundColor: inv.payment_status === "paid" ? "#dcfce7" : "#fee2e2",
                    color: inv.payment_status === "paid" ? "#15803d" : "#b91c1c",
                  }}
                >
                  {inv.payment_status.toUpperCase()}
                </span>
              </td>
              <td style={{ padding: "12px 10px", textAlign: "right" }}>
                {showStatusToggleAction && (
                  <button
                    onClick={() => onToggleStatus(inv.id, inv.payment_status)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "11px",
                      fontWeight: "700",
                      marginRight: "6px",
                      cursor: "pointer",
                      backgroundColor: inv.payment_status === "paid" ? "#f1f5f9" : "#22c55e",
                      color: inv.payment_status === "paid" ? "#475569" : "#ffffff",
                    }}
                  >
                    {inv.payment_status === "paid" ? "Mark Due" : "Mark Paid"}
                  </button>
                )}
                <button
                  onClick={() => onWhatsApp(inv)}
                  style={{ backgroundColor: "#22c55e", color: "#fff", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", marginRight: "6px" }}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => onPrint(inv)}
                  style={{ backgroundColor: theme.navHover, color: theme.text, border: `1px solid ${theme.cardBorder}`, padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", cursor: "pointer", marginRight: "6px" }}
                >
                  Print
                </button>
                <button
                  onClick={() => onDeleteInvoice(inv.id, inv.invoice_number)}
                  style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "none", padding: "5px 10px", borderRadius: "6px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "600", marginBottom: "5px" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid", fontSize: "13px", boxSizing: "border-box" };