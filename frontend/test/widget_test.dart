import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
