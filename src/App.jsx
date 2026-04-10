import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Receipt,
  CheckCircle,
  Utensils,
  Coffee,
  Package,
  LayoutDashboard,
  Settings,
  LogOut,
  User,
  Edit3,
  X,
  TrendingUp,
  Users,
  Menu,
  ChevronLeft,
  AlertCircle,
} from "lucide-react";
import Swal from "sweetalert2";

// ==========================================
// --- FIREBASE CONFIGURATION ---
// ==========================================
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  runTransaction,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDUlxpxLZ1Dcc3GmGP6utDSMkK7W3y0A2I",
  authDomain: "larismanis88-4a809.firebaseapp.com",
  projectId: "larismanis88-4a809",
  storageBucket: "larismanis88-4a809.firebasestorage.app",
  messagingSenderId: "338939086902",
  appId: "1:338939086902:web:ea943aed88abc506af7097",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const myAppId = "larismanis88";

export default function App() {
  const [view, setView] = useState(localStorage.getItem("isLoggedIn") === "true" ? "pos" : "login");
  const [products, setProducts] = useState([]);
  const [salesHistory, setSalesHistory] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);


  const handleResetAll = async () => {
    if (!user) return;

    const result = await Swal.fire({
      title: 'Yakin mau hapus SEMUA data?',
      text: "Data yang dihapus tidak bisa dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Reset!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    const salesRef = collection(
      db,
      "artifacts",
      myAppId,
      "users",
      user.uid,
      "sales",
    );

    const snapshot = await getDocs(salesRef);

    for (const docItem of snapshot.docs) {
      await deleteDoc(docItem.ref);
    }

    try {
      // 🔥 Reset Google Sheets
      fetch(
        "https://script.google.com/macros/s/AKfycbyXQiPcSLpP8O1OO7FksUOnbBhIs3JYwsa9e8wA-GkeZlBa1fG-tSWA7KvlBSol4Vwyzw/exec",
        {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify({
            action: "reset",
          }),
        },
      ).catch(console.error);
      Swal.fire("Berhasil", "Semua data berhasil direset!", "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal", "Semua data gagal direset!", "error");
    }
  };
  const handleDeleteTransaction = async (order) => {
    if (!user) return;

    const result = await Swal.fire({
      title: 'Hapus transaksi ini?',
      text: "Transaksi akan dihapus permanen dari sistem!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (!result.isConfirmed) return;

    try {
      // 🔥 Hapus dari Firestore
      await deleteDoc(
        doc(db, "artifacts", myAppId, "users", user.uid, "sales", order.id),
      );

      // 🔥 Hapus dari Google Sheets
      fetch(
        "https://script.google.com/macros/s/AKfycbyXQiPcSLpP8O1OO7FksUOnbBhIs3JYwsa9e8wA-GkeZlBa1fG-tSWA7KvlBSol4Vwyzw/exec",
        {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify({
            action: "delete",
            receiptNumber: order.receiptNumber,
          }),
        },
      ).catch(console.error);

      Swal.fire("Berhasil", "Transaksi berhasil dihapus!", "success");
    } catch (error) {
      console.error(error);
      Swal.fire("Gagal", "Gagal menghapus data transaksi!", "error");
    }
  };
  const formatRupiah = (angka) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
    }).format(angka || 0);
  };

  // --- 1. LOGIN ANONIM (Supaya bisa baca Database Firestore) ---
  useEffect(() => {
    signInAnonymously(auth).catch((e) => console.error("Firebase Error:", e));
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. LOGIKA LOGIN MANUAL CEK DATABASE ---
  const handleManualLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const usernameInput = e.target[0].value;
    const passwordInput = e.target[1].value;

    try {
      const usersRef = collection(db, "artifacts", myAppId, "admin_accounts");
      const q = query(
        usersRef,
        where("username", "==", usernameInput),
        where("password", "==", passwordInput),
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        localStorage.setItem("isLoggedIn", "true");
        setView("pos"); // Berhasil masuk
      } else {
        alert("Username atau Password salah!");
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi gangguan koneksi ke database.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. SYNC DATA PRODUK & SALES ---
  useEffect(() => {
    if (!user) return;
    const productsRef = collection(
      db,
      "artifacts",
      myAppId,
      "users",
      user.uid,
      "products",
    );
    const salesRef = collection(
      db,
      "artifacts",
      myAppId,
      "users",
      user.uid,
      "sales",
    );

    const unsubProducts = onSnapshot(productsRef, (snap) => {
      if (snap.empty) {
        // Jika kosong, masukkan menu awal (opsional)
        const initial = [
          {
            id: 1,
            name: "Es Ubi Ungu",
            price: 15000,
            image:
              "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=500",
            color: "bg-purple-100",
            iconType: "coffee",
          },
          {
            id: 2,
            name: "Gyoza (Isi 5)",
            price: 20000,
            image:
              "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?auto=format&fit=crop&q=80&w=500",
            color: "bg-orange-100",
            iconType: "utensils",
          },
          {
            id: 3,
            name: "Paket Bundling (Es + Gyoza)",
            price: 30000,
            image:
              "https://images.unsplash.com/photo-1615865417482-ea88db44a302?auto=format&fit=crop&q=80&w=500",
            color: "bg-green-100",
            iconType: "package",
          },
        ];
        initial.forEach((p) => setDoc(doc(productsRef, p.id.toString()), p));
      } else {
        const loaded = [];
        snap.forEach((doc) =>
          loaded.push({ ...doc.data(), id: parseInt(doc.id) }),
        );
        setProducts(loaded.sort((a, b) => a.id - b.id));
      }
    });

    const unsubSales = onSnapshot(salesRef, (snap) => {
      const loaded = [];
      snap.forEach((doc) => loaded.push({ ...doc.data(), id: doc.id }));
      setSalesHistory(loaded.sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => {
      unsubProducts();
      unsubSales();
    };
  }, [user]);

  // --- 4. LANJUTAN FUNGSI (Sama seperti sebelumnya) ---
  const handleUpdateProduct = async (updatedProduct) => {
    if (!user) return;
    await updateDoc(
      doc(
        db,
        "artifacts",
        myAppId,
        "users",
        user.uid,
        "products",
        updatedProduct.id.toString(),
      ),
      updatedProduct,
    );
  };

  const handleAddProduct = async (newProduct) => {
    if (!user) return;
    const newId = Date.now();
    await setDoc(
      doc(db, "artifacts", myAppId, "users", user.uid, "products", newId.toString()),
      { ...newProduct, id: newId }
    );
  };

  const handleDeleteProduct = async (productId) => {
    if (!user) return;
    const confirmDelete = await Swal.fire({
      title: 'Hapus menu ini?',
      text: "Tindakan ini tidak dapat dikembalikan!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Ya, Hapus!'
    });
    if (confirmDelete.isConfirmed) {
      await deleteDoc(
        doc(db, "artifacts", myAppId, "users", user.uid, "products", productId.toString())
      );
      Swal.fire("Dihapus!", "Menu berhasil dihapus.", "success");
    }
  };

  const handleCheckoutTransaction = async (orderData) => {
    if (!user) return;
    const systemRef = doc(
      db,
      "artifacts",
      myAppId,
      "users",
      user.uid,
      "system",
      "lock",
    );
    await runTransaction(db, async (transaction) => {
      const lockDoc = await transaction.get(systemRef);
      if (
        lockDoc.exists() &&
        lockDoc.data().isLocked &&
        Date.now() - lockDoc.data().timestamp < 15000
      )
        throw new Error("ANTRIAN");
      transaction.set(systemRef, { isLocked: true, timestamp: Date.now() });
    });
    try {
      await addDoc(
        collection(db, "artifacts", myAppId, "users", user.uid, "sales"),
        orderData,
      );
      fetch(
        "https://script.google.com/macros/s/AKfycbyXQiPcSLpP8O1OO7FksUOnbBhIs3JYwsa9e8wA-GkeZlBa1fG-tSWA7KvlBSol4Vwyzw/exec",
        {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify(orderData),
        },
      ).catch(console.error);
    } finally {
      await setDoc(systemRef, { isLocked: false, timestamp: Date.now() });
    }
  };

  // --- VIEW LOGIN ---
  if (view === "login") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <img
                src="/logo.svg"
                alt="Logo"
                className="w-10 h-10 object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              POS-LarisManis88
            </h1>
            <p className="text-gray-500">Input Username & Password</p>
          </div>
          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <input
                type="text"
                required
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:bg-gray-400"
            >
              {isLoading ? "Mengecek Database..." : "Masuk"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderIcon = (type, className) => {
    switch (type) {
      case "coffee":
        return <Coffee className={className || "w-6 h-6 text-purple-600"} />;
      case "utensils":
        return <Utensils className={className || "w-6 h-6 text-orange-600"} />;
      default:
        return <Package className={className || "w-6 h-6 text-green-600"} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 font-sans overflow-hidden">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div
        className={`bg-white border-r border-gray-200 flex flex-col justify-between transition-all duration-300 overflow-hidden whitespace-nowrap z-30 ${isSidebarOpen ? "w-64 fixed md:relative h-full shadow-2xl md:shadow-none" : "w-0"}`}
      >
        <div>
          <div className="p-6 flex items-center justify-between border-b border-gray-100">
            <h1 className="text-xl font-bold text-purple-600">LarisManis88</h1>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <nav className="p-4 space-y-2">
            <button
              onClick={() => setView("pos")}
              className={`w-full flex items-center gap-3 p-3 rounded-xl ${view === "pos" ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <ShoppingCart className="w-5 h-5 shrink-0" />
              <span>Kasir (POS)</span>
            </button>
            <button
              onClick={() => setView("dashboard")}
              className={`w-full flex items-center gap-3 p-3 rounded-xl ${view === "dashboard" ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutDashboard className="w-5 h-5 shrink-0" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setView("settings")}
              className={`w-full flex items-center gap-3 p-3 rounded-xl ${view === "settings" ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span>Atur Menu</span>
            </button>
          </nav>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => {
              localStorage.removeItem("isLoggedIn");
              setView("login");
            }}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-50 mt-auto"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {view === "pos" && (
          <POSView
            products={products}
            onTransactionComplete={handleCheckoutTransaction}
            formatRupiah={formatRupiah}
            renderIcon={renderIcon}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(true)}
          />
        )}
        {view === "dashboard" && (
          <DashboardView
            salesHistory={salesHistory}
            formatRupiah={formatRupiah}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(true)}
            handleDeleteTransaction={handleDeleteTransaction}
            handleResetAll={handleResetAll}
          />
        )}
        {view === "settings" && (
          <SettingsView
            products={products}
            handleUpdateProduct={handleUpdateProduct}
            handleAddProduct={handleAddProduct}
            handleDeleteProduct={handleDeleteProduct}
            formatRupiah={formatRupiah}
            renderIcon={renderIcon}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(true)}
          />
        )}
      </div>
    </div>
  );
}
// ==========================================
// 1. KOMPONEN KASIR (POS)
// ==========================================
function POSView({
  products,
  onTransactionComplete,
  formatRupiah,
  renderIcon,
  isSidebarOpen,
  toggleSidebar,
}) {
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [queueMessage, setQueueMessage] = useState("");
  const [amountPaid, setAmountPaid] = useState("");

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing)
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const decreaseQty = (productId) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (existing.qty === 1)
        return prev.filter((item) => item.id !== productId);
      return prev.map((item) =>
        item.id === productId ? { ...item, qty: item.qty - 1 } : item,
      );
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setReceiptNumber(`INV-${new Date().getTime().toString().slice(-6)}`);
    setIsInvoiceOpen(true);
    setOrderSuccess(false);
    setQueueMessage("");
  };

  const handleCompleteTransaction = async () => {
    const numericAmountPaid = parseInt(amountPaid) || 0;
    if (numericAmountPaid < total) {
      Swal.fire("Peringatan", "Uang yang dibayarkan kurang dari total belanja!", "warning");
      return;
    }

    setIsProcessing(true);
    setQueueMessage("");
    const dateNow = new Date().toLocaleString("id-ID");
    const orderData = {
      receiptNumber,
      date: dateNow,
      customer: customerName || "Pelanggan",
      items: cart.map((item) => `${item.name} (${item.qty}x)`).join("\n"),
      totalItems,
      total,
      rawItems: cart,
      timestamp: Date.now(),
    };

    try {
      await onTransactionComplete(orderData);
      
      const changeAmount = numericAmountPaid - total;

      await Swal.fire({
        title: "Pembayaran Berhasil!",
        text: `Kembalian: ${formatRupiah(changeAmount)}`,
        icon: "success",
        confirmButtonText: "Selesai"
      });

      setIsInvoiceOpen(false);
      setCart([]);
      setCustomerName("");
      setAmountPaid("");
      setOrderSuccess(false);

    } catch (error) {
      if (error.message === "ANTRIAN") {
        setQueueMessage("⏳ Sabar, lagi ada antrian tunggu sebentar...");
        setTimeout(() => setQueueMessage(""), 4000);
      } else {
        setQueueMessage("❌ Terjadi kesalahan sistem. Coba lagi.");
        setTimeout(() => setQueueMessage(""), 4000);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-2 bg-white rounded-lg shadow-sm text-gray-600"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}{" "}
          Pilih Menu
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {products.length === 0 ? (
            <p className="text-gray-500">Memuat menu...</p>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md cursor-pointer border border-gray-100 flex flex-col h-full active:scale-95"
              >
                <div className="h-28 md:h-40 w-full relative bg-gray-200">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <div
                    className={`absolute top-3 right-3 p-2 rounded-full ${product.color || "bg-gray-100"}`}
                  >
                    {renderIcon(product.iconType)}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-grow justify-between">
                  <h3 className="font-semibold text-lg text-gray-800">
                    {product.name}
                  </h3>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-bold text-purple-700">
                      {formatRupiah(product.price)}
                    </span>
                    <button className="bg-purple-100 text-purple-700 p-2 rounded-lg">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="w-full md:w-96 bg-white border-t md:border-l border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Pesanan Baru
          </h2>
        </div>
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <input
            type="text"
            placeholder="Ketik nama pelanggan..."
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Receipt className="w-12 h-12 mb-2 opacity-50" />
              <p>Belum ada menu dipilih</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="flex justify-between bg-white p-3 rounded-xl border border-gray-100 shadow-sm"
              >
                <div className="flex-1 pr-2">
                  <h4 className="font-medium text-sm">{item.name}</h4>
                  <p className="text-xs text-gray-500">
                    {formatRupiah(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => decreaseQty(item.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-600"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-semibold w-4 text-center text-sm">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => addToCart(item)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-purple-100 text-purple-700"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="p-6 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600 font-medium">Total</span>
            <span className="text-2xl font-bold text-gray-800">
              {formatRupiah(total)}
            </span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className={`w-full py-3 md:py-4 rounded-xl font-bold text-base md:text-lg flex items-center justify-center ${cart.length === 0 ? "bg-gray-200 text-gray-400" : "bg-purple-600 text-white shadow-lg"}`}
          >
            Bayar Pesanan
          </button>
        </div>
      </div>
      {isInvoiceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-purple-600 p-6 text-white text-center">
              <h2 className="text-2xl font-bold">Invoice</h2>
              <p className="font-mono mt-2 text-sm bg-purple-700 inline-block px-3 py-1 rounded-full">
                {receiptNumber}
              </p>
            </div>
            <div className="p-6 flex-1 max-h-[50vh] overflow-y-auto">
              <p className="text-center text-gray-500 text-sm mb-4">
                Pelanggan:{" "}
                <span className="font-bold">{customerName || "-"}</span>
              </p>
              <div className="space-y-3 mb-6">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.qty}x {item.name}
                    </span>
                    <span className="font-medium">
                      {formatRupiah(item.price * item.qty)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-300 pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600">Total Harga</span>
                  <span className="font-bold text-gray-800">{formatRupiah(total)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600">Tunai Dibayar</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-32 p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-right font-bold"
                  />
                </div>
                {parseInt(amountPaid) > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-600">Kembalian</span>
                    <span className="font-bold text-green-600">
                      {formatRupiah((parseInt(amountPaid) || 0) - total)}
                    </span>
                  </div>
                )}
                
                <div className="border-t border-gray-200 mt-2 pt-3 flex justify-between items-center bg-purple-50 p-3 rounded-lg">
                  <span className="font-bold text-gray-800">
                    Grand Total ({totalItems} Item)
                  </span>
                  <span className="font-bold text-xl text-purple-600">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 border-t border-gray-100 space-y-3">
              {queueMessage && (
                <div className="bg-yellow-100 text-yellow-800 p-3 rounded-xl text-sm font-bold flex justify-center items-center gap-2 animate-pulse mb-2">
                  <AlertCircle className="w-5 h-5" />
                  {queueMessage}
                </div>
              )}
              {orderSuccess ? (
                <div className="bg-green-100 text-green-700 p-4 rounded-xl flex items-center justify-center gap-2 font-medium">
                  <CheckCircle className="w-5 h-5" /> Selesai & Disimpan!
                </div>
              ) : (
                <>
                  <button
                    onClick={handleCompleteTransaction}
                    disabled={isProcessing}
                    className="w-full py-3 bg-green-600 text-white rounded-xl font-bold"
                  >
                    {isProcessing ? "Memproses..." : "Selesai Transaksi"}
                  </button>
                  <button
                    onClick={() => setIsInvoiceOpen(false)}
                    disabled={isProcessing}
                    className="w-full py-3 bg-white border border-gray-300 rounded-xl font-bold hover:bg-gray-100"
                  >
                    Batal
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} // ==========================================
// 2. KOMPONEN DASHBOARD STATISTIK
// ==========================================
function DashboardView({
  salesHistory,
  formatRupiah,
  isSidebarOpen,
  toggleSidebar,
  handleDeleteTransaction,
  handleResetAll,
}) {
  const totalRevenue = salesHistory.reduce(
    (sum, order) => sum + order.total,
    0,
  );
  const totalOrders = salesHistory.length;

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-2 bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}{" "}
        Dashboard Statistik
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-green-100 text-green-600 rounded-xl">
            <TrendingUp className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Total Pendapatan
            </p>
            <h3 className="text-3xl font-bold text-gray-800">
              {formatRupiah(totalRevenue)}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-xl">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Transaksi</p>
            <h3 className="text-3xl font-bold text-gray-800">
              {totalOrders} Pesanan
            </h3>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Riwayat Penjualan</h3>

          <button
            onClick={handleResetAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm"
          >
            Reset Data
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white border-b border-gray-100 text-gray-500">
              <tr>
                <th className="p-4">Invoice</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Pelanggan</th>
                <th className="p-4">Item</th>
                <th className="p-4">Total</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {salesHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400">
                    Belum ada data penjualan.
                  </td>
                </tr>
              ) : (
                salesHistory.map((order, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="p-4 font-mono text-xs text-purple-600">
                      {order.receiptNumber}
                    </td>
                    <td className="p-4 text-gray-600">{order.date}</td>
                    <td className="p-4 font-medium">{order.customer}</td>
                    <td
                      className="p-4 text-gray-600 max-w-xs truncate"
                      title={order.items}
                    >
                      {order.items}
                    </td>
                    <td className="p-4 font-bold">
                      {formatRupiah(order.total)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleDeleteTransaction(order)}
                        className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. KOMPONEN PENGATURAN / EDIT MENU
// ==========================================
function SettingsView({
  products,
  handleUpdateProduct,
  handleAddProduct,
  handleDeleteProduct,
  formatRupiah,
  isSidebarOpen,
  toggleSidebar,
}) {
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    if (isAdding) {
      await handleAddProduct(editingProduct);
    } else {
      await handleUpdateProduct(editingProduct);
    }
    setIsSaving(false);
    setEditingProduct(null);
    setIsAdding(false);
  };

  const handleAddNew = () => {
    setIsAdding(true);
    setEditingProduct({
      name: "",
      price: 0,
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=500",
      color: "bg-gray-100",
      iconType: "package"
    });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scaleSize = 400 / img.width;
          canvas.width = 400;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setEditingProduct({
            ...editingProduct,
            image: canvas.toDataURL("image/jpeg", 0.7),
          });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50 relative">
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-3">
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="p-2 bg-white rounded-lg shadow-sm"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}{" "}
          Pengaturan Menu
        </h2>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold shadow-sm hover:bg-purple-700"
        >
          + Tambah Menu Baru
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50"
            >
              <div className="flex items-center gap-4">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h4 className="font-bold text-gray-800">{product.name}</h4>
                  <p className="text-purple-600 font-medium">
                    {formatRupiah(product.price)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(product)}
                className="p-2 text-gray-500 hover:text-purple-600"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
      {editingProduct && (
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">{isAdding ? "Tambah Menu Baru" : "Edit Menu"}</h3>
              <button onClick={() => { setEditingProduct(null); setIsAdding(false); }}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nama Menu
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      name: e.target.value,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Harga (Rp)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      price: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Gambar Menu
                </label>
                {editingProduct.image && (
                  <div className="mb-3">
                    <img
                      src={editingProduct.image}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-xl border border-gray-200"
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-500 cursor-pointer"
                />
              </div>
              <div className="pt-4 flex gap-3">
                {!isAdding && (
                  <button
                    type="button"
                    onClick={() => {
                        handleDeleteProduct(editingProduct.id);
                        setEditingProduct(null);
                    }}
                    disabled={isSaving}
                    className="flex-1 py-2 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200"
                  >
                    Hapus
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setEditingProduct(null); setIsAdding(false); }}
                  disabled={isSaving}
                  className="flex-1 py-2 bg-gray-100 rounded-xl font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700"
                >
                  {isSaving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
