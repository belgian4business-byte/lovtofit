import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'widgets/settings_menu_button.dart';

const _muscleGroupLabels = {
  'CHEST': 'Borst',
  'BACK': 'Rug',
  'SHOULDERS': 'Schouders',
  'ARMS': 'Armen',
  'LEGS_GLUTES': 'Benen & bilspieren',
  'CORE': 'Buik',
  'CARDIO': 'Conditie',
  'MOBILITY': 'Mobiliteit',
};

const _recoveryStatusLabels = {
  'NORMAL': 'Fris',
  'RECENTLY_LOADED': 'Recent belast',
  'RECOVERY': 'Herstellend',
};

const _recoveryStatusColors = {
  'NORMAL': Color(0xFF4CD97B),
  'RECENTLY_LOADED': Color(0xFFF5C542),
  'RECOVERY': Color(0xFF37C6FF),
};

class _RecoveryEntry {
  const _RecoveryEntry({required this.muscleGroup, required this.status});

  final String muscleGroup;
  final String status;
}

/// Home-tab (CLAUDE.md Fase 4, stap 3): toont de consistency-streak
/// (Motivation Engine, `GET /motivation/status`) en de recovery-status per
/// spiergroep (Recovery Engine, `GET /recovery/status`). Pure weergave —
/// beide engines berekenen de cijfers al, dit scherm vertaalt ze alleen
/// naar korte Nederlandse labels.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.accessToken,
    required this.email,
    this.isActive = true,
  });

  final String accessToken;
  final String email;

  /// Zie de toelichting bij ProgressScreen.isActive — zelfde reden
  /// (IndexedStack in MainShell), zelfde oplossing.
  final bool isActive;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _motivationUrl = 'http://localhost:3000/motivation/status';
  static const _recoveryUrl = 'http://localhost:3000/recovery/status';

  bool _isLoading = true;
  String? _errorMessage;
  int _consistencyStreakWeeks = 0;
  int _completedThisWeek = 0;
  int _weeklyTarget = 0;
  List<_RecoveryEntry> _recoveryEntries = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final headers = {'Authorization': 'Bearer ${widget.accessToken}'};
      final responses = await Future.wait([
        http.get(Uri.parse(_motivationUrl), headers: headers).timeout(const Duration(seconds: 5)),
        http.get(Uri.parse(_recoveryUrl), headers: headers).timeout(const Duration(seconds: 5)),
      ]);

      final motivationResponse = responses[0];
      final recoveryResponse = responses[1];

      if (motivationResponse.statusCode != 200 || recoveryResponse.statusCode != 200) {
        setState(() => _errorMessage = 'Kon je gegevens niet ophalen.');
        return;
      }

      final motivation = jsonDecode(motivationResponse.body) as Map<String, dynamic>;
      final recovery = jsonDecode(recoveryResponse.body) as Map<String, dynamic>;
      final byMuscleGroup = (recovery['byMuscleGroup'] as List).cast<Map<String, dynamic>>();

      setState(() {
        _consistencyStreakWeeks = motivation['consistencyStreakWeeks'] as int;
        _completedThisWeek = motivation['completedThisWeek'] as int;
        _weeklyTarget = motivation['weeklyTarget'] as int;
        _recoveryEntries = byMuscleGroup
            .map((entry) => _RecoveryEntry(
                  muscleGroup: entry['key'] as String,
                  status: entry['status'] as String,
                ))
            .toList();
      });
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LOVTOFIT'),
        actions: const [SettingsMenuButton()],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: _buildBody(context),
        ),
      ),
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
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Goedemorgen', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(widget.email, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 20),
          _buildStreakCard(context),
          const SizedBox(height: 12),
          _buildRecoveryCard(context),
        ],
      ),
    );
  }

  Widget _buildStreakCard(BuildContext context) {
    final streakText = _consistencyStreakWeeks > 0
        ? '🔥 $_consistencyStreakWeeks ${_consistencyStreakWeeks == 1 ? 'week' : 'weken'} op rij op schema'
        : 'Nog geen streak — elke training telt';

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Consistentie', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(streakText, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 4),
            Text(
              'Deze week: $_completedThisWeek van de $_weeklyTarget trainingen',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecoveryCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Herstel per spiergroep', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            for (final entry in _recoveryEntries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: _recoveryStatusColors[entry.status],
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _muscleGroupLabels[entry.muscleGroup] ?? entry.muscleGroup,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    Text(
                      _recoveryStatusLabels[entry.status] ?? entry.status,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
