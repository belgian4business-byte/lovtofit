import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

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

/// Basis Progress-scherm (CLAUDE.md Fase 2, stap 7): toont de opgeslagen
/// trainingssessies van de gebruiker. Bewust eenvoudig — geen grafieken of
/// trends, dat komt pas in een latere fase.
class ProgressScreen extends StatefulWidget {
  const ProgressScreen({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  static const _sessionsUrl = 'http://localhost:3000/workouts/sessions';

  bool _isLoading = true;
  String? _errorMessage;
  List<ProgressSession> _sessions = [];

  @override
  void initState() {
    super.initState();
    _loadSessions();
  }

  Future<void> _loadSessions() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .get(
            Uri.parse(_sessionsUrl),
            headers: {'Authorization': 'Bearer ${widget.accessToken}'},
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as List;
        setState(() {
          _sessions = body.cast<Map<String, dynamic>>().map((session) {
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
        });
        return;
      }

      setState(() => _errorMessage = 'Kon je trainingen niet ophalen.');
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Progress')),
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
              OutlinedButton(onPressed: _loadSessions, child: const Text('Opnieuw proberen')),
            ],
          ),
        ),
      );
    }

    if (_sessions.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
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
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSessions,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _sessions.length,
        itemBuilder: (context, index) {
          final session = _sessions[index];
          return Card(
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
          );
        },
      ),
    );
  }
}
