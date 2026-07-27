-- Rebrand to Weatherlink Web Console + trademark disclaimer (independent product).
INSERT INTO app_settings (key, value, updated_at) VALUES
  ('site_trademark_note', 'WeatherLink® and Davis® are registered trademarks of Davis Instruments Corp. Weatherlink Web Console is an independent product and is not affiliated with, endorsed by, or connected to Davis Instruments or WeatherLink.', strftime('%s','now') * 1000)
ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;

UPDATE app_settings SET value = 'Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'site_name';
UPDATE app_settings SET value = 'Your station console, on the web', updated_at = strftime('%s','now') * 1000 WHERE key = 'site_tagline';
UPDATE app_settings SET value = 'Weatherlink Web Console is an independent web console for Davis WeatherLink® stations. Live dashboard, TV share links, and private credentials — free to start. Not affiliated with Davis Instruments.', updated_at = strftime('%s','now') * 1000 WHERE key = 'site_description';
UPDATE app_settings SET value = 'Independent web console for WeatherLink® stations.', updated_at = strftime('%s','now') * 1000 WHERE key = 'site_footer_text';
UPDATE app_settings SET value = 'Weatherlink Web Console — station console for the web', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_home_title';
UPDATE app_settings SET value = 'Live station dashboard and TV share links. Start free. Independent of Davis Instruments.', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_home_description';
UPDATE app_settings SET value = 'Features — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_features_title';
UPDATE app_settings SET value = 'Pricing — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_pricing_title';
UPDATE app_settings SET value = 'About — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_about_title';
UPDATE app_settings SET value = 'An independent web console for WeatherLink® stations. Not affiliated with Davis Instruments.', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_about_description';
UPDATE app_settings SET value = 'Contact — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_contact_title';
UPDATE app_settings SET value = 'Privacy Policy — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_privacy_title';
UPDATE app_settings SET value = 'Terms of Service — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_terms_title';
UPDATE app_settings SET value = 'Changelog — Weatherlink Web Console', updated_at = strftime('%s','now') * 1000 WHERE key = 'seo_changelog_title';
UPDATE app_settings SET value = 'Your station console, on the web', updated_at = strftime('%s','now') * 1000 WHERE key = 'home_hero_headline';
UPDATE app_settings SET value = 'Live dashboard and TV share links for your WeatherLink® station — start free. Independent product, not affiliated with Davis Instruments.', updated_at = strftime('%s','now') * 1000 WHERE key = 'home_hero_subhead';
UPDATE app_settings SET value = 'Paid plans may require a WeatherLink® Pro subscription from Davis Instruments. Contact support if you need help activating a device. We are not affiliated with Davis Instruments.', updated_at = strftime('%s','now') * 1000 WHERE key = 'pricing_footnote';
UPDATE app_settings SET value = 'Weatherlink Web Console is an independent web console for Davis WeatherLink® stations. Monitor your station from any browser, share a display link for TVs and lobbies, and keep your credentials private to your account.

We are not affiliated with, endorsed by, or connected to Davis Instruments Corp. or WeatherLink. WeatherLink® and Davis® are registered trademarks of Davis Instruments Corp.

We focus on a simple, reliable console — not on running software at your site.', updated_at = strftime('%s','now') * 1000 WHERE key = 'about_body';
UPDATE app_settings SET value = '## [1.5.2]
- Branding updated to Weatherlink Web Console
- Clearer trademark disclaimer in the footer
- Darker homepage hero for easier reading

## [1.5.1]
- Homepage showcases the live console with a full-screen product image
- Clearer product story on Features

## [1.5.0]
- Prices show in your local currency based on where you visit from
- Show or hide password on sign-in and account forms
- Contact form on the website

## [1.4.0]
- Stronger account protection
- Public website pages
- Console at /app

## [1.1.0]
- Live station dashboard
- TV share links
- Account sign-in
', updated_at = strftime('%s','now') * 1000 WHERE key = 'changelog_body';
