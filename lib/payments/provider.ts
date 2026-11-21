/**
 * Payment provider contract — intentionally NOT implemented in this phase.
 *
 * To integrate Click, Payme or another provider later:
 *  1. Implement `PaymentProvider` in `lib/payments/providers/<name>.ts`.
 *  2. Register it in `getPaymentProvider()` behind an env flag (e.g. PAYMENT_PROVIDER=payme).
 *  3. Add `app/api/payments/[provider]/webhook/route.ts` that calls `verifyWebhook` and, only
 *     after a verified successful payment, activates the subscription with
 *     `source: "PAYMENT"`, `provider`, `providerReference` and an `expiresAt`.
 *  4. Never store card data — providers host the checkout page.
 */
export type PlanCode = "PRO_MONTHLY" | "PRO_QUARTERLY" | "PRO_YEARLY";

export type CheckoutRequest = {
  userId: string;
  plan: PlanCode;
  /** Amount in tiyin (1 UZS = 100 tiyin), defined by the plan catalogue — never by the client. */
  amount: number;
  returnUrl: string;
};

export type CheckoutSession = {
  provider: string;
  reference: string;
  redirectUrl: string;
};

export type VerifiedPayment = {
  provider: string;
  reference: string;
  userId: string;
  plan: PlanCode;
  paidAt: Date;
  status: "PAID" | "CANCELLED" | "FAILED";
};

export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: CheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(request: Request): Promise<VerifiedPayment>;
}

/** No provider is configured in this phase, so checkout is unavailable everywhere. */
export function getPaymentProvider(): PaymentProvider | null {
  return null;
}

export function isPaymentAvailable() {
  return getPaymentProvider() !== null;
}
