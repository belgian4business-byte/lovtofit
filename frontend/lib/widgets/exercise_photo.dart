import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// Welke foto-variant de app toont (bestanden: `lovtofit_<key>_<variant>.webp`
/// in assets/exercises/). Standaard `duo`; `man`/`vrouw` staan er ook, voor
/// als de gebruiker later zelf mag kiezen.
const exercisePhotoVariant = 'duo';

/// Vorm van het fotokader in het workout-scherm: 4:3 (bijna vierkant). Past
/// bij beide fotosets: vierkante foto's verliezen enkel onderaan een klein
/// stukje, 3:2-foto's (twee mensen naast elkaar) blijven vrijwel heel.
const double exercisePhotoFrameAspect = 4 / 3;

/// Maat van het fotokader: altijd 4:3, zo breed als de beschikbare ruimte,
/// maar nooit hoger dan wat het scherm toelaat — op kleine schermen wordt het
/// kader kleiner (en blijft 4:3), zodat "SET KLAAR" zonder scrollen in beeld
/// blijft (afvinken in max. 2 tikken) — zie de tests.
Size exercisePhotoFrameSize({required double availableWidth, required double screenHeight}) {
  final double maxHeight;
  if (screenHeight >= 800) {
    maxHeight = 260; // gewone telefoon (bv. CPH2247, 873)
  } else if (screenHeight >= 700) {
    maxHeight = 170; // kleine moderne telefoon (bv. 360×740)
  } else {
    maxHeight = 130; // heel klein (bv. 360×640)
  }
  final width = availableWidth < maxHeight * exercisePhotoFrameAspect
      ? availableWidth
      : maxHeight * exercisePhotoFrameAspect;
  return Size(width, width / exercisePhotoFrameAspect);
}

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

  /// Klein formaat (lijstjes): placeholder met alleen een icoon, geen tekst.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final key = imageKey;
    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(
        width: width,
        height: height,
        // De foto vult het kader altijd volledig, van rand tot rand; wat niet
        // past wordt bijgesneden (3:2 én vierkante foto's). Geen opvulling.
        child: key == null
            ? _placeholder(context)
            : Image.asset(
                exercisePhotoAsset(key),
                fit: BoxFit.cover,
                // Bij bijsnijden liever onderaan dan bovenaan wat wegvallen:
                // hoofden zijn belangrijker dan voeten (bv. staande mensen op
                // een vierkante foto in een breed kader).
                alignment: const Alignment(0, -0.5),
                width: double.infinity,
                height: double.infinity,
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
