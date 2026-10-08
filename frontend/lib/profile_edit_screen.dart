import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'profile_options.dart';
import 'theme/app_theme.dart';

/// De onboarding-keuzes zoals ze nu zijn, om het bewerkscherm mee te vullen.
class ProfileChoices {
  const ProfileChoices({
    required this.goals,
    required this.location,
    required this.equipment,
    required this.sessionDuration,
    required this.weeklyFrequency,
    required this.level,
  });

  final Set<String> goals;
  final String location;
  final Set<String> equipment;
  final String sessionDuration;
  final int weeklyFrequency;
  final String level;
}

/// Profiel aanpassen (CLAUDE.md Fase 10, stap 2). Slaat op via de bestaande
/// `POST /onboarding`: die zet een doel dat niet meer gekozen is op PAUSED
/// (nooit verwijderen of overschrijven) en werkt de trainingsvoorkeuren bij.
/// Sluit met `true` als er is opgeslagen.
class ProfileEditScreen extends StatefulWidget {
  const ProfileEditScreen({super.key, required this.accessToken, required this.initial});

  final String accessToken;
  final ProfileChoices initial;

  @override
  State<ProfileEditScreen> createState() => _ProfileEditScreenState();
}

class _ProfileEditScreenState extends State<ProfileEditScreen> {
  static const _onboardingUrl = '$apiBaseUrl/onboarding';

  late Set<String> _goals = {...widget.initial.goals};
  late String _location = widget.initial.location;
  late Set<String> _equipment = {...widget.initial.equipment};
  late String _duration = widget.initial.sessionDuration;
  late int _frequency = widget.initial.weeklyFrequency;
  late String _level = widget.initial.level;

  bool _isSaving = false;
  String? _errorMessage;

  bool get _canSave => _goals.isNotEmpty && _equipment.isNotEmpty && !_isSaving;

  /// Doelen die de gebruiker uitzet: die worden gepauzeerd, niet gewist.
  bool get _pausesAGoal => widget.initial.goals.any((goal) => !_goals.contains(goal));


  Future<void> _save() async {
    setState(() {
      _isSaving = true;
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
        Navigator.of(context).pop(true);
        return;
      }

      setState(() => _errorMessage = 'Opslaan lukte niet. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profiel aanpassen')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _Section(
                  title: 'Doel',
                  subtitle: 'Meerdere keuzes mogelijk',
                  footer: _pausesAGoal
                      ? 'Een doel dat je uitzet, wordt bewaard als gepauzeerd — niet gewist.'
                      : null,
                  children: [
                    for (final entry in goalOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _goals.contains(entry.value),
                        onTap: () => setState(() {
                          _goals = {..._goals};
                          if (!_goals.remove(entry.value)) _goals.add(entry.value);
                        }),
                      ),
                  ],
                ),
                _Section(
                  title: 'Locatie',
                  children: [
                    for (final entry in locationOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _location == entry.value,
                        onTap: () => setState(() => _location = entry.value),
                      ),
                  ],
                ),
                _Section(
                  title: 'Apparatuur',
                  children: [
                    for (final entry in equipmentOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _equipment.contains(entry.value),
                        onTap: () => setState(() => _equipment = toggleEquipment(_equipment, entry.value)),
                      ),
                  ],
                ),
                _Section(
                  title: 'Frequentie',
                  children: [
                    for (final entry in frequencyOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _frequency == entry.value,
                        onTap: () => setState(() => _frequency = entry.value),
                      ),
                  ],
                ),
                _Section(
                  title: 'Duur per training',
                  children: [
                    for (final entry in durationOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _duration == entry.value,
                        onTap: () => setState(() => _duration = entry.value),
                      ),
                  ],
                ),
                _Section(
                  title: 'Niveau',
                  children: [
                    for (final entry in levelOptions.entries)
                      _ChoiceChip(
                        label: entry.key,
                        selected: _level == entry.value,
                        onTap: () => setState(() => _level = entry.value),
                      ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              children: [
                if (_errorMessage != null) ...[
                  Text(
                    _errorMessage!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                ],
                SizedBox(
                  width: double.infinity,
                  child: AppGradientButton(
                    onPressed: _canSave ? _save : null,
                    child: _isSaving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Opslaan'),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, this.subtitle, required this.children, this.footer});

  final String title;
  final String? subtitle;
  final List<Widget> children;
  final String? footer;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: textTheme.titleMedium),
          if (subtitle != null) ...[
            const SizedBox(height: 2),
            Text(subtitle!, style: textTheme.bodySmall),
          ],
          const SizedBox(height: 10),
          Wrap(spacing: 8, runSpacing: 8, children: children),
          if (footer != null) ...[
            const SizedBox(height: 8),
            Text(footer!, style: textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

/// Zelfde look als de keuzeknoppen in de onboarding: blauwe rand en lichte
/// blauwe vulling als gekozen.
class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        backgroundColor: selected ? AppColors.highlight.withValues(alpha: 0.16) : null,
        side: BorderSide(
          color: selected ? AppColors.highlight : AppColors.textSecondary.withValues(alpha: 0.4),
        ),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      ),
      onPressed: onTap,
      child: Text(label),
    );
  }
}
