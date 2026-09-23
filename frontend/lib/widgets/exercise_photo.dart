import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Welke foto-variant de app toont (bestanden: `lovtofit_<key>_<variant>.webp`
/// in assets/exercises/). Standaard `duo`; `man`/`vrouw` staan er ook, voor
/// als de gebruiker later zelf mag kiezen.
const exercisePhotoVariant = 'duo';

String exercisePhotoAsset(String imageKey, {String variant = exercisePhotoVariant}) =>
    'assets/exercises/lovtofit_${imageKey}_$variant.webp';

/// Foto van een oefening, of een rustige placeholder als er (nog) geen foto
/// is. Welke foto bij welke oefening hoort, beslist de backend (`imageKey`
/// uit de seed); de app zoekt niets op naam.
class ExercisePhoto extends StatelessWidget {
  const ExercisePhoto({
    super.key,
    required this.imageKey,
    this.width,
    this.height,
    this.borderRadius = 16,
    this.compact = false,
  });

  final String? imageKey;
  final double? width;
  final double? height;
  final double borderRadius;

  /// Klein formaat (lijstjes): alleen een icoon, geen tekst.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final key = imageKey;
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: width,
        height: height,
        child: key == null
            ? _placeholder(context)
            : Image.asset(
                exercisePhotoAsset(key),
                fit: BoxFit.cover,
                // Bestand onverwacht weg of kapot: nooit een rood foutscherm.
                errorBuilder: (context, _, _) => _placeholder(context),
              ),
      ),
    );
  }

  Widget _placeholder(BuildContext context) {
    return Container(
      key: const ValueKey('exercise-photo-placeholder'),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.textSecondary.withValues(alpha: 0.25)),
        borderRadius: BorderRadius.circular(borderRadius),
      ),
      child: Center(
        child: compact
            ? Icon(Icons.fitness_center, size: 18, color: AppColors.textSecondary.withValues(alpha: 0.7))
            : Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.fitness_center, size: 36, color: AppColors.textSecondary.withValues(alpha: 0.7)),
                  const SizedBox(height: 8),
                  Text(
                    'Foto volgt binnenkort',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
                  ),
                ],
              ),
      ),
    );
  }
}
