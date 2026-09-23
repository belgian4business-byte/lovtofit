import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../theme/app_theme.dart';

const _trialUrl = 'http://localhost:3000/subscriptions/trial';

const _months = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

String _formatDate(DateTime dateTime) {
  final local = dateTime.toLocal();
  return '${local.day} ${_months[local.month - 1]}';
}

/// Vergrendelde Premium-teaser binnen een tab (CLAUDE.md: "premium tonen via
/// vergrendelde teasers binnen de tabs", geen aparte Premium-tab). Bron:
/// blueprint v2.19.13 — geen "ACCESS DENIED", maar uitleggen wat de functie
/// oplevert, met een rustige "Ontdek Premium"-knop. De rest van het scherm
/// blijft gewoon bruikbaar.
///
/// Of iets vergrendeld is, beslist altijd de backend; deze kaart toont
/// alleen wat de backend al besloten heeft (v2.19.22).
class PremiumTeaserCard extends StatelessWidget {
  const PremiumTeaserCard({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    required this.accessToken,
    required this.onPremiumActivated,
  });

  final IconData icon;
  final String title;

  /// De uitleg komt uit de backend (AI Coach-tekst), zodat de toon op één
  /// plek bepaald wordt.
  final String message;

  final String accessToken;

  /// Na het starten van de proefperiode: het scherm haalt zijn data opnieuw
  /// op, zodat de backend nu de ontgrendelde inhoud teruggeeft.
  final VoidCallback onPremiumActivated;

  Future<void> _discoverPremium(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final trialEndsAt = await showPremiumInfoSheet(context, accessToken: accessToken);
    if (trialEndsAt == null) return;

    onPremiumActivated();
    // v2.19.12: rustig melden, en meteen zeggen wat er na afloop gebeurt.
    messenger.showSnackBar(
      SnackBar(
        content: Text(
          'Je Premium-proefperiode loopt tot ${_formatDate(trialEndsAt)}. '
          'Daarna ga je gewoon terug naar Free — je gegevens blijven bewaard.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20, color: AppColors.textSecondary),
                const SizedBox(width: 12),
                Expanded(child: Text(title, style: textTheme.titleMedium)),
                const _PremiumBadge(),
              ],
            ),
            const SizedBox(height: 8),
            Text(message, style: textTheme.bodyMedium),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                ),
                onPressed: () => _discoverPremium(context),
                child: const Text('Ontdek Premium'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PremiumBadge extends StatelessWidget {
  const _PremiumBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.highlight.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock_outline, size: 14, color: AppColors.highlight),
          SizedBox(width: 4),
          Text(
            'Premium',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.highlight),
          ),
        ],
      ),
    );
  }
}

/// Uitleg over Premium (belofte uit blueprint v1.1.21: "Jij traint. Wij
/// denken mee.") met de mogelijkheid om 7 dagen gratis te proberen
/// (v2.19.12, Fase 6 stap 5 — nog zonder echte betaling). Noemt alleen wat
/// Premium nú echt doet. Geeft de einddatum van de proefperiode terug als
/// die gestart is, anders `null`.
Future<DateTime?> showPremiumInfoSheet(BuildContext context, {required String accessToken}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    // Standaard is een bottom sheet max. ~half scherm hoog; deze inhoud is
    // langer, dus laten meegroeien (en scrollen op kleine schermen).
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => _PremiumInfoSheet(accessToken: accessToken),
  );
}

class _PremiumInfoSheet extends StatefulWidget {
  const _PremiumInfoSheet({required this.accessToken});

  final String accessToken;

  @override
  State<_PremiumInfoSheet> createState() => _PremiumInfoSheetState();
}

class _PremiumInfoSheetState extends State<_PremiumInfoSheet> {
  bool _isStarting = false;
  String? _errorMessage;

  Future<void> _startTrial() async {
    setState(() {
      _isStarting = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .post(Uri.parse(_trialUrl), headers: {'Authorization': 'Bearer ${widget.accessToken}'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (mounted) Navigator.of(context).pop(DateTime.parse(body['expiresAt'] as String));
        return;
      }
      // 409: proefperiode al eens gebruikt — de backend-tekst is al
      // gebruiksvriendelijk ("Je hebt de gratis proefperiode al gebruikt.").
      final message = response.statusCode == 409
          ? (jsonDecode(response.body) as Map<String, dynamic>)['message'] as String?
          : null;
      setState(() => _errorMessage = message ?? 'Activeren is niet gelukt. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Premium', style: textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text('Jij traint. Wij denken mee.', style: textTheme.titleMedium?.copyWith(color: AppColors.highlight)),
            const SizedBox(height: 16),
            const ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(Icons.local_fire_department_outlined),
              title: Text('Persoonlijk caloriedoel'),
              subtitle: Text('Een richtwaarde als range, afgestemd op je doel en je gewicht.'),
            ),
            const SizedBox(height: 8),
            Text(
              'Je trainingen, geschiedenis, gewicht en water blijven altijd gratis. '
              'Na 7 dagen ga je vanzelf terug naar Free — er wordt niets afgeschreven.',
              style: textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            if (_errorMessage != null) ...[
              Text(_errorMessage!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 12),
            ],
            AppGradientButton(
              onPressed: _isStarting ? null : _startTrial,
              child: _isStarting
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Probeer 7 dagen gratis'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: _isStarting ? null : () => Navigator.of(context).pop(),
              child: const Text('Niet nu'),
            ),
          ],
        ),
      ),
    );
  }
}
