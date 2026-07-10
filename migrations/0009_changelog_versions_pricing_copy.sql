-- Public changelog: version labels only, simple product language (no infra jargon).
UPDATE app_settings SET value = '## [1.5.0]
- Prices show in your local currency based on where you visit from
- Show or hide password on sign-in and account forms
- Contact form on the website
- Security check on sign-in and register forms fixed

## [1.4.0]
- Stronger account protection
- Public website pages
- Console at /app

## [1.3.0]
- Light and dark appearance
- Change email and password
- Account deletion with a short waiting period

## [1.2.0]
- Admin site for user and billing help
- Free trial, then yearly plan per device
- Sign-in protection when enabled

## [1.1.0]
- Live WeatherLink dashboard
- TV share links
- Account sign-in
', updated_at = strftime('%s','now') * 1000
WHERE key = 'changelog_body';
