// main.js
// This file replaces the old config.js + script.js — everything in one place.

// ---------------------------------------------------------------------
// CONFIG — put your bot's public, HTTPS-reachable address here.
// On WispByte: panel → your bot's server → Network/Allocations tab.
// No trailing slash. Example: "https://your-bot-domain.com"
// ---------------------------------------------------------------------
const API_BASE_URL = "https://your-bot-hosting-url.example.com";

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
let orderId = params.get("order") || "";

const $ = (id) => document.getElementById(id);

function directionLabel(direction) {
  return direction === "BDT_TO_LTC" ? "BDT → LTC" : "LTC → BDT";
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1200);
  } catch (e) {
    alert("Copy this manually: " + text);
  }
}

function renderPayTargets(order) {
  const container = $("payTargets");
  container.innerHTML = "";
  const entries = [];
  if (order.payTo.bkash) entries.push(["bKash", order.payTo.bkash]);
  if (order.payTo.nagad) entries.push(["Nagad", order.payTo.nagad]);
  if (order.payTo.ltcWallet) entries.push(["LTC Wallet", order.payTo.ltcWallet]);

  entries.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "pay-target";
    row.innerHTML = `<span>${label}: ${value}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Copy";
    btn.onclick = () => copyText(value, btn);
    row.appendChild(btn);
    container.appendChild(row);
  });
}

function setBadge(status) {
  const badge = $("statusBadge");
  const map = {
    awaiting_payment: ["Awaiting Payment", "awaiting"],
    verifying: ["Verifying", "verifying"],
    approved: ["Approved ✅", "approved done"],
    rejected: ["Rejected ❌", "rejected"],
  };
  const [text, cls] = map[status] || [status, ""];
  badge.textContent = text;
  badge.className = "badge " + cls;
}

function showState(name) {
  ["entry", "loading", "notfound", "orderView"].forEach((id) => $(id).classList.add("hidden"));
  $(name).classList.remove("hidden");
}

async function loadOrder(id) {
  orderId = id;
  showState("loading");

  try {
    const res = await fetch(`${API_BASE_URL}/api/order/${orderId}`);
    if (!res.ok) throw new Error("not found");
    const order = await res.json();

    showState("orderView");
    $("orderId").textContent = "#" + order.id;
    setBadge(order.status);
    $("direction").textContent = directionLabel(order.direction);
    $("rate").textContent = `1 LTC = ${order.rateBdtPerLtc} BDT`;

    const isBdtToLtc = order.direction === "BDT_TO_LTC";
    $("youSend").textContent = isBdtToLtc ? `${order.amountBdt} BDT` : `${order.amountLtc} LTC`;
    $("youReceive").textContent = isBdtToLtc ? `${order.amountLtc} LTC` : `${order.amountBdt} BDT`;

    renderPayTargets(order);

    if (order.status === "awaiting_payment") {
      $("submitSection").classList.remove("hidden");
      $("alreadySubmitted").classList.add("hidden");
    } else {
      $("submitSection").classList.add("hidden");
      $("alreadySubmitted").classList.remove("hidden");
    }
  } catch (e) {
    showState("notfound");
  }
}

// ---------------------------------------------------------------------
// Manual "put your order ID" entry (used if someone lands without
// ?order=... in the link, or wants to look up a different order)
// ---------------------------------------------------------------------
$("orderIdBtn")?.addEventListener("click", () => {
  const id = $("orderIdInput").value.trim();
  const msg = $("entryMsg");
  if (!id) {
    msg.textContent = "Please enter your order ID.";
    return;
  }
  msg.textContent = "";
  history.replaceState(null, "", `${location.pathname}?order=${id}`);
  loadOrder(id);
});

$("orderIdInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("orderIdBtn").click();
});

$("changeOrderBtn")?.addEventListener("click", () => {
  showState("entry");
  $("orderIdInput").value = "";
});

$("tryAgainBtn")?.addEventListener("click", () => {
  showState("entry");
  $("orderIdInput").value = orderId || "";
});

// ---------------------------------------------------------------------
// Submit transaction ID
// ---------------------------------------------------------------------
$("submitBtn")?.addEventListener("click", async () => {
  const btn = $("submitBtn");
  const msg = $("formMsg");
  const trxId = $("trxId").value.trim();
  msg.textContent = "";
  msg.className = "form-msg";

  if (!trxId) {
    msg.textContent = "Please enter your transaction ID.";
    msg.className = "form-msg error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Submitting…";

  try {
    const res = await fetch(`${API_BASE_URL}/api/order/${orderId}/submit-trx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trxId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Submission failed");

    msg.textContent = "Submitted! Staff will verify shortly — check Discord for updates.";
    msg.className = "form-msg ok";
    $("submitSection").classList.add("hidden");
    $("alreadySubmitted").classList.remove("hidden");
    setBadge("verifying");
  } catch (e) {
    msg.textContent = e.message;
    msg.className = "form-msg error";
    btn.disabled = false;
    btn.textContent = "Submit for Verification";
  }
});

// ---------------------------------------------------------------------
// Start: if the link already has ?order=..., load it straight away.
// Otherwise show the "put your order ID" box.
// ---------------------------------------------------------------------
if (orderId) {
  loadOrder(orderId);
} else {
  showState("entry");
}
