# Domestic Billing Deployment

## Suggested directory

```bash
/srv/iccorehub/domestic-billing
```

## Option A: PM2

1. Copy `ecosystem.config.cjs` into the deployment directory.
2. Update `cwd` if your path is different.
3. Start:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## Option B: systemd

1. Copy `iccorehub-domestic-billing.service` to `/etc/systemd/system/`.
2. Adjust `WorkingDirectory`, `ExecStart`, `User`, and `Group`.
3. Reload and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable iccorehub-domestic-billing
sudo systemctl restart iccorehub-domestic-billing
sudo systemctl status iccorehub-domestic-billing
```

## Nginx

1. Copy `nginx.pay.iccorehub.com.conf` to `/etc/nginx/conf.d/` or your site-enabled directory.
2. Add TLS separately with your certificate tooling.
3. Test and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Before going live

1. Run the latest Supabase migrations, including recharge checkout provider fields.
2. Populate `.env` with real Alipay and callback secrets.
3. Confirm `pay.iccorehub.com/health` returns `alipayConfigured: true`.
4. Create a recharge order on the main site and open the checkout token page.
5. Verify Alipay async notify reaches `/gateway/alipay/notify`.
6. Confirm the main site `/api/billing/callback` marks the order as `paid` and credits points.
