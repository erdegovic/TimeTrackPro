import express, { type Express, type Request, type Response, Router } from "express";
import { randomBytes } from "node:crypto";
import { Environment, EventName, Paddle } from "@paddle/paddle-node-sdk";
import { z } from "zod";
import { pool } from "../db";
import { storage } from "../storage";
import {
  extractTickdCheckoutToken,
  hasPaidPaddleStatus,
  resolvePaddlePrice,
  type PaddlePaidPlan,
  type PaddlePriceMap,
} from "@shared/paddle-billing";
import { subscriptionPlanRank } from "@shared/subscriptions";

type PaddleEnvironment = "sandbox" | "production";

const getEnvironment = (): PaddleEnvironment =>
  process.env.PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

const getPaddle = () => {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("Paddle API access is not configured");

  return new Paddle(apiKey, {
    environment: getEnvironment() === "production" ? Environment.production : Environment.sandbox,
  });
};

const getConfiguredPriceIds = (): PaddlePriceMap => ({
  pro: {
    monthly: process.env.PADDLE_PRO_PRICE_ID,
    annual: process.env.PADDLE_PRO_ANNUAL_PRICE_ID,
  },
  ultimate: {
    monthly: process.env.PADDLE_ULTIMATE_PRICE_ID,
    annual: process.env.PADDLE_ULTIMATE_ANNUAL_PRICE_ID,
  },
});

export const isPaddleCheckoutConfigured = () => Boolean(
  process.env.PADDLE_CLIENT_TOKEN
    && process.env.PADDLE_API_KEY
    && process.env.PADDLE_WEBHOOK_SECRET
    && (process.env.PADDLE_PRO_PRICE_ID || process.env.PADDLE_ULTIMATE_PRICE_ID),
);

export const hasConfiguredProPrice = (items: Array<{ price?: { id?: string } | null }>) => {
  return resolvePaddlePrice(items, getConfiguredPriceIds())?.plan === "pro";
};

const findUserIdForPaddleEvent = async (data: {
  customData?: unknown;
  customerId?: string | null;
  id?: string;
  subscriptionId?: string | null;
}) => {
  const checkoutToken = extractTickdCheckoutToken(data.customData);
  if (checkoutToken) {
    const checkout = await pool.query<{ user_id: number }>(
      `SELECT user_id FROM paddle_checkout_sessions
       WHERE token = $1 AND expires_at > now()
       LIMIT 1`,
      [checkoutToken],
    );
    if (checkout.rows[0]?.user_id) return checkout.rows[0].user_id;
  }

  const subscriptionId = data.subscriptionId || (data.id?.startsWith("sub_") ? data.id : null);
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM users
     WHERE ($1::text IS NOT NULL AND paddle_subscription_id = $1)
        OR ($2::text IS NOT NULL AND paddle_customer_id = $2)
     LIMIT 1`,
    [subscriptionId, data.customerId || null],
  );
  return result.rows[0]?.id || null;
};

const createCheckoutToken = async (userId: number) => {
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM paddle_checkout_sessions WHERE expires_at <= now()");
  await pool.query(
    `INSERT INTO paddle_checkout_sessions (token, user_id, expires_at)
     VALUES ($1, $2, now() + interval '30 minutes')`,
    [token, userId],
  );
  return token;
};

const recordEvent = async (eventId: string, eventType: string, occurredAt: string) => {
  const result = await pool.query(
    `INSERT INTO paddle_webhook_events (id, event_type, occurred_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [eventId, eventType, occurredAt],
  );
  return (result.rowCount || 0) > 0;
};

const releaseEventForRetry = async (eventId: string) => {
  await pool.query("DELETE FROM paddle_webhook_events WHERE id = $1", [eventId]);
};

const processSubscriptionEvent = async (data: any) => {
  const selection = resolvePaddlePrice(data.items || [], getConfiguredPriceIds());
  if (!selection) return;
  const userId = await findUserIdForPaddleEvent(data);
  if (!userId) throw new Error(`No Tickd user matched Paddle subscription ${data.id}`);

  const status = String(data.status || "inactive").toLowerCase();
  const paidAccess = hasPaidPaddleStatus(status);
  const cancelAtPeriodEnd = data.scheduledChange?.action === "cancel";
  const periodEnd = data.currentBillingPeriod?.endsAt || data.nextBilledAt || null;

  await pool.query(
    `UPDATE users
     SET subscription_plan = $2,
         subscription_status = $3,
         subscription_changed_at = now(),
         subscription_requested_plan = NULL,
         subscription_billing_interval = $4,
         subscription_requested_billing_interval = NULL,
         subscription_current_period_end = $5,
         subscription_cancel_at_period_end = $6,
         paddle_customer_id = COALESCE($7, paddle_customer_id),
         paddle_subscription_id = $8,
         updated_at = now()
     WHERE id = $1`,
    [userId, paidAccess ? selection.plan : "free", status, selection.billingInterval, periodEnd, cancelAtPeriodEnd, data.customerId, data.id],
  );
};

const processCompletedTransaction = async (data: any) => {
  const selection = resolvePaddlePrice(data.items || [], getConfiguredPriceIds());
  if (!selection) return;
  const userId = await findUserIdForPaddleEvent(data);
  if (!userId) throw new Error(`No Tickd user matched Paddle transaction ${data.id}`);

  await pool.query(
    `UPDATE users
     SET subscription_plan = $2,
         subscription_status = 'active',
         subscription_changed_at = now(),
         subscription_requested_plan = NULL,
         subscription_billing_interval = $3,
         subscription_requested_billing_interval = NULL,
         subscription_current_period_end = COALESCE($4, subscription_current_period_end),
         subscription_cancel_at_period_end = false,
         paddle_customer_id = COALESCE($5, paddle_customer_id),
         paddle_subscription_id = COALESCE($6, paddle_subscription_id),
         updated_at = now()
     WHERE id = $1`,
    [userId, selection.plan, selection.billingInterval, data.billingPeriod?.endsAt || null, data.customerId, data.subscriptionId],
  );
};

const processFailedTransaction = async (data: any) => {
  const userId = await findUserIdForPaddleEvent(data);
  if (!userId) return;
  await pool.query(
    `UPDATE users
     SET subscription_status = CASE WHEN subscription_plan IN ('pro', 'ultimate') THEN 'past_due' ELSE subscription_status END,
         subscription_changed_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [userId],
  );
};

export const registerPaddleWebhook = (app: Express) => {
  app.post(
    "/api/billing/paddle/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req: Request, res: Response) => {
      const secret = process.env.PADDLE_WEBHOOK_SECRET;
      const signature = req.header("paddle-signature") || "";
      if (!secret || !signature || !Buffer.isBuffer(req.body)) {
        return res.status(400).send("Webhook is not configured");
      }

      let eventId: string | null = null;
      try {
        const event = await getPaddle().webhooks.unmarshal(req.body.toString("utf8"), secret, signature);
        eventId = event.eventId;
        if (!await recordEvent(event.eventId, event.eventType, event.occurredAt)) {
          return res.status(200).send("Already processed");
        }

        switch (event.eventType) {
          case EventName.SubscriptionCreated:
          case EventName.SubscriptionActivated:
          case EventName.SubscriptionUpdated:
          case EventName.SubscriptionTrialing:
          case EventName.SubscriptionPastDue:
          case EventName.SubscriptionPaused:
          case EventName.SubscriptionResumed:
          case EventName.SubscriptionCanceled:
            await processSubscriptionEvent(event.data);
            break;
          case EventName.TransactionCompleted:
            await processCompletedTransaction(event.data);
            break;
          case EventName.TransactionPaymentFailed:
          case EventName.TransactionPastDue:
            await processFailedTransaction(event.data);
            break;
        }

        return res.status(200).send("OK");
      } catch (error) {
        if (eventId) await releaseEventForRetry(eventId);
        console.error("Paddle webhook failed:", error);
        return res.status(400).send("Invalid webhook");
      }
    },
  );
};

const router = Router();

router.get("/config", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });

  const enabled = isPaddleCheckoutConfigured();
  const checkoutToken = enabled ? await createCheckoutToken(user.id) : null;
  const priceIds = getConfiguredPriceIds();
  return res.json({
    enabled,
    environment: getEnvironment(),
    clientToken: enabled ? process.env.PADDLE_CLIENT_TOKEN : null,
    priceIds: {
      pro: {
        monthly: enabled ? priceIds.pro?.monthly || null : null,
        annual: enabled ? priceIds.pro?.annual || null : null,
      },
      ultimate: {
        monthly: enabled ? priceIds.ultimate?.monthly || null : null,
        annual: enabled ? priceIds.ultimate?.annual || null : null,
      },
    },
    proPriceId: enabled ? priceIds.pro?.monthly || null : null,
    ultimatePriceId: enabled ? priceIds.ultimate?.monthly || null : null,
    customerId: user.paddleCustomerId || null,
    checkoutToken,
    email: user.email,
  });
});

const changePlanSchema = z.object({
  plan: z.enum(["pro", "ultimate"]),
  billingInterval: z.enum(["monthly", "annual"]),
});

router.post("/change-plan", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const validation = changePlanSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json({ message: "Choose a valid paid plan." });

  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.paddleCustomerId || !user.paddleSubscriptionId) {
    return res.status(400).json({ message: "Start a Paddle subscription before changing paid plans." });
  }

  const priceId = getConfiguredPriceIds()[validation.data.plan]?.[validation.data.billingInterval];
  if (!priceId) return res.status(503).json({ message: `${validation.data.plan === "pro" ? "Pro" : "Ultimate"} checkout is not configured.` });

  try {
    const paddle = getPaddle();
    const currentSubscription = await paddle.subscriptions.get(user.paddleSubscriptionId);
    if (currentSubscription.customerId !== user.paddleCustomerId) {
      return res.status(409).json({ message: "The linked Paddle subscription could not be verified." });
    }

    const currentPlan = user.subscriptionPlan === "ultimate" ? "ultimate" : "pro";
    const currentInterval = user.subscriptionBillingInterval === "annual" ? "annual" : "monthly";
    const isPlanUpgrade = subscriptionPlanRank[validation.data.plan] > subscriptionPlanRank[currentPlan];
    const isCadenceUpgrade = validation.data.plan === currentPlan
      && currentInterval === "monthly"
      && validation.data.billingInterval === "annual";
    const isImmediate = isPlanUpgrade || isCadenceUpgrade;
    const subscription = await paddle.subscriptions.update(user.paddleSubscriptionId, {
      items: [{ priceId, quantity: 1 }],
      prorationBillingMode: isImmediate ? "prorated_immediately" : "prorated_next_billing_period",
      customData: {
        ...(currentSubscription.customData || {}),
        tickd_plan: validation.data.plan,
        tickd_billing_interval: validation.data.billingInterval,
      },
    });

    return res.json({
      plan: validation.data.plan,
      billingInterval: validation.data.billingInterval,
      status: subscription.status,
      effective: isImmediate ? "immediate" : "next_billing_period",
    });
  } catch (error) {
    console.error("Could not change Paddle subscription plan:", error);
    return res.status(502).json({ message: "The subscription could not be changed. Please try again." });
  }
});

router.post("/portal", async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await storage.getUser(userId);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!user.paddleCustomerId) {
    return res.status(400).json({ message: "No Paddle billing account is linked to this Tickd account." });
  }

  try {
    const session = await getPaddle().customerPortalSessions.create(
      user.paddleCustomerId,
      user.paddleSubscriptionId ? [user.paddleSubscriptionId] : [],
    );
    return res.json({ url: session.urls.general.overview });
  } catch (error) {
    console.error("Could not create Paddle customer portal session:", error);
    return res.status(502).json({ message: "Billing management is temporarily unavailable." });
  }
});

export default router;
