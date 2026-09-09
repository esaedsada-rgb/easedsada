const params = new URLSearchParams(window.location.search);
const orderId = params.get("order");

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

async function loadOrder() {
  if (!orderId) {
    $("loading").classList.add("hidden");
    $("notfound").classList.remove("hidden");
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/order/${orderId}`);
    if (!res.ok) throw new Error("not found");
    const order = await res.json();

    $("loading").classList.add("hidden");
    $("orderView").classList.remove("hidden");
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
    $("loading").classList.add("hidden");
    $("notfound").classList.remove("hidden");
  }
}

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

loadOrder();
