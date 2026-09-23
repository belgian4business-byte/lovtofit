import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Keuze uit de energie-check. [skipped] = "Overslaan" (de check is nooit
/// verplicht); anders één van de backend-waarden LOW/NORMAL/HIGH.
class EnergyChoice {
  const EnergyChoice._(this.level);

  static const skipped = EnergyChoice._(null);
  static const low = EnergyChoice._('LOW');
  static const normal = EnergyChoice._('NORMAL');
  static const high = EnergyChoice._('HIGH');

  /// `null` bij overslaan.
  final String? level;
}

// Labels volgen blueprint v0.7.11 ("😄 Goed · 😐 Normaal · 😴 Weinig energie").
const _options = [
  (EnergyChoice.high, '😄', 'Goed'),
  (EnergyChoice.normal, '😐', 'Normaal'),
  (EnergyChoice.low, '😴', 'Weinig energie'),
];

/// "Hoe voel je je vandaag?" vóór de training (CLAUDE.md Fase 8, stap 2).
/// Eén tik, geen dagboek. Geeft `null` terug als de gebruiker het paneel
/// wegveegt (= de training niet starten), [EnergyChoice.skipped] bij
/// "Overslaan".
Future<EnergyChoice?> showEnergyCheckSheet(BuildContext context) {
  return showModalBottomSheet<EnergyChoice>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppColors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      final textTheme = Theme.of(sheetContext).textTheme;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Hoe voel je je vandaag?', style: textTheme.titleLarge),
              const SizedBox(height: 4),
              // Eerlijk over wat er gebeurt: alleen weinig energie past iets aan.
              Text('Bij weinig energie maken we je training wat lichter.', style: textTheme.bodySmall),
              const SizedBox(height: 16),
              for (final (choice, emoji, label) in _options) ...[
                OutlinedButton(
                  onPressed: () => Navigator.of(sheetContext).pop(choice),
                  child: Row(
                    children: [
                      Text(emoji, style: const TextStyle(fontSize: 22)),
                      const SizedBox(width: 12),
                      Text(label),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
              TextButton(
                onPressed: () => Navigator.of(sheetContext).pop(EnergyChoice.skipped),
                child: const Text('Overslaan'),
              ),
            ],
          ),
        ),
      );
    },
  );
}
