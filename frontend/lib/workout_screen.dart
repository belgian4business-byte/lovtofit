import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'theme/app_theme.dart';
import 'workout_models.dart';

enum _Phase { logging, resting, exerciseComplete, workoutComplete }

class ProgressionOutcome {
  const ProgressionOutcome({
    required this.exerciseName,
    required this.message,
  });

  final String exerciseName;
  final String message;
}

class LoggedSet {
  const LoggedSet({
    required this.exerciseId,
    required this.exerciseName,
    required this.setNumber,
    required this.reps,
    this.weightKg,
  });

  final String exerciseId;
  final String exerciseName;
  final int setNumber;
  final int reps;
  final double? weightKg;
}

class ExerciseFeedbackEntry {
  const ExerciseFeedbackEntry({
    required this.exerciseId,
    required this.difficulty,
    required this.discomfort,
  });

  final String exerciseId;
  final String difficulty;
  final bool discomfort;
}

// UI-labels volgens CLAUDE.md: Makkelijk/Goed/Zwaar/Te zwaar. "Zwaar" is
// nadrukkelijk iets anders dan ongemak/pijn — dat is een apart signaal
// (blueprint v2.12, sectie 2.12.7).
const _difficultyOptions = {
  '😊 Makkelijk': 'EASY',
  '🙂 Goed': 'GOOD',
  '😐 Zwaar': 'HARD',
  '😣 Te zwaar': 'TOO_HARD',
};

/// Workout-scherm (CLAUDE.md Fase 2, stap 5+6): een set afvinken kost één
/// tik ("SET KLAAR"), daarna automatisch een rusttimer, en na de laatste
/// set van een oefening één tik naar de volgende. Zodra de training is
/// afgerond wordt de hele sessie in één keer opgeslagen via
/// POST /workouts/sessions.
class WorkoutScreen extends StatefulWidget {
  const WorkoutScreen({
    super.key,
    required this.accessToken,
    required this.templateId,
    required this.exercises,
    this.restSeconds = 45,
  });

  final String accessToken;
  final String templateId;
  final List<WorkoutExercise> exercises;

  /// Rust na elke set. Een Quick Session gebruikt kortere rust (30 s, komt
  /// mee van de backend — "beperkte rust", blueprint v0.7.10).
  final int restSeconds;

  @override
  State<WorkoutScreen> createState() => _WorkoutScreenState();
}

class _WorkoutScreenState extends State<WorkoutScreen> {
  static const _sessionsUrl = '$apiBaseUrl/workouts/sessions';

  int _exerciseIndex = 0;
  int _setNumber = 1;
  int _reps = 0;
  double _weightKg = 0;
  _Phase _phase = _Phase.logging;
  late int _remainingRestSeconds = widget.restSeconds;
  Timer? _timer;

  bool _isSaving = false;
  bool _isSaved = false;
  String? _saveError;
  List<ProgressionOutcome> _progressionOutcomes = [];

  String? _difficulty;
  bool? _discomfort;

  final List<LoggedSet> _log = [];
  final List<ExerciseFeedbackEntry> _feedbackLog = [];

  WorkoutExercise get _exercise => widget.exercises[_exerciseIndex];

  @override
  void initState() {
    super.initState();
    _resetSetDefaults();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _resetSetDefaults() {
    _reps = _exercise.targetReps;
    _weightKg = 0;
  }

  void _completeSet() {
    _log.add(
      LoggedSet(
        exerciseId: _exercise.id,
        exerciseName: _exercise.name,
        setNumber: _setNumber,
        reps: _reps,
        weightKg: _exercise.needsWeight ? _weightKg : null,
      ),
    );
    _startRest();
  }

  void _startRest() {
    setState(() {
      _phase = _Phase.resting;
      _remainingRestSeconds = widget.restSeconds;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_remainingRestSeconds <= 1) {
        timer.cancel();
        _onRestFinished();
        return;
      }
      setState(() => _remainingRestSeconds--);
    });
  }

  void _skipRest() {
    _timer?.cancel();
    _onRestFinished();
  }

  void _onRestFinished() {
    if (_setNumber < _exercise.targetSets) {
      setState(() {
        _setNumber++;
        _phase = _Phase.logging;
        _resetSetDefaults();
      });
    } else {
      setState(() => _phase = _Phase.exerciseComplete);
    }
  }

  void _submitFeedbackAndContinue() {
    _feedbackLog.add(
      ExerciseFeedbackEntry(
        exerciseId: _exercise.id,
        difficulty: _difficulty!,
        discomfort: _discomfort!,
      ),
    );

    if (_exerciseIndex < widget.exercises.length - 1) {
      setState(() {
        _exerciseIndex++;
        _setNumber = 1;
        _phase = _Phase.logging;
        _difficulty = null;
        _discomfort = null;
        _resetSetDefaults();
      });
    } else {
      setState(() => _phase = _Phase.workoutComplete);
      _saveSession();
    }
  }

  Future<void> _saveSession() async {
    setState(() {
      _isSaving = true;
      _saveError = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(_sessionsUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.accessToken}',
            },
            body: jsonEncode({
              'templateId': widget.templateId,
              'sets': _log
                  .map(
                    (set) => {
                      'exerciseId': set.exerciseId,
                      'setNumber': set.setNumber,
                      'reps': set.reps,
                      if (set.weightKg != null) 'weightKg': set.weightKg,
                    },
                  )
                  .toList(),
              'feedback': _feedbackLog
                  .map(
                    (entry) => {
                      'exerciseId': entry.exerciseId,
                      'difficulty': entry.difficulty,
                      'discomfort': entry.discomfort,
                    },
                  )
                  .toList(),
            }),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final outcomes = (body['progressionOutcomes'] as List).cast<Map<String, dynamic>>();
        setState(() {
          _isSaved = true;
          _progressionOutcomes = outcomes
              .map(
                (entry) => ProgressionOutcome(
                  exerciseName: entry['exerciseName'] as String,
                  message: entry['message'] as String,
                ),
              )
              .toList();
        });
        return;
      }
      setState(() => _saveError = 'Opslaan is niet gelukt. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _saveError = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LOVTOFIT')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: SingleChildScrollView(child: _buildPhase(context)),
          ),
        ),
      ),
    );
  }

  Widget _buildPhase(BuildContext context) {
    switch (_phase) {
      case _Phase.logging:
        return _buildLogging(context);
      case _Phase.resting:
        return _buildResting(context);
      case _Phase.exerciseComplete:
        return _buildExerciseComplete(context);
      case _Phase.workoutComplete:
        return _buildWorkoutComplete(context);
    }
  }

  Widget _buildLogging(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Oefening ${_exerciseIndex + 1} van ${widget.exercises.length}',
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          _exercise.name,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Set $_setNumber van ${_exercise.targetSets}',
          style: Theme.of(context).textTheme.bodyLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(_exercise.targetSets, (index) {
            final setNumber = index + 1;
            final isDone = setNumber < _setNumber;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                isDone ? Icons.check_circle : Icons.radio_button_unchecked,
                color: isDone ? Colors.green : Theme.of(context).colorScheme.outline,
              ),
            );
          }),
        ),
        const SizedBox(height: 24),
        _NumberStepper(
          label: 'Reps',
          value: _reps.toDouble(),
          step: 1,
          onChanged: (value) => setState(() => _reps = value.round()),
        ),
        if (_exercise.needsWeight) ...[
          const SizedBox(height: 12),
          _NumberStepper(
            label: 'Gewicht (kg)',
            value: _weightKg,
            step: 2.5,
            onChanged: (value) => setState(() => _weightKg = value),
          ),
        ],
        const SizedBox(height: 24),
        AppGradientButton(onPressed: _completeSet, child: const Text('SET KLAAR')),
      ],
    );
  }

  Widget _buildResting(BuildContext context) {
    final minutes = (_remainingRestSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (_remainingRestSeconds % 60).toString().padLeft(2, '0');

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Rust', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        Text('$minutes:$seconds', style: Theme.of(context).textTheme.displayMedium),
        const SizedBox(height: 24),
        OutlinedButton(onPressed: _skipRest, child: const Text('Rust overslaan')),
      ],
    );
  }

  Widget _buildExerciseComplete(BuildContext context) {
    final isLastExercise = _exerciseIndex == widget.exercises.length - 1;
    final canContinue = _difficulty != null && _discomfort != null;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(Icons.check_circle, color: Colors.green, size: 64),
        const SizedBox(height: 16),
        Text(
          '${_exercise.name} klaar',
          style: Theme.of(context).textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        Text(
          'Hoe voelde deze oefening?',
          style: Theme.of(context).textTheme.bodyLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        for (final entry in _difficultyOptions.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                backgroundColor: _difficulty == entry.value
                    ? AppColors.highlight.withValues(alpha: 0.16)
                    : null,
                side: BorderSide(
                  color: _difficulty == entry.value
                      ? AppColors.highlight
                      : AppColors.textSecondary.withValues(alpha: 0.4),
                ),
              ),
              onPressed: () => setState(() => _difficulty = entry.value),
              child: Text(entry.key),
            ),
          ),
        const SizedBox(height: 12),
        Text(
          'Had je ongemak of pijn?',
          style: Theme.of(context).textTheme.bodyLarge,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _discomfort == false
                      ? AppColors.highlight.withValues(alpha: 0.16)
                      : null,
                  side: BorderSide(
                    color: _discomfort == false
                        ? AppColors.highlight
                        : AppColors.textSecondary.withValues(alpha: 0.4),
                  ),
                ),
                onPressed: () => setState(() => _discomfort = false),
                child: const Text('Nee'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  backgroundColor: _discomfort == true
                      ? AppColors.highlight.withValues(alpha: 0.16)
                      : null,
                  side: BorderSide(
                    color: _discomfort == true
                        ? AppColors.highlight
                        : AppColors.textSecondary.withValues(alpha: 0.4),
                  ),
                ),
                onPressed: () => setState(() => _discomfort = true),
                child: const Text('Ja'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        AppGradientButton(
          onPressed: canContinue ? _submitFeedbackAndContinue : null,
          child: Text(isLastExercise ? 'Training afronden' : 'Volgende oefening →'),
        ),
      ],
    );
  }

  Widget _buildWorkoutComplete(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.emoji_events, color: Colors.amber, size: 64),
        const SizedBox(height: 16),
        Text(
          'Training voltooid! 💪',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text('${_log.length} sets gelogd', style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 16),
        if (_isSaving) const CircularProgressIndicator(),
        if (_isSaved) ...[
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_done, color: Colors.green, size: 20),
              const SizedBox(width: 8),
              Text('Opgeslagen', style: Theme.of(context).textTheme.bodyMedium),
            ],
          ),
          if (_progressionOutcomes.isNotEmpty) ...[
            const SizedBox(height: 20),
            Align(
              alignment: Alignment.centerLeft,
              child: Text('Volgende keer', style: Theme.of(context).textTheme.titleMedium),
            ),
            const SizedBox(height: 8),
            for (final outcome in _progressionOutcomes)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(outcome.exerciseName, style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 2),
                      Text(outcome.message, style: Theme.of(context).textTheme.bodySmall),
                    ],
                  ),
                ),
              ),
          ],
        ],
        if (_saveError != null) ...[
          Text(
            _saveError!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _saveSession, child: const Text('Opnieuw proberen')),
        ],
        const SizedBox(height: 24),
        AppGradientButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Terug naar Home'),
        ),
      ],
    );
  }
}

class _NumberStepper extends StatelessWidget {
  const _NumberStepper({
    required this.label,
    required this.value,
    required this.step,
    required this.onChanged,
  });

  final String label;
  final double value;
  final double step;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final display = value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(1);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyLarge),
        Row(
          children: [
            IconButton(
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: value - step < 0 ? null : () => onChanged(value - step),
            ),
            SizedBox(
              width: 48,
              child: Text(
                display,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.add_circle_outline),
              onPressed: () => onChanged(value + step),
            ),
          ],
        ),
      ],
    );
  }
}
