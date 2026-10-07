import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'profile_options.dart';

/// Profiel-scherm (CLAUDE.md Fase 10, stap 1), bereikbaar via het tandwiel
/// rechtsboven. Toont wat de gebruiker in de onboarding koos
/// (`GET /onboarding`) plus het e-mailadres. Nog alleen weergave;
/// aanpassen komt in stap 2.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static const _profileUrl = '$apiBaseUrl/onboarding';

  bool _isLoading = true;
  String? _errorMessage;
  String _email = '';
  List<String> _goals = [];
  Map<String, dynamic>? _preferences;

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
      final response = await http
          .get(Uri.parse(_profileUrl), headers: {'Authorization': 'Bearer ${widget.accessToken}'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode != 200) {
        setState(() => _errorMessage = 'Kon je profiel niet ophalen.');
        return;
      }

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() {
        _email = body['email'] as String;
        _goals = (body['goals'] as List).cast<String>();
        _preferences = body['preferences'] as Map<String, dynamic>?;
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
        ],
      ),
    );
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

class _Field {
  const _Field(this.label, this.value);

  final String label;
  final String value;
}
