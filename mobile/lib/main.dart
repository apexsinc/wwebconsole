import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Deployed web console. The console redirects unauthenticated users to
/// /login on its own (see ProtectedConsole in src/App.tsx), so the app can
/// always start at /app.
const String _consoleUrl = 'https://wwebconsole.com/app';

/// Hosts whose navigations should stay inside the in-app WebView (the
/// console itself, and the embedded Polar checkout iframe / its redirects).
const List<String> _inAppHosts = <String>[
  'wwebconsole.com',
  'polar.sh',
  'sandbox.polar.sh',
  'checkout.polar.sh',
  'stripe.com',
  'js.stripe.com',
  'hooks.stripe.com',
];

void main() {
  runApp(const WWebConsoleApp());
}

class WWebConsoleApp extends StatelessWidget {
  const WWebConsoleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Weatherlink Web Console',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF0EA5E9),
        useMaterial3: true,
      ),
      home: const ConsoleWebView(),
    );
  }
}

class ConsoleWebView extends StatefulWidget {
  const ConsoleWebView({super.key});

  @override
  State<ConsoleWebView> createState() => _ConsoleWebViewState();
}

class _ConsoleWebViewState extends State<ConsoleWebView> {
  late final WebViewController _controller;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFE8EDF3))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _isLoading = true),
          onPageFinished: (_) => setState(() => _isLoading = false),
          onWebResourceError: (error) {
            // Ignore errors from sub-frames/sub-resources; only a failed
            // main-frame load should show the offline/error screen.
            if (error.isForMainFrame ?? true) {
              setState(() {
                _isLoading = false;
                _hasError = true;
              });
            }
          },
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.prevent;

            // Non-http(s) links (mailto:, tel:, intent:, market:, etc.) are
            // handed off to the OS.
            if (uri.scheme != 'http' && uri.scheme != 'https') {
              _launchExternally(uri);
              return NavigationDecision.prevent;
            }

            final isKnownHost = _inAppHosts.any(
              (host) => uri.host == host || uri.host.endsWith('.$host'),
            );
            if (isKnownHost) {
              return NavigationDecision.navigate;
            }

            // Anything else (e.g. a link out to docs, support, socials)
            // opens in the device's browser instead of hijacking the app.
            _launchExternally(uri);
            return NavigationDecision.prevent;
          },
        ),
      )
      ..loadRequest(Uri.parse(_consoleUrl));
  }

  Future<void> _launchExternally(Uri uri) async {
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // Nothing sensible to do if the OS has no handler for this link.
    }
  }

  Future<void> _reload() async {
    setState(() {
      _hasError = false;
      _isLoading = true;
    });
    await _controller.loadRequest(Uri.parse(_consoleUrl));
  }

  Future<bool> _handleBack() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _handleBack();
        if (shouldPop && context.mounted) {
          Navigator.of(context).maybePop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFE8EDF3),
        body: SafeArea(
          child: Stack(
            children: [
              if (!_hasError) WebViewWidget(controller: _controller),
              if (_isLoading && !_hasError)
                const Center(child: CircularProgressIndicator(color: Color(0xFF0EA5E9))),
              if (_hasError) _OfflineView(onRetry: _reload),
            ],
          ),
        ),
      ),
    );
  }
}

class _OfflineView extends StatelessWidget {
  const _OfflineView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 56, color: Color(0xFF64748B)),
            const SizedBox(height: 16),
            const Text(
              "Can't reach the Weatherlink Web Console",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Check your internet connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF0EA5E9)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
