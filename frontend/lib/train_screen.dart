import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'theme/app_theme.dart';
import 'widgets/premium_teaser_card.dart';
import 'widgets/settings_menu_button.dart';
import 'workout_models.dart';
import 'workout_screen.dart';

// Alleen 10 en 15 min: bij 20 min zit de Quick Session al op zijn maximum
// (4 bewegingen × 3 sets, ~14 min) — dat zou dezelfde training zijn als
// 15 min (CLAUDE.md Fase 7, stap 2/3).
const _quickSessionMinuteOptions = [10, 15];

List<WorkoutExercise> _parseExercises(List<dynamic> slots) {
  return slots.cast<Map<String, dynamic>>().map((slot) {
    final exercise = slot['exercise'] as Map<String, dynamic>;
    return WorkoutExercise(
      id: exercise['id'] as String,
      name: exercise['name'] as String,
      equipment: exercise['equipment'] as String,
      targetSets: slot['targetSets'] as int,
      targetReps: slot['targetReps'] as int,
    );
  }).toList();
}

class _QuickSession {
  const _QuickSession({
    required this.templateId,
    required this.estimatedMinutes,
    required this.restSeconds,
    required this.coachMessage,
    required this.exercises,
  });

  final String templateId;
  final int estimatedMinutes;
  final int restSeconds;
  final String coachMessage;
  final List<WorkoutExercise> exercises;
}

/// Train-tab: "Wat moet ik vandaag doen?" — toont de training van vandaag
/// (Decision Engine) met een Start-knop. Voorheen het Home-scherm; nu
/// verplaatst naar de Train-tab (CLAUDE.md Fase 4, stap 1).
///
/// Fase 7, stap 3: onder de hoofdactie een rustige tweede optie "Weinig
/// tijd? Quick Session" met een tijdkeuze (10/15 min). De ingekorte
/// training (`GET /workouts/quick-session`) vervangt dan tijdelijk de kaart,
/// met een weg terug naar de normale training.
class TrainScreen extends StatefulWidget {
  const TrainScreen({super.key, required this.accessToken, required this.email});

  final String accessToken;
  final String email;

  @override
  State<TrainScreen> createState() => _TrainScreenState();
}

class _TrainScreenState extends State<TrainScreen> {
  static const _todayUrl = 'http://localhost:3000/workouts/today';
  static const _quickSessionUrl = 'http://localhost:3000/workouts/quick-session';

  bool _isLoading = true;
  String? _errorMessage;
  String? _templateId;
  String? _templateName;
  List<WorkoutExercise> _exercises = [];

  bool _isLoadingQuickSession = false;
  _QuickSession? _quickSession;
  int? _lastQuickSessionMinutes;

  /// Uitleg van de backend bij `PREMIUM_REQUIRED` — dan staat er een
  /// vergrendelde teaser i.p.v. de Quick Session-knop.
  String? _quickSessionLockedMessage;

  @override
  void initState() {
    super.initState();
    _loadTodaysWorkout();
  }

  Future<void> _loadTodaysWorkout() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .get(
            Uri.parse(_todayUrl),
            headers: {'Authorization': 'Bearer ${widget.accessToken}'},
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _templateId = body['templateId'] as String;
          _templateName = body['templateName'] as String;
          _exercises = _parseExercises(body['slots'] as List);
        });
        return;
      }

      setState(() => _errorMessage = 'Kon de training van vandaag niet ophalen.');
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _chooseQuickSession() async {
    final minutes = await showModalBottomSheet<int>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Hoeveel tijd heb je vandaag?', style: Theme.of(sheetContext).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                'We kiezen de belangrijkste bewegingen, met kortere rust.',
                style: Theme.of(sheetContext).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  for (final option in _quickSessionMinuteOptions) ...[
                    if (option != _quickSessionMinuteOptions.first) const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(sheetContext).pop(option),
                        child: Text('$option min'),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (minutes != null) await _loadQuickSession(minutes);
  }

  Future<void> _loadQuickSession(int minutes) async {
    final messenger = ScaffoldMessenger.of(context);
    setState(() {
      _isLoadingQuickSession = true;
      _lastQuickSessionMinutes = minutes;
    });

    try {
      final response = await http
          .get(
            Uri.parse('$_quickSessionUrl?minutes=$minutes'),
            headers: {'Authorization': 'Bearer ${widget.accessToken}'},
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        if (body['status'] == 'AVAILABLE') {
          setState(() {
            _quickSessionLockedMessage = null;
            _quickSession = _QuickSession(
              templateId: body['templateId'] as String,
              estimatedMinutes: body['estimatedMinutes'] as int,
              restSeconds: body['restSeconds'] as int,
              coachMessage: body['coachMessage'] as String,
              exercises: _parseExercises(body['slots'] as List),
            );
          });
          return;
        }
        // PREMIUM_REQUIRED (Fase 7, stap 4): vergrendelde teaser op het
        // moment dat de gebruiker er echt om vraagt (v1.1.16) — de normale
        // training blijft gewoon bruikbaar.
        setState(() => _quickSessionLockedMessage = body['coachMessage'] as String? ?? '');
        return;
      }
      messenger.showSnackBar(const SnackBar(content: Text('Kon de Quick Session niet ophalen.')));
    } catch (_) {
      messenger.showSnackBar(const SnackBar(content: Text('Kan geen verbinding maken met de server.')));
    } finally {
      if (mounted) setState(() => _isLoadingQuickSession = false);
    }
  }

  void _startTraining() {
    final quickSession = _quickSession;
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkoutScreen(
          accessToken: widget.accessToken,
          templateId: quickSession?.templateId ?? _templateId!,
          exercises: quickSession?.exercises ?? _exercises,
          restSeconds: quickSession?.restSeconds ?? 45,
        ),
      ),
    );
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
          constraints: const BoxConstraints(maxWidth: 400),
          // Scrollbaar: met de Premium-teaser eronder past het niet altijd
          // meer op een klein scherm.
          child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: _buildBody(context)),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_errorMessage != null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error, color: Theme.of(context).colorScheme.error, size: 48),
          const SizedBox(height: 16),
          Text(_errorMessage!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: _loadTodaysWorkout, child: const Text('Opnieuw proberen')),
        ],
      );
    }

    final quickSession = _quickSession;
    if (quickSession != null) {
      return _buildQuickSession(context, quickSession);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Goedemorgen', style: Theme.of(context).textTheme.bodyLarge),
        Text(widget.email, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 24),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'JOUW TRAINING VANDAAG',
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(letterSpacing: 1.1),
                ),
                const SizedBox(height: 8),
                Text(_templateName ?? '', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 4),
                Text(
                  '${_exercises.length} oefeningen',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                for (final exercise in _exercises)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text('•  ${exercise.name}'),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        AppGradientButton(onPressed: _startTraining, child: const Text('START TRAINING')),
        const SizedBox(height: 12),
        if (_quickSessionLockedMessage != null)
          PremiumTeaserCard(
            icon: Icons.bolt,
            title: 'Quick Session',
            message: _quickSessionLockedMessage!,
            accessToken: widget.accessToken,
            // Na het starten van de proefperiode meteen de gekozen Quick
            // Session ophalen — de gebruiker hoeft niet opnieuw te kiezen.
            onPremiumActivated: () => _loadQuickSession(_lastQuickSessionMinutes ?? _quickSessionMinuteOptions.first),
          )
        else
          // Tweede, rustige optie — de normale training blijft de hoofdactie.
          TextButton.icon(
            onPressed: _isLoadingQuickSession ? null : _chooseQuickSession,
            icon: _isLoadingQuickSession
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.bolt),
            label: const Text('Weinig tijd? Quick Session'),
          ),
      ],
    );
  }

  Widget _buildQuickSession(BuildContext context, _QuickSession quickSession) {
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.bolt, size: 18, color: AppColors.highlight),
                    const SizedBox(width: 6),
                    Text(
                      'QUICK SESSION · ~${quickSession.estimatedMinutes} MIN',
                      style: textTheme.labelLarge?.copyWith(letterSpacing: 1.1, color: AppColors.highlight),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(quickSession.coachMessage, style: textTheme.bodyMedium),
                const SizedBox(height: 16),
                for (final exercise in quickSession.exercises)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
                    child: Text('•  ${exercise.name}  ·  ${exercise.targetSets}×${exercise.targetReps}'),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 24),
        AppGradientButton(onPressed: _startTraining, child: const Text('START QUICK SESSION')),
        const SizedBox(height: 12),
        TextButton(
          onPressed: () => setState(() => _quickSession = null),
          child: const Text('Terug naar je normale training'),
        ),
      ],
    );
  }
}
