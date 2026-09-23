import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'theme/app_theme.dart';
import 'widgets/settings_menu_button.dart';
import 'workout_models.dart';
import 'workout_screen.dart';

/// Train-tab: "Wat moet ik vandaag doen?" — toont de training van vandaag
/// (Decision Engine) met een Start-knop. Voorheen het Home-scherm; nu
/// verplaatst naar de Train-tab (CLAUDE.md Fase 4, stap 1).
class TrainScreen extends StatefulWidget {
  const TrainScreen({super.key, required this.accessToken, required this.email});

  final String accessToken;
  final String email;

  @override
  State<TrainScreen> createState() => _TrainScreenState();
}

class _TrainScreenState extends State<TrainScreen> {
  static const _todayUrl = 'http://localhost:3000/workouts/today';

  bool _isLoading = true;
  String? _errorMessage;
  String? _templateId;
  String? _templateName;
  List<WorkoutExercise> _exercises = [];

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
        final slots = (body['slots'] as List).cast<Map<String, dynamic>>();
        setState(() {
          _templateId = body['templateId'] as String;
          _templateName = body['templateName'] as String;
          _exercises = slots.map((slot) {
            final exercise = slot['exercise'] as Map<String, dynamic>;
            return WorkoutExercise(
              id: exercise['id'] as String,
              name: exercise['name'] as String,
              equipment: exercise['equipment'] as String,
              targetSets: slot['targetSets'] as int,
              targetReps: slot['targetReps'] as int,
            );
          }).toList();
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

  void _startTraining() {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkoutScreen(
          accessToken: widget.accessToken,
          templateId: _templateId!,
          exercises: _exercises,
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
          child: Padding(padding: const EdgeInsets.all(24), child: _buildBody(context)),
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
      ],
    );
  }
}
