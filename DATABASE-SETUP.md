# Citizen Services Portal — Database setup

The portal can be installed as a Progressive Web App (PWA) from its HTTPS GitHub Pages address. Its interface shell is cached for offline viewing. Report submission requires an internet connection.

## Connect Supabase

1. Create a Supabase project and open **SQL Editor**.
2. Run [`supabase-setup.sql`](supabase-setup.sql). This creates the report table, private attachment bucket, tracking lookup, and admin notifications. It can also upgrade a table created by the earlier setup script.
3. Open **Project Settings → API Keys** and copy the Project URL and publishable key (or legacy `anon` key).
4. Paste those two public client values into [`js/supabase-config.js`](js/supabase-config.js).
5. Publish the updated files to GitHub Pages.

The browser uses only a publishable/anon key. Never put a Supabase secret or `service_role` key in this repository. Row Level Security allows anonymous visitors to insert new reports but not read, update, or delete them. The attachment bucket is private and accepts images up to 2 MB. Review submitted reports from the Supabase dashboard.

## Admin dashboard

Open `admin.html` from the published site. Create staff accounts in Supabase Authentication, then set `app_metadata.role` to `admin` for each authorized user. The dashboard checks this server-issued role and the SQL policies restrict report and notification access to that role. Do not use user-editable `user_metadata` for access decisions. The dashboard supports report filtering, status updates, location mapping, count cards, and incoming-report notifications. Device notifications are optional and requested only when an administrator clicks the notification control.

## Tracking a report

Each database submission receives a private reference number. The public tracking form requires that number and the email address saved with the report. The database returns only the status, department, and submission date; it never exposes the report description or contact details through the lookup function. Tracking works after the SQL setup is applied and the Supabase URL and publishable key are configured.

## AI guidance

The optional assistant gives general guidance for the selected report category or service. To protect citizen privacy, the site sends only predefined category/service identifiers and the interface language. It does not send report descriptions, free-form questions, locations, photos, names, or contact details. The edge function also limits each IP to 12 requests per hour and rejects calls from other website origins.

To enable it:

1. In Supabase, set `OPENAI_API_KEY` under **Edge Functions → Secrets**. Optionally set `OPENAI_MODEL`; the default is `gpt-6.2-sol`.
2. Keep the key in Supabase only. Never put it in `js/supabase-config.js`, the browser, or GitHub.
3. From the project folder, sign in and link the Supabase CLI to this project, then deploy with `supabase functions deploy citizen-ai`.
4. The function uses Supabase's injected service role key only on the server for rate limiting.

OpenAI API use may incur separate usage charges. The assistant provides general guidance, not official government requirements; confirm current fees, dates, and documents with the responsible institution.

Until the project URL and publishable key are configured, reports use the existing email delivery fallback. Supabase must be configured before reports are stored in the database.
