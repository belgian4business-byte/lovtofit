import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

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

class _CoachEntry {
  const _CoachEntry({required this.message, required this.timestamp});

  final String message;
  final DateTime? timestamp;
}

/// Coach-tab (CLAUDE.md Fase 4, stap 2): toont de AI Coach-berichten die
/// de engines al berekenen — het bericht bij de training van vandaag
/// (`GET /workouts/today`) en de bewaarde berichten bij eerdere sessies
/// (`GET /workouts/sessions`). Puur weergave; de tekst zelf komt
/// volledig van de (deterministische) AiCoachService in de backend.
class CoachScreen extends StatefulWidget {
  const CoachScreen({super.key, required this.accessToken, this.isActive = true});

  final String accessToken;

  /// Of dit tabblad op dit moment zichtbaar is. Zie de toelichting bij
  /// ProgressScreen.isActive — zelfde reden, zelfde oplossing.
  final bool isActive;

  @override
  State<CoachScreen> createState() => _CoachScreenState();
}

class _CoachScreenState extends State<CoachScreen> {
  static const _todayUrl = 'http://localhost:3000/workouts/today';
  static const _sessionsUrl = 'http://localhost:3000/workouts/sessions';

  bool _isLoading = true;
  String? _errorMessage;
  String? _todayMessage;
  List<_CoachEntry> _history = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant CoachScreen oldWidget) {
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
        http.get(Uri.parse(_todayUrl), headers: headers).timeout(const Duration(seconds: 5)),
        http.get(Uri.parse(_sessionsUrl), headers: headers).timeout(const Duration(seconds: 5)),
      ]);

      final todayResponse = responses[0];
      final sessionsResponse = responses[1];

      if (todayResponse.statusCode != 200 || sessionsResponse.statusCode != 200) {
        setState(() => _errorMessage = 'Kon je coach-berichten niet ophalen.');
        return;
      }

      final todayBody = jsonDecode(todayResponse.body) as Map<String, dynamic>;
      final sessions = (jsonDecode(sessionsResponse.body) as List).cast<Map<String, dynamic>>();

      setState(() {
        _todayMessage = todayBody['coachMessage'] as String?;
        _history = sessions
            .where((session) => session['coachMessage'] != null)
            .map(
              (session) => _CoachEntry(
                message: session['coachMessage'] as String,
                timestamp: DateTime.parse(session['completedAt'] as String),
              ),
            )
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
          if (_todayMessage != null) _buildCoachCard(context, label: 'Vandaag', message: _todayMessage!),
          for (final entry in _history)
            _buildCoachCard(
              context,
              label: entry.timestamp != null ? _formatDate(entry.timestamp!) : null,
              message: entry.message,
            ),
          if (_todayMessage == null && _history.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 48),
              child: Center(
                child: Text(
                  'Nog geen coach-berichten. Rond een training af om hier feedback te zien.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildCoachCard(BuildContext context, {String? label, required String message}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.chat_bubble_outline, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (label != null) ...[
                    Text(label, style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 4),
                  ],
                  Text(message, style: Theme.of(context).textTheme.bodyLarge),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
