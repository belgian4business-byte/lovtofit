import 'package:flutter/material.dart';

/// Centrale design tokens voor de blauwe donkere huisstijl. Eén bron van
/// waarheid voor kleuren/vormen — schermen wijzigen hier niets aan, ze
/// lezen alleen via `Theme.of(context)`.
class AppColors {
  AppColors._();

  static const background = Color(0xFF081320);
  static const card = Color(0xFF141F2E);

  static const primaryStart = Color(0xFF0A63E0);
  static const primaryEnd = Color(0xFF37C6FF);
  static const highlight = Color(0xFF7FE3FF);

  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF9BA6B2);

  static const error = Color(0xFFFF6B6B);

  static const primaryGradient = LinearGradient(
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
    colors: [primaryStart, primaryEnd],
  );
}

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final baseTextTheme = Typography.material2021(
      platform: TargetPlatform.android,
    ).white.apply(bodyColor: AppColors.textPrimary, displayColor: AppColors.textPrimary);

    final textTheme = baseTextTheme.copyWith(
      bodySmall: baseTextTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
      labelSmall: baseTextTheme.labelSmall?.copyWith(color: AppColors.textSecondary),
      labelMedium: baseTextTheme.labelMedium?.copyWith(color: AppColors.textSecondary),
    );

    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.primaryStart,
      brightness: Brightness.dark,
    ).copyWith(
      surface: AppColors.background,
      primary: AppColors.primaryStart,
      secondary: AppColors.highlight,
      onSurface: AppColors.textPrimary,
      onPrimary: Colors.white,
      error: AppColors.error,
    );

    const pillShape = StadiumBorder();
    const cardRadius = BorderRadius.all(Radius.circular(16));

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: colorScheme,
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 6,
        shadowColor: Colors.black.withValues(alpha: 0.4),
        shape: const RoundedRectangleBorder(borderRadius: cardRadius),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primaryStart,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: pillShape,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.highlight,
          side: const BorderSide(color: AppColors.highlight),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: pillShape,
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: AppColors.highlight),
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimary),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.card,
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.highlight, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.error, width: 1.5),
        ),
      ),
      dividerColor: AppColors.textSecondary.withValues(alpha: 0.2),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.card,
        indicatorColor: AppColors.highlight.withValues(alpha: 0.16),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
            color: selected ? AppColors.highlight : AppColors.textSecondary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(color: selected ? AppColors.highlight : AppColors.textSecondary);
        }),
      ),
    );
  }
}

/// Herbruikbare knop met het blauwe gradiënt (StadiumBorder/pill-vorm, witte
/// tekst). `FilledButtonTheme` kan geen gradiënt-achtergrond uitdrukken, dus
/// die zit hier apart klaar voor wanneer schermen worden omgezet.
class AppGradientButton extends StatelessWidget {
  const AppGradientButton({super.key, required this.onPressed, required this.child});

  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDisabled = onPressed == null;

    // IntrinsicWidth laat de knop inkrimpen tot de inhoud (zoals een normale
    // knop), maar respecteert een door de ouder afgedwongen breedte (bv. een
    // Column met CrossAxisAlignment.stretch) — Center centreert de inhoud
    // dan netjes binnen die bredere ruimte.
    return Opacity(
      opacity: isDisabled ? 0.5 : 1,
      child: IntrinsicWidth(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: AppColors.primaryGradient,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: onPressed,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                child: Center(
                  child: DefaultTextStyle.merge(
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                    child: IconTheme.merge(
                      data: const IconThemeData(color: Colors.white),
                      child: child,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
