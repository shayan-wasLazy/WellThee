"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, CheckCircle2, CreditCard, Info, LoaderCircle } from "lucide-react";

type Props = { authenticated: boolean };

export function PayPalSandbox({ authenticated }: Props) {
  const [amount, setAmount] = useState("10.00");
  const [description, setDescription] = useState("WealthOS sandbox checkout");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("paypal");
    const orderId = url.searchParams.get("token");
    if (result === "cancel") {
      setMessage("The PayPal Sandbox checkout was cancelled. No capture was requested.");
      url.searchParams.delete("paypal");
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
      return;
    }
    if (result !== "return" || !orderId) return;
    if (!authenticated) {
      setMessage("Your session is no longer active. Sign in again to complete the approved Sandbox order.");
      return;
    }
    setBusy(true);
    fetch("/api/v1/payments/paypal/orders/" + encodeURIComponent(orderId) + "/capture", {
      method: "POST",
      credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: "{}"
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not capture the approved order.");
      setMessage(data.status === "COMPLETED"
        ? "Sandbox checkout completed successfully. Capture ID: " + (data.capture_id ?? "recorded")
        : "PayPal returned status: " + data.status + ".");
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not complete the Sandbox order.");
    }).finally(() => {
      setBusy(false);
      url.searchParams.delete("paypal");
      url.searchParams.delete("token");
      url.searchParams.delete("PayerID");
      window.history.replaceState({}, "", url.toString());
    });
  }, [authenticated]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authenticated) {
      setMessage("Sign in to use the PayPal Sandbox.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 10000) {
      setMessage("Enter a valid Sandbox amount between USD 0.01 and USD 10,000.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const origin = window.location.origin;
      const response = await fetch("/api/v1/payments/paypal/orders", {
        method: "POST",
        credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value.toFixed(2),
          currency: "USD",
          description: description.trim() || "WealthOS sandbox checkout",
          return_url: origin + "/?paypal=return",
          cancel_url: origin + "/?paypal=cancel"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not create a PayPal Sandbox order.");
      window.location.assign(data.approval_url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create a PayPal Sandbox order.");
      setBusy(false);
    }
  }

  return <section className="panel paypal-panel">
    <div className="paypal-panel-header">
      <span className="paypal-icon"><CreditCard size={18} /></span>
      <div><div className="panel-kicker">PAYPAL DEVELOPER SANDBOX</div><h3>Test a checkout flow.</h3></div>
      <span className="sandbox-label">SANDBOX ONLY</span>
    </div>
    <p className="paypal-description">Create a real PayPal Sandbox order, approve it with a Sandbox buyer account, and let the verified server-side order flow capture it.</p>
    <form className="paypal-form" onSubmit={createOrder}>
      <label className="form-label">Amount (USD)<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" max="10000" step="0.01" required /></label>
      <label className="form-label">Checkout description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={240} required /></label>
      <button className="button button-primary" type="submit" disabled={busy || !authenticated}>
        {busy ? <LoaderCircle size={14} /> : <ArrowUpRight size={14} />}
        {busy ? "Processing…" : "Continue to PayPal"}
      </button>
    </form>
    {!authenticated && <div className="paypal-hint"><Info size={14} /> Sign in and configure PayPal Sandbox credentials to enable checkout.</div>}
    {message && <div className="paypal-result" role="status"><CheckCircle2 size={15} />{message}</div>}
    <div className="paypal-footnote">No real funds move in Sandbox. This checkout record is separate from your personal transaction ledger. PayPal availability and live currency support depend on the merchant country and account.</div>
  </section>;
}
