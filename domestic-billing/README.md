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
- `ALIPAY_APP_ID`
- `ALIPAY_MODE`
- `ALIPAY_PRIVATE_KEY_PATH` or `ALIPAY_PRIVATE_KEY`
- `ALIPAY_PUBLIC_KEY_PATH` or `ALIPAY_PUBLIC_KEY`
- `ALIPAY_KEY_TYPE`
- `ALIPAY_NOTIFY_URL`
- `ALIPAY_GATEWAY_ENDPOINT`
- `ALIPAY_APP_CERT_PATH`
- `ALIPAY_ALIPAY_PUBLIC_CERT_PATH`
- `ALIPAY_ALIPAY_ROOT_CERT_PATH`

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

Deployment templates live in `deploy/`:

- `deploy/nginx.pay.iccorehub.com.conf`
- `deploy/ecosystem.config.cjs`
- `deploy/iccorehub-domestic-billing.service`
- `deploy/DEPLOYMENT.md`

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

## Alipay face-to-face flow

When `payment_channel = alipay_qr` and Alipay credentials are configured:

- `GET /checkout?token=...` will call `alipay.trade.precreate`
- the returned `qr_code` is persisted back into `recharge_orders`
- the checkout page renders a real QR code SVG
- Alipay async notify should point to `POST /gateway/alipay/notify`
- the domestic portal verifies the Alipay signature locally and then forwards a signed callback to the main site

If you want certificate mode, set:

- `ALIPAY_MODE=cert`
- `ALIPAY_APP_CERT_PATH`
- `ALIPAY_ALIPAY_PUBLIC_CERT_PATH`
- `ALIPAY_ALIPAY_ROOT_CERT_PATH`

## Security notes

- keep `SUPABASE_SERVICE_ROLE_KEY` only on the domestic server
- keep `BILLING_WEBHOOK_SECRET` identical on both the domestic server and the main Cloudflare site
- keep `DOMESTIC_GATEWAY_SECRET` private between your local payment adapter and this portal
- disable `BILLING_ENABLE_MOCK_PAYMENT` in production
- add your gateway-native signature verification before you trust any upstream provider callback
- do not store Alipay private keys in the repo; use local files or environment variables on the domestic host
