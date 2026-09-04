import { useState, useEffect, useCallback } from "react";
import { Loader2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import MaterialIcon from "./MaterialIcon";
import PortalDateInput from "./PortalDateInput";

interface MenuItem {
  id: number;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  price: string;
  mealType: string;
  category: string;
  date: string | null;
  available: boolean;
  imageUrl: string | null;
}

interface MealOrder {
  id: number;
  menuItemId: number;
  quantity: number;
  orderDate: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

export default function TabFood() {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<MealOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"menu" | "orders">("menu");

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch(`/api/portal-food/menu?date=${today}&type=daily`, {
        credentials: "include",
      }).then((r) => r.json()),
      apiFetch("/api/portal-food/my-orders", { credentials: "include" }).then(
        (r) => r.json(),
      ),
    ])
      .then(([menuData, orderData]) => {
        if (menuData.success) setMenu(menuData.items || []);
        if (orderData.success) setOrders(orderData.orders || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [today]);

  const handleOrder = async () => {
    if (!selected) return;
    setStatus("loading");
    try {
      const res = await apiFetch("/api/portal-food/order", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId: selected.id,
          quantity: 1,
          orderDate,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed");
      setStatus("success");
      setMsg(isRtl ? "تم الطلب!" : "Ordered!");
      setSelected(null);
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: any) {
      setStatus("error");
      setMsg(err.message);
    }
  };

  const grouped = menu.reduce((acc: Record<string, MenuItem[]>, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryOrder = ["main", "side", "drink", "dessert"];
  const catLabels: Record<string, string> = {
    main: isRtl ? "رئيسي" : "Main",
    side: isRtl ? "جانبي" : "Side",
    drink: isRtl ? "مشروب" : "Drink",
    dessert: isRtl ? "حلوى" : "Dessert",
  };
  const catIcons: Record<string, string> = {
    main: "restaurant",
    side: "tapas",
    drink: "local_cafe",
    dessert: "cake",
  };

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {isRtl ? "خدمات الطعام" : "Food Services"}
        </h2>
      </div>

      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border2"></div>

      {status === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-xl text-green-400 text-[12px]">
          <CheckCircle2 className="w-4 h-4" />
          {msg}
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-[12px]">
          <AlertCircle className="w-4 h-4" />
          {msg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-accent2 animate-spin" />
        </div>
      ) : tab === "menu" ? (
        <div className="space-y-4">
          {menu.length === 0 ? (
            <div className="bg-card border border-border2 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MaterialIcon
                  icon="restaurant"
                  size={24}
                  className="text-muted2 opacity-40"
                />
              </div>
              <p className="text-[13px] text-muted2 font-medium">
                {isRtl ? "لا توجد قائمة طعام اليوم" : "No menu available today"}
              </p>
            </div>
          ) : (
            categoryOrder
              .filter((c) => grouped[c])
              .map((cat) => (
                <div key={cat}>
                  <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                    <MaterialIcon
                      icon={catIcons[cat]}
                      size={18}
                      className="text-accent2"
                    />
                    {catLabels[cat]}
                  </h3>
                  <div className="space-y-2">
                    {grouped[cat].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelected(item)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                          selected?.id === item.id
                            ? "bg-accent2/10 border-accent2/40 shadow-sm"
                            : "bg-surface border-border2 hover:bg-surface-hover hover:border-accent2/30"
                        }`}
                      >
                        <span className="font-medium text-sm text-foreground">
                          {item.name}
                        </span>
                        <span className="text-sm font-semibold text-accent2 bg-accent2/10 px-2 py-0.5 rounded-full">
                          {(item as any).calories}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))
          )}

          {selected && (
            <div className="bg-card border border-accent2/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">
                  {isRtl ? "تأكيد الطلب" : "Confirm Order"}
                </h3>
              </div>
              <div className="text-[12px] text-muted2">
                <span className="font-bold text-foreground">
                  {isRtl && selected.nameAr ? selected.nameAr : selected.name}
                </span>
                {" — "}
                {selected.price}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
                  {isRtl ? "تاريخ الطلب" : "Order Date"}
                </label>
                <PortalDateInput
                  value={orderDate}
                  onChange={(iso) => setOrderDate(iso)}
                  className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[12px] focus:outline-none focus:border-accent2/50"
                />
              </div>
              <button
                onClick={handleOrder}
                disabled={status === "loading"}
                className="w-full py-2.5 rounded-xl bg-accent2 text-accent2-foreground text-[12px] font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-all disabled:opacity-50"
              >
                {status === "loading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MaterialIcon icon="done" size={16} />
                )}
                {isRtl ? "تأكيد الطلب" : "Place Order"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {orders.length === 0 ? (
            <div className="bg-card border border-border2 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-3">
                <MaterialIcon
                  icon="receipt_long"
                  size={24}
                  className="text-muted2 opacity-40"
                />
              </div>
              <p className="text-[13px] text-muted2 font-medium">
                {isRtl ? "لا توجد طلبات" : "No orders yet"}
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-card border border-border2 rounded-xl p-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold text-foreground">
                    {isRtl ? `طلب #${order.id}` : `Order #${order.id}`}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      order.status === "cancelled"
                        ? "bg-red-400/10 text-red-400"
                        : order.status === "served"
                          ? "bg-green-400/10 text-green-400"
                          : "bg-accent2/10 text-accent2"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="text-[11px] text-muted2 mt-1">
                  {order.orderDate} · {order.quantity}x
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
