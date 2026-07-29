/* =========================================================================
   NIKKEL — main.js
   All app logic: product storage, cart, checkout, admin auth, Telegram alerts.

   ⚠️ SECURITY NOTE — read before you deploy this anywhere public:
   This is a pure front-end site (no server/database). That means:
     - The admin password below is sitting in plain text in a file anyone
       can open with "View Page Source". It will keep unauthorized people
       out of the *look* of your admin panel, but it is NOT real security.
     - The Telegram bot token below is exposed the same way. Anyone who
       finds it can send messages as your bot / read what it can read.
     - All products and orders are stored in the visitor's own browser
       (localStorage). Two different browsers/devices will NOT see the
       same product catalogue — there is no shared/central database.
   This is fine for a demo, a portfolio piece, or a low-stakes personal
   project. For a real store handling real orders and real payments, you
   want a small backend (even a free one) holding these secrets instead.
   ========================================================================= */

// ------------------------- 1. CONFIGURE ME --------------------------------
const CONFIG = {
  // Get this from @BotFather on Telegram after creating a bot.
  TELEGRAM_BOT_TOKEN: "YOUR_TELEGRAM_BOT_TOKEN_HERE",

  // The chat ID that should receive order alerts. Easiest way to get it:
  // message your bot once, then visit
  // https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
  // and read the "chat":{"id": ...} field.
  TELEGRAM_CHAT_ID: "YOUR_TELEGRAM_CHAT_ID_HERE",

  // Admin panel credentials (see security note above).
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD: "changeme123",
};

// ------------------------- 2. STORAGE HELPERS ------------------------------
const DB = {
  getProducts() {
    return JSON.parse(localStorage.getItem("nikkel_products") || "[]");
  },
  saveProducts(list) {
    localStorage.setItem("nikkel_products", JSON.stringify(list));
  },
  getOrders() {
    return JSON.parse(localStorage.getItem("nikkel_orders") || "[]");
  },
  saveOrders(list) {
    localStorage.setItem("nikkel_orders", JSON.stringify(list));
  },
  getCart() {
    return JSON.parse(localStorage.getItem("nikkel_cart") || "[]");
  },
  saveCart(cart) {
    localStorage.setItem("nikkel_cart", JSON.stringify(cart));
  },
};

// Seed a few example products the first time the site is opened.
function seedProductsIfEmpty() {
  if (DB.getProducts().length > 0) return;
  DB.saveProducts([
    {
      id: crypto.randomUUID(),
      name: "Aluminium Card Case",
      price: 42,
      stock: 14,
      description: "Brushed-aluminium card holder, machined from a single block.",
      image: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Steel Desk Sphere",
      price: 68,
      stock: 6,
      description: "A precision-turned steel sphere. Purely for the desk.",
      image: "",
    },
    {
      id: crypto.randomUUID(),
      name: "Mono Wall Clock",
      price: 95,
      stock: 9,
      description: "No numbers, no colour. Just two hands on a chrome face.",
      image: "",
    },
  ]);
}

// ------------------------- 3. TELEGRAM NOTIFY -------------------------------
async function sendTelegramNotification(text) {
  if (
    !CONFIG.TELEGRAM_BOT_TOKEN ||
    CONFIG.TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN_HERE" ||
    !CONFIG.TELEGRAM_CHAT_ID ||
    CONFIG.TELEGRAM_CHAT_ID === "YOUR_TELEGRAM_CHAT_ID_HERE"
  ) {
    console.warn("Telegram not configured yet — skipping notification. Fill in CONFIG in main.js.");
    return;
  }
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "HTML",
      }),
    });
  } catch (err) {
    console.error("Telegram notification failed:", err);
  }
}

// ------------------------- 4. SHARED HELPERS --------------------------------
function money(n) {
  return "$" + Number(n).toFixed(2);
}
function showToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}
function placeholderImg(name) {
  // Simple inline SVG placeholder so products without an image still look tidy.
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
    <rect width='100%' height='100%' fill='#1c1c1c'/>
    <text x='50%' y='55%' font-family='Arial' font-size='60' fill='#5c5c5c' text-anchor='middle'>${initial}</text>
  </svg>`;
  return "data:image/svg+xml;base64," + btoa(svg);
}

// =============================================================================
// 5. STORE PAGE (index.html)
// =============================================================================
function initStorePage() {
  seedProductsIfEmpty();

  const grid = document.getElementById("productGrid");
  const cartItemsEl = document.getElementById("cartItems");
  const cartCountEl = document.getElementById("cartCount");
  const cartTotalEl = document.getElementById("cartTotal");
  const itemCountLabel = document.getElementById("itemCountLabel");
  const checkoutBtn = document.getElementById("checkoutBtn");

  document.getElementById("year").textContent = new Date().getFullYear();

  function renderProducts() {
    const products = DB.getProducts();
    itemCountLabel.textContent = `${products.length} item${products.length === 1 ? "" : "s"}`;

    if (products.length === 0) {
      grid.innerHTML = `<div class="empty">No products yet. Check back soon.</div>`;
      return;
    }

    grid.innerHTML = products
      .map((p) => {
        const img = p.image || placeholderImg(p.name);
        const outOfStock = Number(p.stock) <= 0;
        return `
          <div class="card">
            <div class="card-img" style="background-image:url('${img}')"></div>
            <div class="card-body">
              <h3>${escapeHtml(p.name)}</h3>
              <div class="desc">${escapeHtml(p.description || "")}</div>
              <div class="card-foot">
                <span class="price">${money(p.price)}</span>
                <button class="add-btn" data-id="${p.id}" ${outOfStock ? "disabled" : ""}>
                  ${outOfStock ? "Sold out" : "Add"}
                </button>
              </div>
            </div>
          </div>`;
      })
      .join("");

    grid.querySelectorAll(".add-btn").forEach((btn) => {
      btn.addEventListener("click", () => addToCart(btn.dataset.id));
    });
  }

  function addToCart(productId) {
    const cart = DB.getCart();
    const existing = cart.find((c) => c.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId, qty: 1 });
    }
    DB.saveCart(cart);
    renderCart();
    showToast("Added to cart");
  }

  function updateQty(productId, delta) {
    let cart = DB.getCart();
    const item = cart.find((c) => c.productId === productId);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter((c) => c.productId !== productId);
    }
    DB.saveCart(cart);
    renderCart();
  }

  function removeFromCart(productId) {
    const cart = DB.getCart().filter((c) => c.productId !== productId);
    DB.saveCart(cart);
    renderCart();
  }

  function renderCart() {
    const cart = DB.getCart();
    const products = DB.getProducts();
    let total = 0;
    let count = 0;

    if (cart.length === 0) {
      cartItemsEl.innerHTML = `<div class="empty">Your cart is empty.</div>`;
    } else {
      cartItemsEl.innerHTML = cart
        .map((item) => {
          const p = products.find((pr) => pr.id === item.productId);
          if (!p) return "";
          const lineTotal = p.price * item.qty;
          total += lineTotal;
          count += item.qty;
          const img = p.image || placeholderImg(p.name);
          return `
            <div class="cart-item">
              <img src="${img}" alt="">
              <div class="ci-info">
                <h4>${escapeHtml(p.name)}</h4>
                <div class="ci-row">
                  <button class="qty-btn" data-action="dec" data-id="${p.id}">−</button>
                  <span>${item.qty}</span>
                  <button class="qty-btn" data-action="inc" data-id="${p.id}">+</button>
                  <span>${money(lineTotal)}</span>
                  <span class="remove-link" data-action="rm" data-id="${p.id}">Remove</span>
                </div>
              </div>
            </div>`;
        })
        .join("");
    }

    cartCountEl.textContent = count;
    cartTotalEl.textContent = money(total);
    checkoutBtn.disabled = cart.length === 0;

    cartItemsEl.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id;
        const action = el.dataset.action;
        if (action === "inc") updateQty(id, 1);
        if (action === "dec") updateQty(id, -1);
        if (action === "rm") removeFromCart(id);
      });
    });
  }

  // Cart drawer open/close
  const overlay = document.getElementById("overlay");
  const drawer = document.getElementById("cartDrawer");
  function openDrawer() {
    overlay.classList.add("open");
    drawer.classList.add("open");
  }
  function closeDrawer() {
    overlay.classList.remove("open");
    drawer.classList.remove("open");
  }
  document.getElementById("cartOpenBtn").addEventListener("click", openDrawer);
  document.getElementById("cartCloseBtn").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  // Checkout modal
  const modal = document.getElementById("checkoutModal");
  checkoutBtn.addEventListener("click", () => {
    if (DB.getCart().length === 0) return;
    modal.classList.add("open");
  });
  document.getElementById("checkoutCancel").addEventListener("click", () => {
    modal.classList.remove("open");
  });

  document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("custName").value.trim();
    const phone = document.getElementById("custPhone").value.trim();
    const address = document.getElementById("custAddress").value.trim();

    const cart = DB.getCart();
    const products = DB.getProducts();
    const lines = [];
    let total = 0;

    cart.forEach((item) => {
      const p = products.find((pr) => pr.id === item.productId);
      if (!p) return;
      lines.push({ name: p.name, qty: item.qty, price: p.price });
      total += p.price * item.qty;
      // reduce stock
      p.stock = Math.max(0, Number(p.stock) - item.qty);
    });
    DB.saveProducts(products);

    const order = {
      id: "ORD-" + Date.now().toString().slice(-6),
      date: new Date().toISOString(),
      customer: { name, phone, address },
      items: lines,
      total,
    };
    const orders = DB.getOrders();
    orders.unshift(order);
    DB.saveOrders(orders);

    // Notify admin via Telegram
    const itemsText = lines.map((l) => `• ${l.name} × ${l.qty} — ${money(l.price * l.qty)}`).join("\n");
    const message =
      `🛒 <b>New order ${order.id}</b>\n` +
      `${itemsText}\n` +
      `Total: <b>${money(total)}</b>\n\n` +
      `Customer: ${name}\n` +
      `Phone: ${phone}\n` +
      `Address: ${address}`;
    sendTelegramNotification(message);

    // Clear cart + UI
    DB.saveCart([]);
    renderCart();
    renderProducts();
    modal.classList.remove("open");
    closeDrawer();
    e.target.reset();
    showToast(`Order placed — ${order.id}`);
  });

  renderProducts();
  renderCart();
}

// =============================================================================
// 6. ADMIN PAGE (page.html)
// =============================================================================
function initAdminPage() {
  seedProductsIfEmpty();

  const loginWrap = document.getElementById("loginWrap");
  const dashboard = document.getElementById("dashboard");
  const logoutBtn = document.getElementById("logoutBtn");

  function isLoggedIn() {
    return sessionStorage.getItem("nikkel_admin_session") === "true";
  }
  function showDashboard() {
    loginWrap.style.display = "none";
    dashboard.style.display = "block";
    logoutBtn.style.display = "inline-block";
    renderProductTable();
    renderOrderTable();
  }
  function showLogin() {
    loginWrap.style.display = "flex";
    dashboard.style.display = "none";
    logoutBtn.style.display = "none";
  }

  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = document.getElementById("loginUser").value.trim();
    const pass = document.getElementById("loginPass").value;
    const errorEl = document.getElementById("loginError");

    if (user === CONFIG.ADMIN_USERNAME && pass === CONFIG.ADMIN_PASSWORD) {
      sessionStorage.setItem("nikkel_admin_session", "true");
      errorEl.style.display = "none";
      showDashboard();
    } else {
      errorEl.style.display = "block";
    }
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("nikkel_admin_session");
    showLogin();
  });

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
    });
  });

  // Image upload -> base64 preview
  let pendingImage = "";
  const imgDrop = document.getElementById("imgDrop");
  const imgDropLabel = document.getElementById("imgDropLabel");
  document.getElementById("prodImage").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImage = reader.result;
      imgDropLabel.innerHTML = `<img src="${pendingImage}" alt=""><div>Click to change image</div>`;
    };
    reader.readAsDataURL(file);
  });

  // Add product
  document.getElementById("productForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("prodName").value.trim();
    const price = parseFloat(document.getElementById("prodPrice").value);
    const stock = parseInt(document.getElementById("prodStock").value, 10);
    const description = document.getElementById("prodDesc").value.trim();

    const products = DB.getProducts();
    products.unshift({
      id: crypto.randomUUID(),
      name,
      price,
      stock,
      description,
      image: pendingImage,
    });
    DB.saveProducts(products);

    e.target.reset();
    pendingImage = "";
    imgDropLabel.innerHTML = "Click to upload image";
    renderProductTable();
    showToast("Product added");
  });

  function renderProductTable() {
    const tbody = document.getElementById("productTableBody");
    const products = DB.getProducts();
    if (products.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No products yet — add your first one.</td></tr>`;
      return;
    }
    tbody.innerHTML = products
      .map(
        (p) => `
        <tr>
          <td><img class="p-thumb" src="${p.image || placeholderImg(p.name)}" alt=""></td>
          <td>${escapeHtml(p.name)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock}</td>
          <td><button class="del-btn" data-id="${p.id}">Delete</button></td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll(".del-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Delete this product?")) return;
        const remaining = DB.getProducts().filter((p) => p.id !== btn.dataset.id);
        DB.saveProducts(remaining);
        renderProductTable();
        showToast("Product deleted");
      });
    });
  }

  function renderOrderTable() {
    const tbody = document.getElementById("orderTableBody");
    const orders = DB.getOrders();
    if (orders.length === 0) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No orders yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = orders
      .map((o) => {
        const itemsText = o.items.map((i) => `${i.name} ×${i.qty}`).join(", ");
        const date = new Date(o.date).toLocaleString();
        return `
          <tr>
            <td><span class="badge">${o.id}</span></td>
            <td>${escapeHtml(o.customer.name)}<br><span class="order-items">${escapeHtml(o.customer.phone)}</span></td>
            <td class="order-items">${escapeHtml(itemsText)}</td>
            <td>${money(o.total)}</td>
            <td class="order-items">${date}</td>
          </tr>`;
      })
      .join("");
  }

  if (isLoggedIn()) {
    showDashboard();
  } else {
    showLogin();
  }
}

// ------------------------- 7. ESCAPE HELPER ---------------------------------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ------------------------- 8. BOOT -------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("productGrid")) {
    initStorePage();
  } else if (document.getElementById("loginForm")) {
    initAdminPage();
  }
});