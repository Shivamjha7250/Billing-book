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
      <div className="min-h-screen flex items-center justify-center font-sans">
        Loading Workspace...
      </div>
    );
  }

  return (
    <div
      style={{ backgroundColor: theme.bg, color: theme.text }}
      className="min-h-screen flex flex-col md:flex-row font-sans overflow-x-hidden"
    >
      {/* MOBILE TOP NAVBAR */}
      <div
        style={{ backgroundColor: theme.sidebar, borderColor: theme.cardBorder }}
        className="md:hidden flex items-center justify-between p-4 border-b sticky top-0 z-40"
      >
        <div className="flex items-center gap-2">
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" className="w-8 h-8 rounded object-contain" />
          ) : (
            <div className="w-8 h-8 rounded bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              {company?.name?.slice(0, 1) || "J"}
            </div>
          )}
          <span className="font-bold text-base truncate max-w-[170px]">{company?.name || "Workspace"}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowBillModal(true)}
            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold"
          >
            + Bill
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ backgroundColor: theme.navHover }}
            className="p-2 rounded-lg text-sm border"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* SIDEBAR (Desktop Fixed, Mobile Drawer) */}
      <aside
        style={{ backgroundColor: theme.sidebar, borderColor: theme.cardBorder }}
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 border-r flex flex-col p-4 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-2.5">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-9 h-9 rounded-lg object-contain border" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                {company?.name?.slice(0, 1) || "J"}
              </div>
            )}
            <div className="overflow-hidden">
              <div className="font-bold text-sm truncate">{company?.name || "Workspace"}</div>
              <div style={{ color: theme.textSecondary }} className="text-[11px]">Billing Suite</div>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-lg p-1">
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex flex-col gap-1.5 flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id as any);
                setSelectedCustomer(null);
                setMobileMenuOpen(false);
              }}
              style={{
                backgroundColor: activeTab === item.id ? "#4f46e5" : "transparent",
                color: activeTab === item.id ? "#ffffff" : theme.textSecondary,
              }}
              className="text-left py-2.5 px-3.5 rounded-lg text-sm font-semibold transition"
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Controls */}
        <div style={{ borderColor: theme.cardBorder }} className="flex flex-col gap-2 border-t pt-4 mt-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{ borderColor: theme.cardBorder }}
            className="p-2.5 rounded-lg border text-xs font-semibold text-center"
          >
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
          <button
            onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/"))}
            className="p-2.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold text-center"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
        />
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* DESKTOP HEADER */}
        <header
          style={{ backgroundColor: theme.sidebar, borderColor: theme.cardBorder }}
          className="hidden md:flex h-16 border-b items-center justify-between px-8"
        >
          <div style={{ color: theme.textSecondary }} className="text-sm">
            Account: <b style={{ color: theme.text }}>{user?.email}</b>
          </div>
          <button
            onClick={() => setShowBillModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition"
          >
            + Create Invoice
          </button>
        </header>

        <main className="p-4 sm:p-6 md:p-8 flex flex-col gap-6 max-w-full">
          {/* TAB: DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border p-4 rounded-xl">
                  <div style={{ color: theme.textSecondary }} className="text-[11px] font-bold">TOTAL REVENUE</div>
                  <div className="text-lg sm:text-2xl font-extrabold mt-1">₹{totalSales.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border p-4 rounded-xl">
                  <div className="text-[11px] font-bold text-emerald-600">PAID COLLECTED</div>
                  <div className="text-lg sm:text-2xl font-extrabold text-emerald-600 mt-1">₹{totalReceived.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border p-4 rounded-xl">
                  <div className="text-[11px] font-bold text-red-600">DUE OUTSTANDING</div>
                  <div className="text-lg sm:text-2xl font-extrabold text-red-600 mt-1">₹{totalPending.toLocaleString("en-IN")}</div>
                </div>
                <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border p-4 rounded-xl">
                  <div style={{ color: theme.textSecondary }} className="text-[11px] font-bold">ACTIVE CLIENTS</div>
                  <div className="text-lg sm:text-2xl font-extrabold text-indigo-600 mt-1">{customersList.length}</div>
                </div>
              </div>

              <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold mb-4">Recent Invoices</h3>
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
            <div className="flex flex-col gap-6">
              <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold">Customer Directory</h3>
                    <p style={{ color: theme.textSecondary }} className="text-xs mt-0.5">
                      Contacts, bills count aur transactions ledger.
                    </p>
                  </div>
                  <div className="w-full sm:w-72">
                    <input
                      type="text"
                      placeholder="🔍 Search name or mobile..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                </div>

                {customersList.length === 0 ? (
                  <div style={{ color: theme.textSecondary }} className="text-center py-8 text-sm">
                    No matching customer records found.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                      <thead>
                        <tr style={{ borderColor: theme.cardBorder, color: theme.textSecondary }} className="border-b text-[11px] uppercase">
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Mobile</th>
                          <th className="p-2.5">Bills</th>
                          <th className="p-2.5">Total Spend</th>
                          <th className="p-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customersList.map((c, idx) => (
                          <tr key={idx} style={{ borderColor: theme.cardBorder }} className="border-b">
                            <td className="p-2.5 font-semibold">{c.name}</td>
                            <td style={{ color: theme.textSecondary }} className="p-2.5">{c.phone}</td>
                            <td className="p-2.5 font-bold">{c.totalBills} Bills</td>
                            <td className="p-2.5 font-bold text-emerald-600">₹{c.totalAmount.toLocaleString("en-IN")}</td>
                            <td className="p-2.5 text-right">
                              <button
                                onClick={() => setSelectedCustomer(c.name)}
                                className="bg-indigo-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded"
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
                <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-sm sm:text-base font-bold">
                      Invoices for: <span className="text-indigo-600">{selectedCustomer}</span>
                    </h4>
                    <button onClick={() => setSelectedCustomer(null)} className="text-red-500 font-bold text-xs">
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
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
              <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
                <h3 className="text-base font-bold mb-1">
                  {editingServiceId ? "✏️ Edit Service" : "+ Add New Service"}
                </h3>
                <p style={{ color: theme.textSecondary }} className="text-xs mb-4">
                  Default price rate set karke quick billing auto-fill karein.
                </p>

                <form onSubmit={handleSaveService} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Service / Item Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Website Design"
                      required
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Default Rate (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      required
                      value={newServiceRate}
                      onChange={(e) => setNewServiceRate(e.target.value === "" ? "" : Number(e.target.value))}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="submit"
                      disabled={savingService}
                      className={`flex-1 py-2.5 rounded-lg text-white font-bold text-xs transition ${
                        editingServiceId ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {savingService ? "Saving..." : editingServiceId ? "Update" : "Save Service"}
                    </button>
                    {editingServiceId && (
                      <button
                        type="button"
                        onClick={handleCancelEditService}
                        className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
                <h3 className="text-base font-bold mb-4">Saved Catalog ({services.length})</h3>
                {services.length === 0 ? (
                  <div style={{ color: theme.textSecondary }} className="text-center py-8 text-xs">
                    No services in catalog. Add one from the form.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse min-w-[320px]">
                      <thead>
                        <tr style={{ borderColor: theme.cardBorder, color: theme.textSecondary }} className="border-b text-[11px] uppercase">
                          <th className="p-2">Name</th>
                          <th className="p-2">Rate</th>
                          <th className="p-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((srv) => (
                          <tr key={srv.id} style={{ borderColor: theme.cardBorder }} className="border-b">
                            <td className="p-2 font-semibold">{srv.name}</td>
                            <td className="p-2 font-bold text-emerald-600">₹{Number(srv.default_rate).toLocaleString("en-IN")}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleStartEditService(srv)}
                                className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px] font-bold mr-1.5"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteService(srv.id)}
                                className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold"
                              >
                                Delete
                              </button>
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
            <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-5">
                <div>
                  <h3 className="text-base sm:text-lg font-bold">Payments & Udhaar Tracker</h3>
                  <p style={{ color: theme.textSecondary }} className="text-xs mt-0.5">
                    Ek click par Paid ya Due status update karein.
                  </p>
                </div>
                <div className="bg-red-100 text-red-800 px-3.5 py-1.5 rounded-lg font-bold text-xs sm:text-sm self-start sm:self-auto">
                  Total Outstanding: ₹{totalPending.toLocaleString("en-IN")}
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
            <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold">Sales & Financial Analytics</h3>
                  <p style={{ color: theme.textSecondary }} className="text-xs mt-0.5">
                    Filter by timeline to track performance.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["daily", "weekly", "monthly", "3m", "6m", "9m", "12m"] as const).map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setReportDuration(dur)}
                      style={{
                        backgroundColor: reportDuration === dur ? "#4f46e5" : theme.navHover,
                        color: reportDuration === dur ? "#fff" : theme.textSecondary,
                      }}
                      className="px-2.5 py-1 rounded text-[11px] font-bold uppercase transition"
                    >
                      {dur}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div style={{ backgroundColor: theme.navHover }} className="p-3.5 rounded-xl">
                  <div style={{ color: theme.textSecondary }} className="text-[11px]">Period Invoices</div>
                  <div className="text-xl font-bold mt-1">{filteredReportInvoices.length}</div>
                </div>
                <div style={{ backgroundColor: theme.navHover }} className="p-3.5 rounded-xl">
                  <div className="text-[11px] text-emerald-600">Collected</div>
                  <div className="text-xl font-bold text-emerald-600 mt-1">
                    ₹{filteredReportInvoices.filter((i) => i.payment_status === "paid").reduce((s, c) => s + Number(c.total_amount), 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div style={{ backgroundColor: theme.navHover }} className="p-3.5 rounded-xl">
                  <div className="text-[11px] text-red-600">Pending</div>
                  <div className="text-xl font-bold text-red-600 mt-1">
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
            <div style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }} className="border rounded-2xl p-4 sm:p-6 max-w-3xl">
              <h3 className="text-base sm:text-lg font-bold mb-1">Company & Payment Settings</h3>
              <p style={{ color: theme.textSecondary }} className="text-xs mb-5">
                Aapki details bill print aur UPI QR code par automatically update hongi.
              </p>

              <form onSubmit={handleSaveSettings} className="flex flex-col gap-4">
                {/* Logo file */}
                <div style={{ borderColor: theme.cardBorder, backgroundColor: theme.navHover }} className="p-3.5 rounded-xl border border-dashed flex items-center gap-3.5">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Preview" className="w-14 h-14 rounded-lg object-contain bg-white border" />
                  ) : (
                    <div style={{ color: theme.textSecondary }} className="w-14 h-14 rounded-lg border border-dashed flex items-center justify-center text-[10px] text-center">
                      No Logo
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="block text-xs font-bold mb-1">Business Logo</label>
                    <input type="file" accept="image/*" onChange={handleLocalLogoUpload} className="text-xs w-full" />
                  </div>
                  {logoUrl && (
                    <button type="button" onClick={() => setLogoUrl("")} className="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">
                      Remove
                    </button>
                  )}
                </div>

                {/* Company details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Company / Shop Name *</label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Contact Phone *</label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="business@gmail.com"
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold mb-1">GSTIN (Optional)</label>
                    <input
                      type="text"
                      placeholder="27AAAAA0000A1Z5"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold mb-1">Physical Store Address</label>
                  <textarea
                    rows={2}
                    placeholder="Shop No, Road, City, PIN..."
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    className="w-full p-2.5 rounded-lg border text-xs"
                  />
                </div>

                {/* Bank & Payment */}
                <div style={{ borderColor: theme.cardBorder }} className="border-t pt-3.5">
                  <h4 className="text-xs sm:text-sm font-bold mb-3">Bank & UPI Settlement (Prints on Invoice)</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Bank Name</label>
                      <input
                        type="text"
                        placeholder="HDFC Bank"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                        className="w-full p-2.5 rounded-lg border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">Account Number</label>
                      <input
                        type="text"
                        placeholder="501002345678"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                        className="w-full p-2.5 rounded-lg border text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="HDFC0001234"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                        className="w-full p-2.5 rounded-lg border text-xs"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[11px] font-bold mb-1">UPI ID / VPA (For Dynamic QR)</label>
                    <input
                      type="text"
                      placeholder="payments@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-full p-2.5 rounded-lg border text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full sm:w-auto self-start mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition"
                >
                  {savingSettings ? "Saving Settings..." : "Save Settings"}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* CREATE BILL MODAL */}
      {showBillModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div
            style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, color: theme.text }}
            className="w-full max-w-lg rounded-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto border shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">Generate New Invoice</h3>
              <button onClick={() => setShowBillModal(false)} className="text-slate-400 text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Customer Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    className="w-full p-2.5 rounded-lg border text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">WhatsApp Phone</label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    className="w-full p-2.5 rounded-lg border text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold mb-1">Items (Select to Auto-fill Rate)</label>
                {billItems.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2 items-center">
                    <input
                      list={`srv-list-${index}`}
                      type="text"
                      placeholder="Item name..."
                      value={item.name}
                      onChange={(e) => handleSelectServiceForItem(index, e.target.value)}
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="flex-[2] p-2 rounded-lg border text-xs"
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
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-14 p-2 text-center rounded-lg border text-xs"
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
                      style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                      className="w-20 p-2 text-right rounded-lg border text-xs"
                      required
                    />
                    {billItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBillItems(billItems.filter((_, i) => i !== index))}
                        className="text-red-500 font-bold p-1 text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setBillItems([...billItems, { name: "", qty: 1, rate: 0 }])}
                  className="text-indigo-600 font-bold text-xs mt-1"
                >
                  + Add Item
                </button>
              </div>

              <div style={{ borderColor: theme.cardBorder }} className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1">Status</label>
                  <select
                    value={initialPaymentStatus}
                    onChange={(e) => setInitialPaymentStatus(e.target.value as any)}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    className="w-full p-2 rounded-lg border text-xs"
                  >
                    <option value="paid">✅ Paid</option>
                    <option value="pending">⏳ Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1">Tax / GST</label>
                  <select
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    style={{ backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }}
                    className="w-full p-2 rounded-lg border text-xs"
                  >
                    <option value={0}>0% Tax</option>
                    <option value={5}>5% GST</option>
                    <option value={12}>12% GST</option>
                    <option value={18}>18% GST</option>
                  </select>
                </div>
              </div>

              <div style={{ backgroundColor: theme.navHover }} className="p-3 rounded-lg flex justify-between items-center text-sm font-bold">
                <span>Total Amount:</span>
                <span className="text-indigo-600 text-base">₹{grandTotal.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={savingBill}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition disabled:opacity-50"
              >
                {savingBill ? "Processing..." : `Generate Bill (₹${grandTotal.toFixed(2)})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {printingInvoice && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white text-black w-full max-w-2xl rounded-2xl p-4 sm:p-7 max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <button
                onClick={triggerCleanPrint}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                🖨️ Print / Save as PDF
              </button>
              <button onClick={() => setPrintingInvoice(null)} className="text-slate-500 font-bold text-lg">
                ✕
              </button>
            </div>

            {/* Printable Container */}
            <div id="clean-invoice-print-area">
              <div className="flex justify-between items-start border-b-2 border-slate-200 pb-4">
                <div>
                  {company?.logo_url && (
                    <img src={company.logo_url} alt="Logo" className="h-10 object-contain mb-2 block" />
                  )}
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{company?.name}</h2>
                  {company?.business_address && <p className="text-[11px] text-slate-600 mt-1">{company.business_address}</p>}
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {company?.phone && <span>Mobile: <b>{company.phone}</b></span>}
                    {company?.phone && company?.email && <span> | </span>}
                    {company?.email && <span>Email: <b>{company.email}</b></span>}
                  </p>
                  {company?.gstin && <p className="text-[11px] text-slate-600 mt-0.5">GSTIN: <b>{company.gstin}</b></p>}
                </div>
                <div className="text-right">
                  <h3 className="text-base sm:text-lg font-black text-indigo-600">TAX INVOICE</h3>
                  <div className="text-xs font-semibold mt-1 text-slate-800">#{printingInvoice.invoice_number}</div>
                  <div className="text-[11px] text-slate-600">{new Date(printingInvoice.created_at).toLocaleDateString("en-IN")}</div>
                  <div className="mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      printingInvoice.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}>
                      {printingInvoice.payment_status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-3.5 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400">Billed To:</div>
                <div className="text-sm font-bold text-slate-900">{printingInvoice.customer_name}</div>
                {printingInvoice.customer_phone && <div className="text-slate-600">Phone: {printingInvoice.customer_phone}</div>}
              </div>

              <table className="w-full border-collapse my-3 text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-slate-700 uppercase text-[10px]">
                    <th className="text-left py-1.5">Description</th>
                    <th className="text-center py-1.5 w-12">Qty</th>
                    <th className="text-right py-1.5 w-20">Rate</th>
                    <th className="text-right py-1.5 w-20">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {printingInvoice.items && printingInvoice.items.length > 0 ? (
                    printingInvoice.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        <td className="py-2">{it.name}</td>
                        <td className="text-center py-2 text-slate-600">{it.qty}</td>
                        <td className="text-right py-2 text-slate-600">₹{Number(it.rate).toFixed(2)}</td>
                        <td className="text-right py-2 font-bold text-slate-900">₹{(it.qty * it.rate).toFixed(2)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-100">
                      <td className="py-2">Item</td>
                      <td className="text-center py-2">1</td>
                      <td className="text-right py-2">₹{printingInvoice.total_amount}</td>
                      <td className="text-right py-2 font-bold">₹{printingInvoice.total_amount}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-900 font-bold">
                    <td colSpan={3} className="py-2.5 text-right text-slate-900">Total:</td>
                    <td className="py-2.5 text-right text-indigo-600 text-sm">
                      ₹{Number(printingInvoice.total_amount).toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between items-end border-t border-dashed border-slate-300 pt-3 mt-4">
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <div className="font-bold text-slate-900">Bank Details:</div>
                  {company?.bank_name && <div>Bank: <b>{company.bank_name}</b></div>}
                  {company?.account_number && <div>A/c: <b>{company.account_number}</b></div>}
                  {company?.ifsc_code && <div>IFSC: <b>{company.ifsc_code}</b></div>}
                  {company?.upi_id && <div>UPI: <b>{company.upi_id}</b></div>}
                </div>

                {company?.upi_id && (
                  <div className="text-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(
                        `upi://pay?pa=${company.upi_id}&pn=${company.name}&am=${printingInvoice.total_amount}&cu=INR`
                      )}`}
                      alt="UPI QR"
                      className="w-20 h-20 border p-1 rounded-lg mx-auto"
                    />
                    <div className="text-[9px] text-slate-500 mt-1 font-semibold">Scan & Pay</div>
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
    return <div style={{ color: theme.textSecondary }} className="text-center py-8 text-xs">No invoice records available.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse min-w-[540px]">
        <thead>
          <tr style={{ borderColor: theme.cardBorder, color: theme.textSecondary }} className="border-b text-[11px] uppercase">
            <th className="p-2.5">Invoice #</th>
            <th className="p-2.5">Customer</th>
            <th className="p-2.5">Date</th>
            <th className="p-2.5">Amount</th>
            <th className="p-2.5">Status</th>
            <th className="p-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr key={inv.id} style={{ borderColor: theme.cardBorder }} className="border-b">
              <td className="p-2.5 font-mono font-bold">{inv.invoice_number}</td>
              <td className="p-2.5">
                <div className="font-semibold">{inv.customer_name}</div>
                {inv.customer_phone && <div style={{ color: theme.textSecondary }} className="text-[10px]">{inv.customer_phone}</div>}
              </td>
              <td style={{ color: theme.textSecondary }} className="p-2.5">{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
              <td className="p-2.5 font-bold">₹{Number(inv.total_amount).toLocaleString("en-IN")}</td>
              <td className="p-2.5">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    inv.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {inv.payment_status.toUpperCase()}
                </span>
              </td>
              <td className="p-2.5 text-right">
                <div className="inline-flex gap-1 flex-wrap justify-end">
                  {showStatusToggleAction && (
                    <button
                      onClick={() => onToggleStatus(inv.id, inv.payment_status)}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        inv.payment_status === "paid" ? "bg-slate-100 text-slate-700" : "bg-emerald-500 text-white"
                      }`}
                    >
                      {inv.payment_status === "paid" ? "Due" : "Paid"}
                    </button>
                  )}
                  <button
                    onClick={() => onWhatsApp(inv)}
                    className="bg-emerald-500 text-white px-2 py-1 rounded text-[10px] font-bold"
                  >
                    WA
                  </button>
                  <button
                    onClick={() => onPrint(inv)}
                    style={{ backgroundColor: theme.navHover, borderColor: theme.cardBorder }}
                    className="border px-2 py-1 rounded text-[10px] font-bold"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => onDeleteInvoice(inv.id, inv.invoice_number)}
                    className="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-bold"
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