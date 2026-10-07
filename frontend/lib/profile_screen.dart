import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'profile_edit_screen.dart';
import 'profile_options.dart';

/// Profiel-scherm (CLAUDE.md Fase 10, stap 1), bereikbaar via het tandwiel
/// rechtsboven. Toont wat de gebruiker in de onboarding koos
/// (`GET /onboarding`) plus het e-mailadres. Aanpassen via
/// [ProfileEditScreen] (stap 2). Stap 3: abonnement (`GET /features`, de
/// backend bepaalt het plan) en kerncijfers (`GET /motivation/status`).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _profileUrl = '$apiBaseUrl/onboarding';
  static const _featuresUrl = '$apiBaseUrl/features';
  static const _motivationUrl = '$apiBaseUrl/motivation/status';

  bool _isLoading = true;
  String? _errorMessage;
  String _email = '';
  List<String> _goals = [];
  Map<String, dynamic>? _preferences;
  String _plan = 'FREE';
  Map<String, dynamic>? _subscription;
  // null = (nog) geen cijfers, bv. onboarding niet afgerond.
  int? _totalSessions;
  int _streakWeeks = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final headers = {'Authorization': 'Bearer ${widget.accessToken}'};
      final responses = await Future.wait([
        for (final url in [_profileUrl, _featuresUrl, _motivationUrl])
          http.get(Uri.parse(url), headers: headers).timeout(const Duration(seconds: 5)),
      ]);
      final profileResponse = responses[0];
      final featuresResponse = responses[1];
      final motivationResponse = responses[2];

      // 404 op motivation = onboarding nog niet afgerond: dan geen cijfers.
      final motivationOk = motivationResponse.statusCode == 200 || motivationResponse.statusCode == 404;
      if (profileResponse.statusCode != 200 || featuresResponse.statusCode != 200 || !motivationOk) {
        setState(() => _errorMessage = 'Kon je profiel niet ophalen.');
        return;
      }

      final body = jsonDecode(profileResponse.body) as Map<String, dynamic>;
      final features = jsonDecode(featuresResponse.body) as Map<String, dynamic>;
      final motivation = motivationResponse.statusCode == 200
          ? jsonDecode(motivationResponse.body) as Map<String, dynamic>
          : null;
      setState(() {
        _email = body['email'] as String;
        _goals = (body['goals'] as List).cast<String>();
        _preferences = body['preferences'] as Map<String, dynamic>?;
        _plan = features['plan'] as String;
        _subscription = features['subscription'] as Map<String, dynamic>?;
        _totalSessions = motivation?['totalSessionsCompleted'] as int?;
        _streakWeeks = (motivation?['consistencyStreakWeeks'] as int?) ?? 0;
      });
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _edit(Map<String, dynamic> preferences) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ProfileEditScreen(
          accessToken: widget.accessToken,
          initial: ProfileChoices(
            goals: _goals.toSet(),
            location: preferences['location'] as String,
            equipment: (preferences['equipment'] as List).cast<String>().toSet(),
            sessionDuration: preferences['sessionDuration'] as String,
            weeklyFrequency: preferences['weeklyFrequency'] as int,
            level: preferences['level'] as String,
          ),
        ),
      ),
    );
    if (saved != true || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profiel opgeslagen')));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profiel')),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error, color: Theme.of(context).colorScheme.error, size: 48),
              const SizedBox(height: 16),
              Text(_errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Opnieuw proberen')),
              const SizedBox(height: 8),
              // Ook zonder verbinding moet je kunnen uitloggen.
              _buildLogoutButton(),
            ],
          ),
        ),
      );
    }

    final preferences = _preferences;
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildCard(context, 'Account', Icons.person_outline, [
            _Field('E-mail', _email),
          ]),
          const SizedBox(height: 12),
          _buildCard(context, 'Abonnement', Icons.workspace_premium_outlined, _subscriptionFields()),
          if (_totalSessions != null) ...[
            const SizedBox(height: 12),
            _buildCard(context, 'Jouw cijfers', Icons.insights_outlined, [
              _Field('Totaal trainingen', '$_totalSessions'),
              _Field(
                'Streak',
                _streakWeeks > 0
                    ? '🔥 $_streakWeeks ${_streakWeeks == 1 ? 'week' : 'weken'} op rij op schema'
                    : 'Nog geen streak — elke training telt',
              ),
            ]),
          ],
          const SizedBox(height: 12),
          _buildCard(context, 'Doel', Icons.flag_outlined, [
            _Field(
              _goals.length == 1 ? 'Je doel' : 'Je doelen',
              _goals.isEmpty
                  ? 'Nog geen doel gekozen'
                  : _goals.map((goal) => labelFor(goalOptions, goal)).join(', '),
            ),
          ]),
          const SizedBox(height: 12),
          if (preferences == null)
            _buildCard(context, 'Training', Icons.fitness_center, const [
              _Field('Voorkeuren', 'Je hebt de onboarding nog niet afgerond.'),
            ])
          else
            _buildCard(context, 'Training', Icons.fitness_center, [
              _Field(
                'Locatie',
                labelFor(locationOptions, preferences['location'] as String, extra: extraLocationLabels),
              ),
              _Field(
                'Apparatuur',
                (preferences['equipment'] as List)
                    .cast<String>()
                    .map((item) => labelFor(equipmentOptions, item))
                    .join(', '),
              ),
              _Field('Frequentie', labelFor(frequencyOptions, preferences['weeklyFrequency'] as int)),
              _Field('Duur per training', labelFor(durationOptions, preferences['sessionDuration'] as String)),
              _Field('Niveau', labelFor(levelOptions, preferences['level'] as String)),
            ]),
          if (preferences != null) ...[
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => _edit(preferences),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Profiel aanpassen'),
            ),
          ],
          const SizedBox(height: 12),
          _buildLogoutButton(),
        ],
      ),
    );
  }

  Widget _buildLogoutButton() {
    return TextButton.icon(
      onPressed: _confirmLogout,
      icon: const Icon(Icons.logout),
      label: const Text('Uitloggen'),
    );
  }

  /// Uitloggen (Fase 10, stap 4): het token staat alleen in het geheugen,
  /// dus terug naar het eerste scherm (inloggen) = uitgelogd.
  Future<void> _confirmLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Uitloggen?'),
        content: const Text('Je kunt altijd weer inloggen; je gegevens blijven bewaard.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuleren')),
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Uitloggen')),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  // Wat de backend besliste, alleen in woorden: de app rekent zelf niets uit.
  List<_Field> _subscriptionFields() {
    final subscription = _subscription;
    if (_plan != 'PREMIUM' || subscription == null) {
      return const [_Field('Plan', 'Free')];
    }
    final expiresAt = subscription['expiresAt'] as String?;
    final until = expiresAt == null ? null : formatProfileDate(DateTime.parse(expiresAt));
    switch (subscription['status']) {
      case 'TRIAL':
        return [const _Field('Plan', 'Premium (proefperiode)'), _Field('Proefperiode loopt tot', until ?? '—')];
      case 'CANCELLED':
        return [const _Field('Plan', 'Premium (opgezegd)'), _Field('Toegang tot', until ?? '—')];
      default:
        return [
          const _Field('Plan', 'Premium'),
          if (until != null) _Field('Loopt tot', until),
        ];
    }
  }

  Widget _buildCard(BuildContext context, String title, IconData icon, List<_Field> fields) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 12),
                Text(title, style: textTheme.titleMedium),
              ],
            ),
            for (final field in fields) ...[
              const SizedBox(height: 12),
              Text(field.label, style: textTheme.bodySmall),
              const SizedBox(height: 2),
              Text(field.value, style: textTheme.bodyLarge),
            ],
          ],
        ),
      ),
    );
  }
}

const _months = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/// Bv. "14 okt 2026" (lokale tijd).
String formatProfileDate(DateTime dateTime) {
  final local = dateTime.toLocal();
  return '${local.day} ${_months[local.month - 1]} ${local.year}';
}

class _Field {
  const _Field(this.label, this.value);

  final String label;
  final String value;
}
