import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'widgets/settings_menu_button.dart';

const _months = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

String _formatDate(DateTime dateTime) {
  final local = dateTime.toLocal();
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '${local.day} ${_months[local.month - 1]} ${local.year}, $hour:$minute';
}

class ProgressSession {
  const ProgressSession({
    required this.templateName,
    required this.completedAt,
    required this.exerciseNames,
    required this.setCount,
  });

  final String templateName;
  final DateTime completedAt;
  final List<String> exerciseNames;
  final int setCount;
}

/// Basis Progress-scherm (CLAUDE.md Fase 2, stap 7; uitgebreid in Fase 4,
/// stap 5): toont de opgeslagen trainingssessies van de gebruiker, plus
/// (nieuw) de mijlpalen en het motivatiesignaal uit de Motivation Engine
/// (`GET /motivation/status`). Pure weergave — de tekst komt uit de
/// (deterministische) AiCoachService, de mijlpalen komen kant-en-klaar uit
/// de engine.
class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key, required this.accessToken, this.isActive = true});

  final String accessToken;

  /// Of dit tabblad op dit moment zichtbaar is. MainShell houdt alle tabs in
  /// leven via een IndexedStack (zodat state bewaard blijft), maar dat
  /// betekent dat initState() maar één keer draait — meteen bij het opstarten
  /// van de app. Zonder dit signaal zou een net afgeronde training dus nooit
  /// in Progress verschijnen totdat de gebruiker handmatig ververst.
  final bool isActive;

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  static const _sessionsUrl = '$apiBaseUrl/workouts/sessions';
  static const _motivationUrl = '$apiBaseUrl/motivation/status';

  bool _isLoading = true;
  String? _errorMessage;
  List<ProgressSession> _sessions = [];
  String? _motivationMessage;
  List<int> _milestonesReached = [];
  int? _nextMilestone;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ProgressScreen oldWidget) {
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
        http.get(Uri.parse(_sessionsUrl), headers: headers).timeout(const Duration(seconds: 5)),
        http.get(Uri.parse(_motivationUrl), headers: headers).timeout(const Duration(seconds: 5)),
      ]);

      final sessionsResponse = responses[0];
      final motivationResponse = responses[1];

      if (sessionsResponse.statusCode != 200 || motivationResponse.statusCode != 200) {
        setState(() => _errorMessage = 'Kon je voortgang niet ophalen.');
        return;
      }

      final sessionsBody = jsonDecode(sessionsResponse.body) as List;
      final motivation = jsonDecode(motivationResponse.body) as Map<String, dynamic>;

      setState(() {
        _sessions = sessionsBody.cast<Map<String, dynamic>>().map((session) {
          final sets = (session['sets'] as List).cast<Map<String, dynamic>>();
          final exerciseNames = sets
              .map((set) => set['exerciseName'] as String)
              .toSet()
              .toList();
          return ProgressSession(
            templateName: session['templateName'] as String,
            completedAt: DateTime.parse(session['completedAt'] as String),
            exerciseNames: exerciseNames,
            setCount: sets.length,
          );
        }).toList();

        _motivationMessage = motivation['coachMessage'] as String?;
        _milestonesReached = (motivation['milestonesReached'] as List).cast<int>();
        _nextMilestone = motivation['nextMilestone'] as int?;
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
          if (_motivationMessage != null) _buildMotivationCard(context),
          const SizedBox(height: 12),
          _buildMilestonesCard(context),
          const SizedBox(height: 20),
          Text('Trainingen', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_sessions.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(Icons.timeline, size: 48, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 16),
                  Text(
                    'Nog geen trainingen gelogd.\nRond je eerste training af om hem hier te zien.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                ],
              ),
            )
          else
            for (final session in _sessions)
              Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.templateName,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _formatDate(session.completedAt),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      Text('${session.setCount} sets · ${session.exerciseNames.join(', ')}'),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Widget _buildMotivationCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.trending_up, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Text(_motivationMessage!, style: Theme.of(context).textTheme.bodyLarge),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMilestonesCard(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Mijlpalen', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            if (_milestonesReached.isEmpty)
              Text(
                'Nog geen mijlpaal gehaald.',
                style: Theme.of(context).textTheme.bodyMedium,
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final milestone in _milestonesReached)
                    Chip(
                      avatar: const Icon(Icons.emoji_events, size: 18, color: Colors.amber),
                      label: Text('$milestone'),
                    ),
                ],
              ),
            if (_nextMilestone != null) ...[
              const SizedBox(height: 8),
              Text(
                'Eerstvolgende mijlpaal: $_nextMilestone trainingen',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
