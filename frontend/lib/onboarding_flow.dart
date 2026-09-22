import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'home_screen.dart';

/// Eén onboardingvraag per scherm, in de volgorde uit de blueprint:
/// doel → locatie → apparatuur → tijd → frequentie → niveau.
class OnboardingFlow extends StatefulWidget {
  const OnboardingFlow({super.key, required this.accessToken, required this.email});

  final String accessToken;
  final String email;

  @override
  State<OnboardingFlow> createState() => _OnboardingFlowState();
}

const _goalOptions = {
  'Afvallen': 'LOSE_WEIGHT',
  'Spieren opbouwen': 'BUILD_MUSCLE',
  'Sterker worden': 'GET_STRONGER',
  'Conditie verbeteren': 'IMPROVE_CONDITION',
  'Fit worden': 'GET_FIT',
};

const _locationOptions = {'🏠 Thuis': 'HOME', '🏋️ Fitness': 'GYM', '🔄 Beide': 'BOTH'};

const _equipmentOptions = {
  'Geen apparatuur': 'NONE',
  'Dumbbells': 'DUMBBELLS',
  'Elastieken': 'RESISTANCE_BANDS',
  'Kettlebell': 'KETTLEBELL',
  'Volledige fitnessapparatuur': 'FULL_GYM',
};

const _durationOptions = {
  '⏱ 15 min': 'MIN_15',
  '⏱ 30 min': 'MIN_30',
  '⏱ 45 min': 'MIN_45',
  '⏱ 60+ min': 'MIN_60_PLUS',
};

const _frequencyOptions = {
  '2× per week': 2,
  '3× per week': 3,
  '4× per week': 4,
  '5× per week': 5,
  '6× per week': 6,
};

const _levelOptions = {'Beginner': 'BEGINNER', 'Gemiddeld': 'INTERMEDIATE', 'Gevorderd': 'ADVANCED'};

class _OnboardingFlowState extends State<OnboardingFlow> {
  static const _onboardingUrl = 'http://localhost:3000/onboarding';
  static const _stepCount = 6;

  int _step = 0;
  final Set<String> _goals = {};
  String? _location;
  final Set<String> _equipment = {};
  String? _duration;
  int? _frequency;
  String? _level;

  bool _isSubmitting = false;
  String? _errorMessage;

  bool get _canProceed {
    switch (_step) {
      case 0:
        return _goals.isNotEmpty;
      case 1:
        return _location != null;
      case 2:
        return _equipment.isNotEmpty;
      case 3:
        return _duration != null;
      case 4:
        return _frequency != null;
      case 5:
        return _level != null;
      default:
        return false;
    }
  }

  void _toggleEquipment(String value) {
    setState(() {
      if (value == 'NONE') {
        _equipment
          ..clear()
          ..add('NONE');
        return;
      }
      _equipment.remove('NONE');
      if (_equipment.contains(value)) {
        _equipment.remove(value);
      } else {
        _equipment.add(value);
      }
    });
  }

  void _goNext() {
    if (!_canProceed) return;
    if (_step < _stepCount - 1) {
      setState(() => _step++);
    } else {
      _submit();
    }
  }

  void _goBack() {
    if (_step > 0) setState(() => _step--);
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(_onboardingUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.accessToken}',
            },
            body: jsonEncode({
              'goals': _goals.toList(),
              'location': _location,
              'equipment': _equipment.toList(),
              'sessionDuration': _duration,
              'weeklyFrequency': _frequency,
              'level': _level,
            }),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201 && mounted) {
        Navigator.of(
          context,
        ).pushReplacement(
          MaterialPageRoute(
            builder: (_) => HomeScreen(accessToken: widget.accessToken, email: widget.email),
          ),
        );
        return;
      }

      setState(() => _errorMessage = 'Er ging iets mis. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Stap ${_step + 1} van $_stepCount'),
        leading: _step > 0
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: _goBack)
            : null,
      ),
      body: Column(
        children: [
          LinearProgressIndicator(value: (_step + 1) / _stepCount),
          Expanded(
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: SingleChildScrollView(child: _buildStep(context)),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                if (_errorMessage != null) ...[
                  Text(
                    _errorMessage!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                ],
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: (_canProceed && !_isSubmitting) ? _goNext : null,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(_step < _stepCount - 1 ? 'Volgende' : 'Klaar'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(BuildContext context) {
    switch (_step) {
      case 0:
        return _MultiChoiceStep(
          title: 'Wat wil je bereiken?',
          subtitle: 'Meerdere keuzes mogelijk',
          options: _goalOptions,
          selected: _goals,
          onToggle: (value) => setState(
            () => _goals.contains(value) ? _goals.remove(value) : _goals.add(value),
          ),
        );
      case 1:
        return _SingleChoiceStep(
          title: 'Waar train je meestal?',
          options: _locationOptions,
          selected: _location,
          onSelect: (value) => setState(() => _location = value),
        );
      case 2:
        return _MultiChoiceStep(
          title: 'Welke apparatuur heb je?',
          options: _equipmentOptions,
          selected: _equipment,
          onToggle: _toggleEquipment,
        );
      case 3:
        return _SingleChoiceStep(
          title: 'Hoeveel tijd heb je meestal?',
          options: _durationOptions,
          selected: _duration,
          onSelect: (value) => setState(() => _duration = value),
        );
      case 4:
        return _SingleChoiceStep<int>(
          title: 'Hoe vaak wil je trainen?',
          options: _frequencyOptions,
          selected: _frequency,
          onSelect: (value) => setState(() => _frequency = value),
        );
      case 5:
        return _SingleChoiceStep(
          title: 'Hoe ervaren ben je?',
          options: _levelOptions,
          selected: _level,
          onSelect: (value) => setState(() => _level = value),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

class _SingleChoiceStep<T> extends StatelessWidget {
  const _SingleChoiceStep({
    required this.title,
    required this.options,
    required this.selected,
    required this.onSelect,
  });

  final String title;
  final Map<String, T> options;
  final T? selected;
  final ValueChanged<T> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        for (final entry in options.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                backgroundColor: selected == entry.value
                    ? Theme.of(context).colorScheme.primaryContainer
                    : null,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () => onSelect(entry.value),
              child: Text(entry.key),
            ),
          ),
      ],
    );
  }
}

class _MultiChoiceStep extends StatelessWidget {
  const _MultiChoiceStep({
    required this.title,
    this.subtitle,
    required this.options,
    required this.selected,
    required this.onToggle,
  });

  final String title;
  final String? subtitle;
  final Map<String, String> options;
  final Set<String> selected;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(
            subtitle!,
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: 24),
        for (final entry in options.entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                backgroundColor: selected.contains(entry.value)
                    ? Theme.of(context).colorScheme.primaryContainer
                    : null,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () => onToggle(entry.value),
              child: Text(entry.key),
            ),
          ),
      ],
    );
  }
}
