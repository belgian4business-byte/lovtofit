import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'theme/app_theme.dart';
import 'widgets/premium_teaser_card.dart';
import 'widgets/settings_menu_button.dart';

const _trendIcons = {
  'DOWN': Icons.trending_down,
  'UP': Icons.trending_up,
  'STABLE': Icons.trending_flat,
};

/// Nutrition-tab (CLAUDE.md Fase 5; bron: blueprint v1.3 §6/§10 +
/// v2.17.4/v2.17.7/v2.17.12). Stap 1: de gebruiker kan zijn gewicht
/// loggen, opgeslagen in body_measurements (geschiedenis, nooit
/// overschreven). Stap 2: toont de gewichtstrend (`GET
/// /body-measurements`) — nooit één losse meting overinterpreteren. Stap
/// 3: waterregistratie (`GET`/`POST /water-intake`) met een praktische
/// richtwaarde i.p.v. een harde medische norm. De logvorm/knoppen blijven
/// altijd meteen bruikbaar, ook als het ophalen van trend/water nog bezig
/// is of mislukt.
class NutritionScreen extends StatefulWidget {
  const NutritionScreen({super.key, required this.accessToken, this.isActive = true});

  final String accessToken;

  /// Zie de toelichting bij ProgressScreen.isActive — zelfde reden
  /// (IndexedStack in MainShell), zelfde oplossing.
  final bool isActive;

  @override
  State<NutritionScreen> createState() => _NutritionScreenState();
}

class _NutritionScreenState extends State<NutritionScreen> {
  static const _weightUrl = '$apiBaseUrl/body-measurements';
  static const _waterUrl = '$apiBaseUrl/water-intake';
  static const _waterTodayUrl = '$apiBaseUrl/water-intake/today';
  static const _calorieGoalUrl = '$apiBaseUrl/calorie-goal';

  final _formKey = GlobalKey<FormState>();
  final _weightController = TextEditingController();

  bool _isSaving = false;
  String? _saveErrorMessage;
  double? _lastSavedWeightKg;

  bool _isLoadingTrend = true;
  String? _trendErrorMessage;
  String? _trendMessage;
  int _measurementCount = 0;
  String? _trendDirection;

  bool _isLoadingWater = true;
  String? _waterErrorMessage;
  String? _waterMessage;
  int _waterTotalMl = 0;
  int _waterTargetMl = 0;
  bool _isLoggingWater = false;

  bool _isLoadingCalorieGoal = true;
  String? _calorieGoalErrorMessage;
  String? _calorieGoalStatus;
  String? _calorieGoalMessage;

  @override
  void initState() {
    super.initState();
    _loadTrend();
    _loadWater();
    _loadCalorieGoal();
  }

  @override
  void didUpdateWidget(covariant NutritionScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) {
      _loadTrend();
      _loadWater();
      _loadCalorieGoal();
    }
  }

  @override
  void dispose() {
    _weightController.dispose();
    super.dispose();
  }

  Future<void> _loadTrend() async {
    setState(() {
      _isLoadingTrend = true;
      _trendErrorMessage = null;
    });

    try {
      final response = await http
          .get(Uri.parse(_weightUrl), headers: {'Authorization': 'Bearer ${widget.accessToken}'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _trendMessage = body['coachMessage'] as String?;
          _measurementCount = body['measurementCount'] as int;
          _trendDirection = body['direction'] as String?;
        });
        return;
      }
      setState(() => _trendErrorMessage = 'Kon je gewichtstrend niet ophalen.');
    } catch (_) {
      setState(() => _trendErrorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoadingTrend = false);
    }
  }

  Future<void> _loadWater() async {
    setState(() {
      _isLoadingWater = true;
      _waterErrorMessage = null;
    });

    try {
      final response = await http
          .get(Uri.parse(_waterTodayUrl), headers: {'Authorization': 'Bearer ${widget.accessToken}'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _waterMessage = body['coachMessage'] as String?;
          _waterTotalMl = body['totalMl'] as int;
          _waterTargetMl = body['targetMl'] as int;
        });
        return;
      }
      setState(() => _waterErrorMessage = 'Kon je waterstatus niet ophalen.');
    } catch (_) {
      setState(() => _waterErrorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoadingWater = false);
    }
  }

  Future<void> _loadCalorieGoal() async {
    setState(() {
      _isLoadingCalorieGoal = true;
      _calorieGoalErrorMessage = null;
    });

    try {
      final response = await http
          .get(Uri.parse(_calorieGoalUrl), headers: {'Authorization': 'Bearer ${widget.accessToken}'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _calorieGoalStatus = body['status'] as String?;
          _calorieGoalMessage = body['coachMessage'] as String?;
        });
        return;
      }
      setState(() => _calorieGoalErrorMessage = 'Kon je caloriedoel niet ophalen.');
    } catch (_) {
      setState(() => _calorieGoalErrorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoadingCalorieGoal = false);
    }
  }

  Future<void> _logWater(int amountMl) async {
    setState(() {
      _isLoggingWater = true;
      _waterErrorMessage = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(_waterUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.accessToken}',
            },
            body: jsonEncode({'amountMl': amountMl}),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        await _loadWater();
        return;
      }
      setState(() => _waterErrorMessage = 'Opslaan is niet gelukt. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _waterErrorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isLoggingWater = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final weightKg = double.parse(_weightController.text.replaceAll(',', '.'));

    setState(() {
      _isSaving = true;
      _saveErrorMessage = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(_weightUrl),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ${widget.accessToken}',
            },
            body: jsonEncode({'weightKg': weightKg}),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        setState(() {
          _lastSavedWeightKg = weightKg;
          _weightController.clear();
        });
        _loadTrend();
        _loadCalorieGoal();
        return;
      }
      setState(() => _saveErrorMessage = 'Opslaan is niet gelukt. Probeer het opnieuw.');
    } catch (_) {
      setState(() => _saveErrorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  String? _validateWeight(String? value) {
    final parsed = double.tryParse((value ?? '').trim().replaceAll(',', '.'));
    if (parsed == null || parsed < 20 || parsed > 400) {
      return 'Vul een geldig gewicht in (20-400 kg)';
    }
    return null;
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
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildWaterCard(context),
                const SizedBox(height: 12),
                _buildTrendCard(context),
                const SizedBox(height: 12),
                _buildCalorieGoalCard(context),
                const SizedBox(height: 20),
                _buildForm(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWaterCard(BuildContext context) {
    // De +knoppen blijven altijd bruikbaar (loggen hangt niet af van het al
    // kennen van de huidige stand) — alleen de stand/tekst erboven wisselt
    // tussen laden/fout/inhoud, net als bij het gewicht-logformulier.
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.water_drop_outlined, size: 20),
                const SizedBox(width: 12),
                Expanded(child: _buildWaterStatus(context)),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isLoggingWater ? null : () => _logWater(250),
                    child: const Text('+250 ml'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: _isLoggingWater ? null : () => _logWater(500),
                    child: const Text('+500 ml'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWaterStatus(BuildContext context) {
    if (_isLoadingWater) {
      return const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }

    if (_waterErrorMessage != null) {
      return Row(
        children: [
          Expanded(child: Text(_waterErrorMessage!)),
          TextButton(onPressed: _loadWater, child: const Text('Opnieuw')),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Water vandaag: $_waterTotalMl / $_waterTargetMl ml',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 4),
        Text(_waterMessage ?? '', style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }

  Widget _buildTrendCard(BuildContext context) {
    if (_isLoadingTrend) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_trendErrorMessage != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(child: Text(_trendErrorMessage!)),
              TextButton(onPressed: _loadTrend, child: const Text('Opnieuw')),
            ],
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(_trendDirection != null ? _trendIcons[_trendDirection] : Icons.timeline, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Gewichtstrend', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(_trendMessage ?? '', style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 4),
                  Text(
                    '$_measurementCount ${_measurementCount == 1 ? 'meting' : 'metingen'} geregistreerd',
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

  Widget _buildCalorieGoalCard(BuildContext context) {
    if (_isLoadingCalorieGoal) {
      return const Card(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    if (_calorieGoalErrorMessage != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(child: Text(_calorieGoalErrorMessage!)),
              TextButton(onPressed: _loadCalorieGoal, child: const Text('Opnieuw')),
            ],
          ),
        ),
      );
    }

    // "Alleen bij een gewichtsdoel" (CLAUDE.md): zonder LOSE_WEIGHT/
    // BUILD_MUSCLE-doel toont deze kaart bewust niets.
    if (_calorieGoalStatus == 'NOT_APPLICABLE') {
      return const SizedBox.shrink();
    }

    // Fase 6: de backend geeft bij PREMIUM_REQUIRED geen range mee — de app
    // toont dan alleen de vergrendelde teaser.
    if (_calorieGoalStatus == 'PREMIUM_REQUIRED') {
      return PremiumTeaserCard(
        icon: Icons.local_fire_department_outlined,
        title: 'Caloriedoel',
        message: _calorieGoalMessage ?? '',
        accessToken: widget.accessToken,
        onPremiumActivated: _loadCalorieGoal,
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.local_fire_department_outlined, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Caloriedoel', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(_calorieGoalMessage ?? '', style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Gewicht loggen',
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Eén meting zegt niet alles — we kijken naar de trend over tijd.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _weightController,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Gewicht (kg)'),
            validator: _validateWeight,
          ),
          const SizedBox(height: 24),
          AppGradientButton(
            onPressed: _isSaving ? null : _save,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Gewicht opslaan'),
          ),
          if (_lastSavedWeightKg != null) ...[
            const SizedBox(height: 16),
            Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.cloud_done, color: Colors.green, size: 20),
                const SizedBox(width: 8),
                Text('Opgeslagen: $_lastSavedWeightKg kg'),
              ],
            ),
          ],
          if (_saveErrorMessage != null) ...[
            const SizedBox(height: 16),
            Text(
              _saveErrorMessage!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
