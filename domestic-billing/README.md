# ICCoreHub Domestic Billing Portal

This folder is a reference implementation for deploying `pay.iccorehub.com` on a domestic server.

## What it does

- renders a private checkout page from `recharge_orders.checkout_token`
- renders a private status page with auto-refresh while the order is still pending
- forwards signed payment callbacks to the main site `/api/billing/callback`
- provides a trusted adapter endpoint for your domestic gateway integration
- includes an optional mock-payment mode for local integration testing

## Routes

- `GET /`
- `GET /health`
- `GET /checkout?token=...`
- `GET /status?token=...`
- `POST /gateway/notify`
- `POST /pay/mock-success`

## Environment

Copy `.env.example` to `.env` and set:

- `HOST`
- `PORT`
- `MAIN_SITE_PUBLIC_URL`
- `MAIN_SITE_CALLBACK_URL`
- `BILLING_PORTAL_PUBLIC_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BILLING_WEBHOOK_SECRET`
- `DOMESTIC_GATEWAY_SECRET`
- `BILLING_ENABLE_MOCK_PAYMENT`

## Start

```bash
cd domestic-billing
node server.mjs
```

For local development:

```bash
cd domestic-billing
npm run dev
```

## Domestic gateway adapter

Your Alipay / WeChat / bank-transfer integration can call:

```http
POST /gateway/notify
X-ICCoreHub-Domestic-Secret: <DOMESTIC_GATEWAY_SECRET>
Content-Type: application/json
```

Example body:

```json
{
  "orderNo": "RCH20260327093000A1B2C3D4",
  "status": "paid",
  "externalTradeNo": "ALI202603270001",
  "externalOrderNo": "MERCHANT-ORDER-001",
  "paidAmountCny": 300,
  "paymentChannel": "alipay_qr",
  "source": "alipay.notify",
  "message": "Alipay async notification",
  "payload": {
    "buyer_id": "2088xxxx",
    "trade_status": "TRADE_SUCCESS"
  }
}
```

The portal signs that payload with `BILLING_WEBHOOK_SECRET` and forwards it to the main site callback.

## Security notes

- keep `SUPABASE_SERVICE_ROLE_KEY` only on the domestic server
- keep `BILLING_WEBHOOK_SECRET` identical on both the domestic server and the main Cloudflare site
- keep `DOMESTIC_GATEWAY_SECRET` private between your local payment adapter and this portal
- disable `BILLING_ENABLE_MOCK_PAYMENT` in production
- add your gateway-native signature verification before you trust any upstream provider callback
