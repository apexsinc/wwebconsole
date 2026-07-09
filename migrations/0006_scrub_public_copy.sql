-- Soften public marketing copy: no infrastructure vendor details

UPDATE app_settings SET value = 'Built for Davis WeatherLink stations.', updated_at = strftime('%s','now') * 1000
WHERE key = 'site_footer_text';

UPDATE app_settings SET value = 'WWebConsole is a web console for Davis WeatherLink stations. Live dashboard, TV share links, and private WeatherLink credentials — free to start.', updated_at = strftime('%s','now') * 1000
WHERE key = 'site_description';

UPDATE app_settings SET value = 'WeatherLink, Davis Instruments, weather console, weather dashboard, weather station display, TV weather display', updated_at = strftime('%s','now') * 1000
WHERE key = 'site_keywords';

UPDATE app_settings SET value = 'Live WeatherLink dashboard and TV share links. Start free.', updated_at = strftime('%s','now') * 1000
WHERE key = 'seo_home_description';

UPDATE app_settings SET value = 'Live weather dashboard, WeatherLink connection, TV share URLs, and account tools.', updated_at = strftime('%s','now') * 1000
WHERE key = 'seo_features_description';

UPDATE app_settings SET value = 'Free trial, then yearly per-device pricing for WeatherLink Pro stations.', updated_at = strftime('%s','now') * 1000
WHERE key = 'seo_pricing_description';

UPDATE app_settings SET value = 'WWebConsole is a simple web console for Davis WeatherLink stations.', updated_at = strftime('%s','now') * 1000
WHERE key = 'seo_about_description';

UPDATE app_settings SET value = 'A simple web console for Davis WeatherLink. Live dashboard and TV share links — start free.', updated_at = strftime('%s','now') * 1000
WHERE key = 'home_hero_subhead';

UPDATE app_settings SET value = '[{"title":"Live dashboard","body":"Temperature, wind, rain, pressure, and sun times from your WeatherLink station."},{"title":"TV share links","body":"Fullscreen public URLs for lobbies, offices, and wall displays."},{"title":"Secure credentials","body":"Connect with your WeatherLink API credentials. Your keys stay private to your account."},{"title":"Works in the browser","body":"Open your console from any device — no software to install on site."}]', updated_at = strftime('%s','now') * 1000
WHERE key = 'home_features_json';

UPDATE app_settings SET value = 'Try free, then pay per device when you need continuous Pro updates.', updated_at = strftime('%s','now') * 1000
WHERE key = 'pricing_subhead';

UPDATE app_settings SET value = 'Free trial access with Basic WeatherLink update rates. Perfect to evaluate the console.', updated_at = strftime('%s','now') * 1000
WHERE key = 'pricing_basic_blurb';

UPDATE app_settings SET value = 'Yearly per device for WeatherLink Pro stations. Faster updates and continuous access after the trial.', updated_at = strftime('%s','now') * 1000
WHERE key = 'pricing_pro_blurb';

UPDATE app_settings SET value = 'Paid plans require a WeatherLink Pro subscription from Davis. Contact support if you need help activating a device.', updated_at = strftime('%s','now') * 1000
WHERE key = 'pricing_footnote';

UPDATE app_settings SET value = 'WWebConsole is a web console for Davis WeatherLink stations. Monitor your station from any browser, share a display link for TVs and lobbies, and keep your WeatherLink credentials private to your account.

We focus on a simple, reliable console — not on running software at your site.', updated_at = strftime('%s','now') * 1000
WHERE key = 'about_body';

UPDATE app_settings SET value = 'Questions about billing, WeatherLink setup, or access? Email us and we will get back to you.', updated_at = strftime('%s','now') * 1000
WHERE key = 'contact_intro';

UPDATE app_settings SET value = '## Overview
WWebConsole (“we”, “us”) provides a web console for Davis WeatherLink stations. This policy explains what we collect and why.

## Account data
We store the information needed to run your account, such as email, optional name, and account status. Verification codes may be stored briefly when email confirmation is required.

## WeatherLink credentials
Credentials you enter are used only to fetch weather data for your account. We do not sell your data.

## Service data
We store station settings, display preferences, share links you create, and billing or trial information needed to provide the service.

## Cookies
We use a sign-in cookie to keep you logged in. Theme preference may be stored in your browser.

## Retention & deletion
You can request account deletion from Account settings. After a short grace period, account data is removed. Contact support if you need help sooner.

## Contact
Email the address on the Contact page for privacy requests.', updated_at = strftime('%s','now') * 1000
WHERE key = 'privacy_body';

UPDATE app_settings SET value = '## Agreement
By using WWebConsole you agree to these terms.

## Service
We provide a best-effort web console for WeatherLink data. WeatherLink and Davis Instruments are separate products; their availability and plans are outside our control.

## Accounts
You are responsible for your password and for activity under your account. Do not use credentials you are not authorized to use.

## Billing
Free trial length and yearly pricing are shown on the Pricing page and may change. Paid device access may require WeatherLink Pro. Refunds are handled case-by-case.

## Acceptable use
Do not abuse the service, attempt unauthorized access, or use share links for unlawful content.

## Disclaimer
The service is provided “as is” without warranties. We are not liable for weather data accuracy, third-party outages, or consequential damages to the extent permitted by law.

## Changes
We may update these terms; continued use after changes constitutes acceptance.

## Contact
Use the Contact page for legal or billing questions.', updated_at = strftime('%s','now') * 1000
WHERE key = 'terms_body';

UPDATE app_settings SET value = '## Recent
- Marketing site and product pages
- Account email and password change
- Account deletion with a short grace period
- Light and dark appearance
- WeatherLink credential setup improvements

## Earlier
- Web console for WeatherLink stations
- Free trial and yearly per-device plans
- TV share links
- Account sign-in and verification', updated_at = strftime('%s','now') * 1000
WHERE key = 'changelog_body';
