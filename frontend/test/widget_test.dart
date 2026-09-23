import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'package:lovtofit_app/coach_screen.dart';
import 'package:lovtofit_app/home_screen.dart';
import 'package:lovtofit_app/main.dart';
import 'package:lovtofit_app/main_shell.dart';
import 'package:lovtofit_app/nutrition_screen.dart';
import 'package:lovtofit_app/onboarding_flow.dart';
import 'package:lovtofit_app/progress_screen.dart';
import 'package:lovtofit_app/register_screen.dart';
import 'package:lovtofit_app/theme/app_theme.dart';
import 'package:lovtofit_app/train_screen.dart';
import 'package:lovtofit_app/widgets/energy_check_sheet.dart';
import 'package:lovtofit_app/widgets/premium_teaser_card.dart';
import 'package:lovtofit_app/workout_models.dart';
import 'package:lovtofit_app/workout_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('shows the login form with email, password and submit button', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(const LovtofitApp());

      expect(find.text('Inloggen'), findsWidgets);
      expect(find.widgetWithText(TextFormField, 'E-mailadres'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Wachtwoord'), findsOneWidget);
      expect(find.widgetWithText(AppGradientButton, 'Inloggen'), findsOneWidget);
    });

    testWidgets('shows validation errors for empty submission', (WidgetTester tester) async {
      await tester.pumpWidget(const LovtofitApp());

      await tester.tap(find.widgetWithText(AppGradientButton, 'Inloggen'));
      await tester.pump();

      expect(find.text('Vul een geldig e-mailadres in'), findsOneWidget);
      expect(find.text('Vul je wachtwoord in'), findsOneWidget);
    });

    testWidgets('navigates to the registration screen', (WidgetTester tester) async {
      await tester.pumpWidget(const LovtofitApp());

      await tester.tap(find.text('Nog geen account? Registreren'));
      await tester.pumpAndSettle();

      expect(find.byType(RegisterScreen), findsOneWidget);
    });
  });

  group('RegisterScreen', () {
    testWidgets('shows validation errors for empty submission', (WidgetTester tester) async {
      await tester.pumpWidget(const MaterialApp(home: RegisterScreen()));

      await tester.tap(find.widgetWithText(AppGradientButton, 'Account aanmaken'));
      await tester.pump();

      expect(find.text('Vul een geldig e-mailadres in'), findsOneWidget);
      expect(find.text('Minimaal 8 tekens'), findsOneWidget);
    });
  });

  group('OnboardingFlow', () {
    testWidgets('shows one question per screen and requires an answer to proceed', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OnboardingFlow(accessToken: 'test-token', email: 'test@example.com'),
        ),
      );

      expect(find.text('Wat wil je bereiken?'), findsOneWidget);
      final nextButton = find.widgetWithText(AppGradientButton, 'Volgende');
      expect(tester.widget<AppGradientButton>(nextButton).onPressed, isNull);

      await tester.tap(find.text('Afvallen'));
      await tester.pump();
      expect(tester.widget<AppGradientButton>(nextButton).onPressed, isNotNull);

      await tester.tap(nextButton);
      await tester.pumpAndSettle();

      expect(find.text('Waar train je meestal?'), findsOneWidget);
      expect(find.text('Wat wil je bereiken?'), findsNothing);
    });

    testWidgets('goes back to the previous question', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: OnboardingFlow(accessToken: 'test-token', email: 'test@example.com'),
        ),
      );

      await tester.tap(find.text('Afvallen'));
      await tester.pump();
      await tester.tap(find.widgetWithText(AppGradientButton, 'Volgende'));
      await tester.pumpAndSettle();
      expect(find.text('Waar train je meestal?'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
      expect(find.text('Wat wil je bereiken?'), findsOneWidget);
    });
  });

  group('HomeScreen', () {
    testWidgets('shows a loading state while fetching streak and recovery status', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: HomeScreen(accessToken: 'test-token', email: 'test@example.com'),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Laat de (in deze test onbereikbare) fetch-calls op tijd aflopen
      // zodat er geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });

    // Backend-antwoorden per endpoint; de schedule-response kan per test
    // anders zijn.
    Future<void> pumpHome(WidgetTester tester, {required Map<String, dynamic>? schedule}) async {
      final client = MockClient((request) async {
        final path = request.url.path;
        if (path.endsWith('/motivation/status')) {
          // Laatste 7 dagen: telt ook vorige vrijdag mee.
          return http.Response(jsonEncode({'consistencyStreakWeeks': 1, 'completedThisWeek': 1, 'weeklyTarget': 3}), 200);
        }
        if (path.endsWith('/recovery/status')) {
          return http.Response(jsonEncode({'byMuscleGroup': [], 'byMovementPattern': []}), 200);
        }
        if (path.endsWith('/schedule/week') && schedule != null) {
          return http.Response(jsonEncode(schedule), 200, headers: {'content-type': 'application/json; charset=utf-8'});
        }
        return http.Response('', 500);
      });
      await http.runWithClient(() async {
        await tester.pumpWidget(
          const MaterialApp(home: HomeScreen(accessToken: 'test-token', email: 'test@example.com')),
        );
        await tester.pumpAndSettle();
      }, () => client);
    }

    testWidgets('"Deze week" = de kalenderweek van de weekplanning, niet de laatste 7 dagen', (tester) async {
      await pumpHome(tester, schedule: {
        'completedThisWeek': 0,
        'weeklyTarget': 3,
        'smartReschedule': 'PREMIUM_REQUIRED',
        'coachMessage': 'Geen probleem, we gaan gewoon verder. 💪 Je volgende training staat klaar voor vandaag.',
      });

      expect(find.text('Deze week: 0 van de 3 trainingen'), findsOneWidget);
      expect(find.text('Je week'), findsOneWidget);
      expect(find.textContaining('Je volgende training staat klaar voor vandaag'), findsOneWidget);
      expect(find.text('Ontdek Premium'), findsOneWidget);
    });

    testWidgets('meer trainingen dan het weekdoel: "weekdoel gehaald", niet "30 van de 2"', (tester) async {
      await pumpHome(tester, schedule: {
        'completedThisWeek': 30,
        'weeklyTarget': 2,
        'smartReschedule': 'NOT_NEEDED',
        'coachMessage': null,
      });

      expect(find.text('Deze week: weekdoel gehaald ✓ (30 trainingen, doel 2)'), findsOneWidget);
      expect(find.textContaining('van de 2'), findsNothing);
      expect(find.text('Je week'), findsNothing);
    });

    testWidgets('weekplanning niet beschikbaar: Home werkt gewoon, met de telling van de Motivation Engine', (
      tester,
    ) async {
      await pumpHome(tester, schedule: null);

      expect(find.text('Deze week: 1 van de 3 trainingen'), findsOneWidget);
      expect(find.text('Je week'), findsNothing);
    });
  });

  group('TrainScreen', () {
    testWidgets('shows a loading state while fetching today\'s workout', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: TrainScreen(accessToken: 'test-token', email: 'test@example.com'),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('WorkoutScreen', () {
    const exercises = [
      WorkoutExercise(
        id: 'exercise-1',
        name: 'Bodyweight Squat',
        equipment: 'BODYWEIGHT',
        targetSets: 2,
        targetReps: 5,
      ),
      WorkoutExercise(
        id: 'exercise-2',
        name: 'Goblet Squat',
        equipment: 'DUMBBELL',
        targetSets: 1,
        targetReps: 8,
      ),
    ];

    Widget buildWorkoutScreen() => const MaterialApp(
      home: WorkoutScreen(
        accessToken: 'test-token',
        templateId: 'template-1',
        exercises: exercises,
      ),
    );

    testWidgets('toont "Aangepast aan je energie vandaag" alleen als de backend de training aanpaste', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(buildWorkoutScreen());
      expect(find.text('Aangepast aan je energie vandaag'), findsNothing);

      await tester.pumpWidget(
        const MaterialApp(
          home: WorkoutScreen(
            key: ValueKey('light'),
            accessToken: 'test-token',
            templateId: 'template-1',
            exercises: exercises,
            restSeconds: 60,
            energyLevel: 'LOW',
            energyAdjusted: true,
          ),
        ),
      );
      expect(find.text('Aangepast aan je energie vandaag'), findsOneWidget);
      // De melding blijft staan tijdens de rust.
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      expect(find.text('01:00'), findsOneWidget);
      expect(find.text('Aangepast aan je energie vandaag'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();
    });

    testWidgets('gebruikt standaard 45 s rust, en de kortere Quick Session-rust als die meekomt', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(buildWorkoutScreen());
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      expect(find.text('00:45'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();

      await tester.pumpWidget(
        const MaterialApp(
          home: WorkoutScreen(
            key: ValueKey('quick'),
            accessToken: 'test-token',
            templateId: 'template-1',
            exercises: exercises,
            restSeconds: 30,
          ),
        ),
      );
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      expect(find.text('00:30'), findsOneWidget);
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();
    });

    testWidgets('logt een set in één tik, rust daarna, en gaat dan naar de volgende set', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(buildWorkoutScreen());

      expect(find.text('Oefening 1 van 2'), findsOneWidget);
      expect(find.text('Set 1 van 2'), findsOneWidget);
      expect(find.text('Gewicht (kg)'), findsNothing); // bodyweight: geen gewicht

      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();

      expect(find.text('Rust'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();

      expect(find.text('Set 2 van 2'), findsOneWidget);
    });

    testWidgets('gaat na de laatste set van een oefening naar de volgende oefening', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(buildWorkoutScreen());

      // Oefening 1: 2 sets afronden.
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();

      // Feedback is verplicht voordat de knop bruikbaar wordt.
      expect(find.text('Volgende oefening →'), findsOneWidget);
      var nextButton = find.widgetWithText(AppGradientButton, 'Volgende oefening →');
      expect(tester.widget<AppGradientButton>(nextButton).onPressed, isNull);

      await tester.ensureVisible(find.text('🙂 Goed'));
      await tester.tap(find.text('🙂 Goed'));
      await tester.pump();
      await tester.ensureVisible(find.text('Nee'));
      await tester.tap(find.text('Nee'));
      await tester.pump();
      expect(tester.widget<AppGradientButton>(nextButton).onPressed, isNotNull);

      await tester.ensureVisible(nextButton);
      await tester.tap(nextButton);
      await tester.pump();

      expect(find.text('Oefening 2 van 2'), findsOneWidget);
      expect(find.text('Gewicht (kg)'), findsOneWidget); // dumbbell: wel gewicht

      // Laatste oefening, laatste set → "Training afronden".
      await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
      await tester.pump();
      await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
      await tester.pump();

      // Ook ongemak/pijn = "Ja" moet de knop vrijgeven.
      expect(find.text('Training afronden'), findsOneWidget);
      await tester.ensureVisible(find.text('😣 Te zwaar'));
      await tester.tap(find.text('😣 Te zwaar'));
      await tester.pump();
      await tester.ensureVisible(find.text('Ja'));
      await tester.tap(find.text('Ja'));
      await tester.pump();

      final finishButton = find.widgetWithText(AppGradientButton, 'Training afronden');
      await tester.ensureVisible(finishButton);
      await tester.tap(finishButton);
      await tester.pump();

      expect(find.text('Training voltooid! 💪'), findsOneWidget);
      expect(find.text('3 sets gelogd'), findsOneWidget);

      // Laat de (in deze test onbereikbare) opslag-call afronden zodat er
      // geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('ProgressScreen', () {
    testWidgets('shows a loading state while fetching sessions', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: ProgressScreen(accessToken: 'test-token')),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Laat de (in deze test onbereikbare) fetch-call afronden zodat er
      // geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('CoachScreen', () {
    testWidgets('shows a loading state while fetching coach messages', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(home: CoachScreen(accessToken: 'test-token')),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Laat de (in deze test onbereikbare) fetch-calls op tijd aflopen
      // zodat er geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('NutritionScreen', () {
    testWidgets('shows the weight logging form immediately, alongside the loading trend card', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(home: NutritionScreen(accessToken: 'test-token')),
      );

      expect(find.text('Gewicht loggen'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Gewicht (kg)'), findsOneWidget);
      expect(find.widgetWithText(AppGradientButton, 'Gewicht opslaan'), findsOneWidget);
      // Trend-, water- en caloriedoel-kaart laden allemaal tegelijk.
      expect(find.byType(CircularProgressIndicator), findsNWidgets(3));

      // Laat de (in deze test onbereikbare) trend/water-fetches op tijd
      // aflopen zodat er geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('shows a validation error for an unrealistic weight', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(home: NutritionScreen(accessToken: 'test-token')),
      );

      await tester.ensureVisible(find.widgetWithText(TextFormField, 'Gewicht (kg)'));
      await tester.enterText(find.widgetWithText(TextFormField, 'Gewicht (kg)'), '5');
      final saveButton = find.widgetWithText(AppGradientButton, 'Gewicht opslaan');
      await tester.ensureVisible(saveButton);
      await tester.tap(saveButton);
      await tester.pump();

      expect(find.text('Vul een geldig gewicht in (20-400 kg)'), findsOneWidget);

      await tester.pump(const Duration(seconds: 6));
    });

    testWidgets('shows the quick water-logging buttons', (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: NutritionScreen(accessToken: 'test-token')),
      );

      expect(find.widgetWithText(OutlinedButton, '+250 ml'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '+500 ml'), findsOneWidget);

      await tester.tap(find.widgetWithText(OutlinedButton, '+250 ml'));
      await tester.pump();

      // Laat alle (in deze test onbereikbare) fetches op tijd aflopen
      // zodat er geen hangende timer overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });
  });

  group('EnergyCheckSheet', () {
    Future<EnergyChoice?> pickFromSheet(WidgetTester tester, String label) async {
      EnergyChoice? result;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () async => result = await showEnergyCheckSheet(context),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text('Hoe voel je je vandaag?'), findsOneWidget);
      await tester.tap(find.text(label));
      await tester.pumpAndSettle();
      return result;
    }

    testWidgets('toont drie keuzes + Overslaan en geeft de backend-waarde terug', (WidgetTester tester) async {
      expect((await pickFromSheet(tester, 'Weinig energie'))?.level, 'LOW');
      expect((await pickFromSheet(tester, 'Normaal'))?.level, 'NORMAL');
      expect((await pickFromSheet(tester, 'Goed'))?.level, 'HIGH');
    });

    testWidgets('Overslaan geeft "overgeslagen" terug (geen energie), niet annuleren', (WidgetTester tester) async {
      final result = await pickFromSheet(tester, 'Overslaan');

      expect(result, same(EnergyChoice.skipped));
      expect(result?.level, isNull);
    });
  });

  group('PremiumTeaserCard', () {
    testWidgets('toont slot-label, uitleg en opent de Premium-uitleg bij "Ontdek Premium"', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(
            body: PremiumTeaserCard(
              icon: Icons.local_fire_department_outlined,
              title: 'Caloriedoel',
              message: 'Met Premium krijg je een persoonlijke calorie-richtwaarde als range.',
              accessToken: 'test-token',
              onPremiumActivated: () {},
            ),
          ),
        ),
      );

      expect(find.text('Caloriedoel'), findsOneWidget);
      expect(find.text('Premium'), findsOneWidget);
      expect(find.byIcon(Icons.lock_outline), findsOneWidget);
      expect(find.textContaining('calorie-richtwaarde'), findsOneWidget);
      // Nooit een getal/range in de teaser.
      expect(find.textContaining('kcal'), findsNothing);

      await tester.tap(find.widgetWithText(OutlinedButton, 'Ontdek Premium'));
      await tester.pumpAndSettle();

      expect(find.text('Jij traint. Wij denken mee.'), findsOneWidget);
      expect(find.text('Quick Session'), findsOneWidget);
      expect(find.text('Persoonlijk caloriedoel'), findsOneWidget);
      expect(find.textContaining('blijven altijd gratis'), findsOneWidget);
      expect(find.widgetWithText(AppGradientButton, 'Probeer 7 dagen gratis'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Niet nu'));
      await tester.pumpAndSettle();

      expect(find.text('Jij traint. Wij denken mee.'), findsNothing);
    });
  });

  group('MainShell', () {
    testWidgets('toont de 5 tabs en wisselt naar Nutrition bij tikken', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MainShell(accessToken: 'test-token', email: 'test@example.com'),
        ),
      );

      final navBar = find.byType(NavigationBar);
      expect(navBar, findsOneWidget);
      for (final label in ['Home', 'Train', 'Progress', 'Nutrition', 'Coach']) {
        expect(find.descendant(of: navBar, matching: find.text(label)), findsOneWidget);
      }

      await tester.tap(find.descendant(of: navBar, matching: find.text('Nutrition')));
      await tester.pump();

      expect(find.text('Gewicht loggen'), findsOneWidget);

      // Laat de achtergrond-fetches van Train/Progress/Coach (al gebouwd
      // via IndexedStack) op tijd aflopen zodat er geen hangende timer
      // overblijft na de test.
      await tester.pump(const Duration(seconds: 6));
    });
  });
}
