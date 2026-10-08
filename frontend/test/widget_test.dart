import 'dart:convert';
import 'dart:io';

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
import 'package:lovtofit_app/profile_edit_screen.dart';
import 'package:lovtofit_app/profile_screen.dart';
import 'package:lovtofit_app/progress_screen.dart';
import 'package:lovtofit_app/recipe_detail_screen.dart';
import 'package:lovtofit_app/register_screen.dart';
import 'package:lovtofit_app/theme/app_theme.dart';
import 'package:lovtofit_app/train_screen.dart';
import 'package:lovtofit_app/widgets/energy_check_sheet.dart';
import 'package:lovtofit_app/widgets/exercise_photo.dart';
import 'package:lovtofit_app/widgets/premium_teaser_card.dart';
import 'package:lovtofit_app/widgets/recipe_list_card.dart';
import 'package:lovtofit_app/widgets/settings_menu_button.dart';
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

  group('ExercisePhoto', () {
    Widget wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

    testWidgets('toont de duo-foto als één afbeelding die het kader vult (cover)', (tester) async {
      await tester.pumpWidget(wrap(const ExercisePhoto(imageKey: 'squats', width: 300, height: 200)));

      final image = tester.widget<Image>(find.byType(Image));
      expect((image.image as AssetImage).assetName, 'assets/exercises/lovtofit_squats_duo.webp');
      expect(image.fit, BoxFit.cover);
      expect(find.text('Foto volgt binnenkort'), findsNothing);
    });

    testWidgets('zonder foto: nette placeholder met tekst, geen afbeelding', (tester) async {
      await tester.pumpWidget(wrap(const ExercisePhoto(imageKey: null, width: 300, height: 200)));

      expect(find.byType(Image), findsNothing);
      expect(find.byKey(const ValueKey('exercise-photo-placeholder')), findsOneWidget);
      expect(find.text('Foto volgt binnenkort'), findsOneWidget);
    });

    testWidgets('compacte placeholder (lijstjes): alleen een icoon', (tester) async {
      await tester.pumpWidget(wrap(const ExercisePhoto(imageKey: null, width: 48, height: 32, compact: true)));

      expect(find.byIcon(Icons.fitness_center), findsOneWidget);
      expect(find.text('Foto volgt binnenkort'), findsNothing);
    });

    test('elke foto-sleutel uit de seed heeft een duo-bestand in assets/exercises', () {
      final seed = File('../backend/prisma/seed-data/exercises.ts').readAsStringSync();
      final keys = RegExp(r"imageKey: '([a-z_]+)'").allMatches(seed).map((m) => m.group(1)!).toList();

      expect(keys, hasLength(35)); // Reverse en Walking Lunge delen "lunges"
      for (final key in keys) {
        expect(File(exercisePhotoAsset(key)).existsSync(), isTrue, reason: 'ontbreekt: ${exercisePhotoAsset(key)}');
      }
    });
  });

  group('WorkoutScreen', () {
    // Telefoonformaat (zoals de CPH2247: 393×873 punten) i.p.v. het
    // standaard testvenster van 800×600.
    setUp(() {
      final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
      view.physicalSize = const Size(393, 873);
      view.devicePixelRatio = 1;
    });
    tearDown(() {
      final view = TestWidgetsFlutterBinding.instance.platformDispatcher.views.first;
      view.resetPhysicalSize();
      view.resetDevicePixelRatio();
    });

    const exercises = [
      WorkoutExercise(
        id: 'exercise-1',
        name: 'Bodyweight Squat',
        equipment: 'BODYWEIGHT',
        targetSets: 2,
        targetReps: 5,
        imageKey: 'squats',
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

    testWidgets('toont de oefening-foto boven de oefening, of de placeholder als er geen is', (tester) async {
      await tester.pumpWidget(buildWorkoutScreen());

      final image = tester.widget<Image>(find.byType(Image));
      expect((image.image as AssetImage).assetName, 'assets/exercises/lovtofit_squats_duo.webp');

      await tester.pumpWidget(
        const MaterialApp(
          home: WorkoutScreen(
            key: ValueKey('zonder-foto'),
            accessToken: 'test-token',
            templateId: 'template-1',
            exercises: [WorkoutExercise(id: 'x', name: 'Dead Bug', equipment: 'BODYWEIGHT', targetSets: 1, targetReps: 8)],
          ),
        ),
      );
      expect(find.text('Foto volgt binnenkort'), findsOneWidget);
    });

    // "SET KLAAR" zonder scrollen in beeld (afvinken in max. 2 tikken), per
    // schermformaat en in de zwaarste situaties. Uitzondering: op een heel
    // klein scherm (640 hoog) met de energiebanner past het niet — daar moet
    // je op een Light Session-dag een klein stukje scrollen.
    const screens = {'CPH2247 393×873': Size(393, 873), 'klein 360×740': Size(360, 740), 'heel klein 360×640': Size(360, 640)};
    for (final screen in screens.entries) {
      for (final banner in [false, true]) {
        if (banner && screen.value.height < 700) continue;
        testWidgets('"SET KLAAR" in beeld op ${screen.key}${banner ? ' met energiebanner' : ''} (oefening met gewicht)', (tester) async {
          tester.view.physicalSize = screen.value;
          await tester.pumpWidget(
            MaterialApp(
              home: WorkoutScreen(
                accessToken: 'test-token',
                templateId: 'template-1',
                energyAdjusted: banner,
                exercises: const [
                  WorkoutExercise(id: 'x', name: 'Dumbbell Row', equipment: 'DUMBBELL', targetSets: 3, targetReps: 10, imageKey: 'dumbbell_row'),
                ],
              ),
            ),
          );

          expect(tester.getRect(find.text('SET KLAAR')).bottom, lessThanOrEqualTo(screen.value.height));
        });
      }
    }

    test('kader is altijd 4:3 en krimpt op kleine schermen (blijft 4:3)', () {
      for (final screen in const [Size(393, 873), Size(360, 740), Size(360, 640)]) {
        final frame = exercisePhotoFrameSize(availableWidth: screen.width - 48, screenHeight: screen.height);
        expect(frame.width / frame.height, closeTo(4 / 3, 0.001));
        expect(frame.width, lessThanOrEqualTo(screen.width - 48));
      }
      expect(exercisePhotoFrameSize(availableWidth: 345, screenHeight: 873).height, closeTo(258.75, 0.01));
      expect(exercisePhotoFrameSize(availableWidth: 312, screenHeight: 740).height, 170);
      expect(exercisePhotoFrameSize(availableWidth: 312, screenHeight: 640).height, 130);
    });

    testWidgets('de foto vult het kader volledig (cover, van rand tot rand), ook een vierkante foto', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: WorkoutScreen(
            accessToken: 'test-token',
            templateId: 'template-1',
            exercises: [WorkoutExercise(id: 'x', name: 'Dead Bug', equipment: 'BODYWEIGHT', targetSets: 1, targetReps: 8, imageKey: 'dead_bug')],
          ),
        ),
      );

      final image = find.byType(Image);
      expect(tester.widget<Image>(image).fit, BoxFit.cover);
      final frame = tester.getRect(find.ancestor(of: image, matching: find.byType(SizedBox)).first);
      // CPH2247-formaat: volle breedte (345), 4:3.
      expect(frame.width, 345);
      expect(frame.width / frame.height, closeTo(4 / 3, 0.001));
      expect(tester.getRect(image), frame);
    });

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

    group('warming-up en cooldown (Fase 12)', () {
      const warmup = [
        WorkoutBlockItem(id: 'w1', name: 'High Knees', durationSeconds: 90, imageKey: 'high_knees'),
        WorkoutBlockItem(id: 'w2', name: 'Cat-Cow', durationSeconds: 90, imageKey: 'cat_cow'),
      ];
      const cooldown = [
        WorkoutBlockItem(id: 'c1', name: 'Downward Dog', durationSeconds: 60),
        WorkoutBlockItem(id: 'c2', name: 'Standing Forward Fold', durationSeconds: 60),
      ];
      const oneExercise = [
        WorkoutExercise(id: 'x', name: 'Bodyweight Squat', equipment: 'BODYWEIGHT', targetSets: 1, targetReps: 8),
      ];

      Widget build() => const MaterialApp(
        home: WorkoutScreen(
          accessToken: 'test-token',
          templateId: 'template-1',
          exercises: oneExercise,
          warmup: warmup,
          cooldown: cooldown,
        ),
      );

      Future<void> finishMainPart(WidgetTester tester) async {
        await tester.tap(find.widgetWithText(AppGradientButton, 'SET KLAAR'));
        await tester.pump();
        await tester.tap(find.widgetWithText(OutlinedButton, 'Rust overslaan'));
        await tester.pump();
        await tester.ensureVisible(find.text('🙂 Goed'));
        await tester.tap(find.text('🙂 Goed'));
        await tester.pump();
        await tester.ensureVisible(find.text('Nee'));
        await tester.tap(find.text('Nee'));
        await tester.pump();
        final next = find.widgetWithText(AppGradientButton, 'Naar de cooldown →');
        await tester.ensureVisible(next);
        await tester.tap(next);
        await tester.pump();
      }

      testWidgets('start met de warming-up: timer per oefening, "Klaar →" gaat door', (tester) async {
        await tester.pumpWidget(build());

        expect(find.text('WARMING-UP · 1 van 2'), findsOneWidget);
        expect(find.text('High Knees'), findsOneWidget);
        expect(find.text('01:30'), findsOneWidget);

        await tester.tap(find.widgetWithText(AppGradientButton, 'Klaar →'));
        await tester.pump();
        expect(find.text('WARMING-UP · 2 van 2'), findsOneWidget);
        expect(find.text('Cat-Cow'), findsOneWidget);

        await tester.tap(find.widgetWithText(AppGradientButton, 'Klaar →'));
        await tester.pump();
        expect(find.text('Oefening 1 van 1'), findsOneWidget);
      });

      testWidgets('de timer telt af en gaat bij 0 vanzelf naar de volgende oefening', (tester) async {
        await tester.pumpWidget(build());

        await tester.pump(const Duration(seconds: 30));
        expect(find.text('01:00'), findsOneWidget);
        await tester.pump(const Duration(seconds: 60));
        expect(find.text('Cat-Cow'), findsOneWidget);
        expect(find.text('01:30'), findsOneWidget);

        await tester.tap(find.text('Overslaan'));
        await tester.pump();
      });

      testWidgets('"Overslaan" slaat de hele warming-up over, meteen naar het hoofddeel', (tester) async {
        await tester.pumpWidget(build());

        await tester.tap(find.text('Overslaan'));
        await tester.pump();

        expect(find.text('Oefening 1 van 1'), findsOneWidget);
        expect(find.text('SET KLAAR'), findsOneWidget);
      });

      testWidgets('na het hoofddeel de cooldown; "Overslaan" rondt de training af', (tester) async {
        await tester.pumpWidget(build());
        await tester.tap(find.text('Overslaan'));
        await tester.pump();

        await finishMainPart(tester);

        expect(find.text('COOLDOWN · 1 van 2'), findsOneWidget);
        expect(find.text('Downward Dog'), findsOneWidget);
        expect(find.text('01:00'), findsOneWidget);

        await tester.tap(find.text('Overslaan'));
        await tester.pump();
        expect(find.text('Training voltooid! 💪'), findsOneWidget);
        expect(find.text('1 sets gelogd'), findsOneWidget);

        await tester.pump(const Duration(seconds: 6));
      });

      testWidgets('na de laatste cooldown-oefening: training voltooid', (tester) async {
        await tester.pumpWidget(build());
        await tester.tap(find.text('Overslaan'));
        await tester.pump();
        await finishMainPart(tester);

        await tester.tap(find.widgetWithText(AppGradientButton, 'Klaar →'));
        await tester.pump();
        expect(find.text('Standing Forward Fold'), findsOneWidget);
        await tester.tap(find.widgetWithText(AppGradientButton, 'Klaar →'));
        await tester.pump();

        expect(find.text('Training voltooid! 💪'), findsOneWidget);
        await tester.pump(const Duration(seconds: 6));
      });

      testWidgets('"Klaar →" en "Overslaan" in beeld zonder scrollen op een klein scherm', (tester) async {
        tester.view.physicalSize = const Size(360, 640);
        await tester.pumpWidget(build());

        expect(tester.getRect(find.text('Overslaan')).bottom, lessThanOrEqualTo(640));
      });

      test('parseBlockItems en blockMinutes', () {
        final items = parseBlockItems([
          {'order': 0, 'movementPattern': 'CARDIO', 'durationSeconds': 90, 'exercise': {'id': 'a', 'name': 'High Knees', 'imageKey': 'high_knees'}},
          {'order': 1, 'movementPattern': 'MOBILITY', 'durationSeconds': 90, 'exercise': {'id': 'b', 'name': 'Cat-Cow', 'imageKey': null}},
        ]);

        expect(items.map((i) => i.name), ['High Knees', 'Cat-Cow']);
        expect(items[1].imageKey, isNull);
        expect(blockMinutes(items), 3);
        expect(parseBlockItems(null), isEmpty);
        expect(blockMinutes(const [WorkoutBlockItem(id: 'x', name: 'x', durationSeconds: 60)]), 1);
      });
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
      // Trend-, water-, caloriedoel- en receptenkaart laden allemaal tegelijk.
      expect(find.byType(CircularProgressIndicator), findsNWidgets(4));

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

  group('ProfileScreen', () {
    const json = {'content-type': 'application/json; charset=utf-8'};
    const freePlan = {'plan': 'FREE', 'features': {}, 'subscription': null};
    const someStats = {'totalSessionsCompleted': 13, 'consistencyStreakWeeks': 2};

    // `motivation` null = 404 (onboarding nog niet afgerond).
    Future<void> pumpProfile(
      WidgetTester tester,
      Map<String, dynamic> body, {
      Map<String, dynamic> features = freePlan,
      Map<String, dynamic>? motivation = someStats,
    }) async {
      final client = MockClient((request) async {
        final path = request.url.path;
        if (path.endsWith('/onboarding') && request.method == 'GET') {
          return http.Response(jsonEncode(body), 200, headers: json);
        }
        if (path.endsWith('/features')) {
          return http.Response(jsonEncode(features), 200, headers: json);
        }
        if (path.endsWith('/motivation/status')) {
          return motivation == null
              ? http.Response('{"message":"Onboarding nog niet afgerond"}', 404)
              : http.Response(jsonEncode(motivation), 200, headers: json);
        }
        return http.Response('', 500);
      });
      await http.runWithClient(() async {
        await tester.pumpWidget(const MaterialApp(home: ProfileScreen(accessToken: 'test-token')));
        await tester.pumpAndSettle();
      }, () => client);
    }

    const someProfile = {
      'email': 'test@example.com',
      'goals': ['GET_FIT'],
      'preferences': {
        'location': 'HOME',
        'equipment': ['NONE'],
        'sessionDuration': 'MIN_30',
        'weeklyFrequency': 3,
        'level': 'BEGINNER',
      },
    };

    testWidgets('Free: plan Free en de kerncijfers (totaal trainingen, streak)', (tester) async {
      await pumpProfile(tester, someProfile);

      expect(find.text('Free'), findsOneWidget);
      expect(find.text('13'), findsOneWidget);
      expect(find.text('🔥 2 weken op rij op schema'), findsOneWidget);
    });

    testWidgets('proefperiode: Premium (proefperiode) met de einddatum', (tester) async {
      await pumpProfile(tester, someProfile, features: {
        'plan': 'PREMIUM',
        'features': {},
        'subscription': {'status': 'TRIAL', 'expiresAt': '2026-10-14T12:00:00.000Z'},
      });

      expect(find.text('Premium (proefperiode)'), findsOneWidget);
      expect(find.text('Proefperiode loopt tot'), findsOneWidget);
      expect(find.text('14 okt 2026'), findsOneWidget);
    });

    testWidgets('lopend Premium zonder einddatum: geen datumregel', (tester) async {
      await pumpProfile(tester, someProfile, features: {
        'plan': 'PREMIUM',
        'features': {},
        'subscription': {'status': 'ACTIVE', 'expiresAt': null},
      });

      expect(find.text('Premium'), findsOneWidget);
      expect(find.text('Loopt tot'), findsNothing);
    });

    testWidgets('nog geen streak: bemoedigende tekst, geen 0', (tester) async {
      await pumpProfile(tester, someProfile, motivation: {'totalSessionsCompleted': 0, 'consistencyStreakWeeks': 0});

      expect(find.text('Nog geen streak — elke training telt'), findsOneWidget);
    });

    testWidgets('backend geeft een fout: foutmelding met opnieuw proberen', (tester) async {
      final client = MockClient((request) async => http.Response('', 500));
      await http.runWithClient(() async {
        await tester.pumpWidget(const MaterialApp(home: ProfileScreen(accessToken: 'test-token')));
        await tester.pumpAndSettle();
      }, () => client);

      expect(find.text('Kon je profiel niet ophalen.'), findsOneWidget);
      expect(find.text('Opnieuw proberen'), findsOneWidget);
    });

    testWidgets('toont e-mail en de onboarding-keuzes met Nederlandse labels', (tester) async {
      await pumpProfile(tester, {
        'email': 'test@example.com',
        'goals': ['LOSE_WEIGHT', 'GET_FIT'],
        'preferences': {
          'location': 'HOME',
          'equipment': ['DUMBBELLS', 'RESISTANCE_BANDS'],
          'sessionDuration': 'MIN_30',
          'weeklyFrequency': 3,
          'level': 'BEGINNER',
        },
      });

      expect(find.text('test@example.com'), findsOneWidget);
      expect(find.text('Afvallen, Fit worden'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Beginner'), 100);
      expect(find.text('🏠 Thuis'), findsOneWidget);
      expect(find.text('Dumbbells, Elastieken'), findsOneWidget);
      expect(find.text('3× per week'), findsOneWidget);
      expect(find.text('⏱ 30 min'), findsOneWidget);
      expect(find.text('Beginner'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Profiel aanpassen'), 100);
      expect(find.text('Profiel aanpassen'), findsOneWidget);
    });

    testWidgets('locatie Buiten (nog niet in de onboarding) krijgt toch een label', (tester) async {
      await pumpProfile(tester, {
        'email': 'test@example.com',
        'goals': ['GET_FIT'],
        'preferences': {
          'location': 'OUTDOOR',
          'equipment': ['NONE'],
          'sessionDuration': 'MIN_15',
          'weeklyFrequency': 2,
          'level': 'ADVANCED',
        },
      });

      expect(find.text('Je doel'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('🌳 Buiten'), 100);
      expect(find.text('🌳 Buiten'), findsOneWidget);
    });

    testWidgets('zonder afgeronde onboarding: duidelijke melding, geen crash', (tester) async {
      await pumpProfile(tester, {'email': 'test@example.com', 'goals': [], 'preferences': null}, motivation: null);

      expect(find.text('Nog geen doel gekozen'), findsOneWidget);
      expect(find.text('Je hebt de onboarding nog niet afgerond.'), findsOneWidget);
      // Motivation geeft dan 404: geen cijferkaart, maar wel het plan.
      expect(find.text('Jouw cijfers'), findsNothing);
      expect(find.text('Free'), findsOneWidget);
    });

    testWidgets('het tandwiel opent het profiel-scherm', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(appBar: AppBar(actions: const [SettingsMenuButton(accessToken: 'test-token')])),
      ));
      // Direct naar het profiel: geen menu meer (uitloggen staat op het profiel).
      await tester.tap(find.byIcon(Icons.settings));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(ProfileScreen), findsOneWidget);

      // Laat de (in deze test onbereikbare) fetch op tijd aflopen.
      await tester.pump(const Duration(seconds: 6));
    });

    // Startscherm (zoals LoginScreen) → tabs → profiel, net als in de app.
    Future<void> pumpFromStart(WidgetTester tester, {bool backendDown = false}) async {
      final client = MockClient((request) async {
        if (backendDown) return http.Response('', 500);
        final path = request.url.path;
        if (path.endsWith('/onboarding')) return http.Response(jsonEncode(someProfile), 200, headers: json);
        if (path.endsWith('/features')) return http.Response(jsonEncode(freePlan), 200, headers: json);
        if (path.endsWith('/motivation/status')) return http.Response(jsonEncode(someStats), 200, headers: json);
        return http.Response('', 500);
      });
      await http.runWithClient(() async {
        await tester.pumpWidget(MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => Scaffold(
                    appBar: AppBar(actions: const [SettingsMenuButton(accessToken: 'test-token')]),
                    body: const Text('tabs'),
                  ),
                )),
                child: const Text('startscherm'),
              ),
            ),
          ),
        ));
        await tester.tap(find.text('startscherm'));
        await tester.pumpAndSettle();
        await tester.tap(find.byIcon(Icons.settings));
        await tester.pumpAndSettle();
      }, () => client);
    }

    Future<void> tapLogout(WidgetTester tester) async {
      await tester.scrollUntilVisible(find.text('Uitloggen'), 100);
      await tester.tap(find.text('Uitloggen'));
      await tester.pumpAndSettle();
    }

    testWidgets('uitloggen vanaf het profiel: na bevestigen terug op het startscherm', (tester) async {
      await pumpFromStart(tester);
      await tapLogout(tester);
      expect(find.text('Uitloggen?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Uitloggen').last);
      await tester.pumpAndSettle();

      expect(find.text('startscherm'), findsOneWidget);
      expect(find.byType(ProfileScreen), findsNothing);
      expect(find.text('tabs'), findsNothing);
    });

    testWidgets('uitloggen annuleren: je blijft op het profiel', (tester) async {
      await pumpFromStart(tester);
      await tapLogout(tester);

      await tester.tap(find.text('Annuleren'));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('ook zonder verbinding kan je uitloggen', (tester) async {
      await pumpFromStart(tester, backendDown: true);
      expect(find.text('Kon je profiel niet ophalen.'), findsOneWidget);

      await tester.tap(find.text('Uitloggen'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Uitloggen').last);
      await tester.pumpAndSettle();

      expect(find.text('startscherm'), findsOneWidget);
    });
  });

  group('ProfileEditScreen', () {
    const initial = ProfileChoices(
      goals: {'LOSE_WEIGHT'},
      location: 'HOME',
      equipment: {'DUMBBELLS'},
      sessionDuration: 'MIN_30',
      weeklyFrequency: 3,
      level: 'BEGINNER',
    );

    // Opent het bewerkscherm vanaf een knop, zodat we de pop-uitkomst zien.
    Future<List<Object?>> pumpEdit(WidgetTester tester, List<Map<String, dynamic>> posted,
        {ProfileChoices choices = initial, int status = 201}) async {
      final results = <Object?>[];
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/onboarding') && request.method == 'POST') {
          posted.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response('{}', status);
        }
        return http.Response('', 500);
      });
      await http.runWithClient(() async {
        await tester.pumpWidget(MaterialApp(
          home: Builder(
            builder: (context) => TextButton(
              onPressed: () async => results.add(await Navigator.of(context).push<bool>(
                MaterialPageRoute(builder: (_) => ProfileEditScreen(accessToken: 'test-token', initial: choices)),
              )),
              child: const Text('open'),
            ),
          ),
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
      }, () => client);
      return results;
    }

    // ListView bouwt lui: eerst scrollen tot de knop bestaat.
    Future<void> scrollTo(WidgetTester tester, String text) =>
        tester.scrollUntilVisible(find.text(text), 100, scrollable: find.byType(Scrollable).first);

    Future<void> tapSave(WidgetTester tester) async {
      await tester.tap(find.text('Opslaan'));
      await tester.pumpAndSettle();
    }

    testWidgets('doel wisselen: stuurt alles via POST /onboarding en sluit met true', (tester) async {
      final posted = <Map<String, dynamic>>[];
      late List<Object?> results;
      final client = MockClient((request) async {
        posted.add(jsonDecode(request.body) as Map<String, dynamic>);
        return http.Response('{}', 201);
      });
      await http.runWithClient(() async {
        results = await pumpEdit(tester, posted);
        expect(find.textContaining('bewaard als gepauzeerd'), findsNothing);

        await tester.tap(find.text('Afvallen'));
        await tester.tap(find.text('Fit worden'));
        await tester.pump();
        expect(find.textContaining('bewaard als gepauzeerd'), findsOneWidget);

        await scrollTo(tester, '4× per week');
        await tester.tap(find.text('4× per week'));
        await tapSave(tester);
      }, () => client);

      expect(posted.single, {
        'goals': ['GET_FIT'],
        'location': 'HOME',
        'equipment': ['DUMBBELLS'],
        'sessionDuration': 'MIN_30',
        'weeklyFrequency': 4,
        'level': 'BEGINNER',
      });
      expect(results, [true]);
      expect(find.byType(ProfileEditScreen), findsNothing);
    });

    testWidgets('zonder doel kan je niet opslaan', (tester) async {
      final posted = <Map<String, dynamic>>[];
      await pumpEdit(tester, posted);

      await tester.tap(find.text('Afvallen'));
      await tester.pump();
      await tapSave(tester);

      expect(posted, isEmpty);
      expect(find.byType(ProfileEditScreen), findsOneWidget);
    });

    testWidgets('Geen apparatuur sluit de rest uit', (tester) async {
      final posted = <Map<String, dynamic>>[];
      final client = MockClient((request) async {
        posted.add(jsonDecode(request.body) as Map<String, dynamic>);
        return http.Response('{}', 201);
      });
      await http.runWithClient(() async {
        await pumpEdit(tester, posted);
        await scrollTo(tester, 'Geen apparatuur');
        await tester.tap(find.text('Geen apparatuur'));
        await tapSave(tester);
      }, () => client);

      expect(posted.single['equipment'], ['NONE']);
    });

    testWidgets('locatie Buiten blijft kiesbaar voor wie het al heeft', (tester) async {
      await pumpEdit(tester, [], choices: const ProfileChoices(
        goals: {'GET_FIT'},
        location: 'OUTDOOR',
        equipment: {'NONE'},
        sessionDuration: 'MIN_15',
        weeklyFrequency: 2,
        level: 'ADVANCED',
      ));
      expect(find.text('🌳 Buiten'), findsOneWidget);
    });

    testWidgets('opslaan mislukt: foutmelding, scherm blijft open', (tester) async {
      final client = MockClient((request) async => http.Response('{}', 400));
      await http.runWithClient(() async {
        await pumpEdit(tester, [], status: 400);
        await tapSave(tester);
      }, () => client);

      expect(find.text('Opslaan lukte niet. Probeer het opnieuw.'), findsOneWidget);
      expect(find.byType(ProfileEditScreen), findsOneWidget);
    });
  });

  group('RecipeListCard', () {
    Recipe recipe(String name, String mealType, {bool locked = false}) => Recipe.fromJson({
          'id': name,
          'name': name,
          'goal': 'GENERAL',
          'mealType': mealType,
          'description': 'Omschrijving van $name',
          'kcalMin': 330,
          'kcalMax': 400,
          'locked': locked,
          'ingredients': locked ? null : ['2 eieren'],
          'steps': locked ? null : ['Kook de eieren.'],
        });

    Future<void> pumpCard(WidgetTester tester, List<Recipe> recipes, {List<String> goals = const ['GENERAL']}) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: RecipeListCard(
              goals: goals,
              recipes: recipes,
              accessToken: 'test-token',
              onPremiumActivated: () {},
            ),
          ),
        ),
      ));
    }

    testWidgets('Free: per maaltijd gegroepeerd, kcal als range, vergrendelde met Premium-label', (tester) async {
      await pumpCard(tester, [
        recipe('Boterham met ei', 'BREAKFAST'),
        recipe('Couscoussalade', 'LUNCH', locked: true),
        recipe('Wokschotel', 'DINNER'),
        recipe('Linzencurry', 'DINNER', locked: true),
        recipe('Appel met pindakaas', 'SNACK', locked: true),
      ]);

      expect(find.text('Recepten voor jou'), findsOneWidget);
      expect(find.text('Afgestemd op algemeen gezond'), findsOneWidget);
      for (final heading in ['Ontbijt', 'Lunch', 'Diner', 'Tussendoor']) {
        expect(find.text(heading), findsOneWidget);
      }
      expect(find.text('330–400 kcal'), findsNWidgets(5));
      expect(find.byType(PremiumBadge), findsNWidgets(3));
      expect(find.text('Nog 3 recepten met Premium.'), findsOneWidget);
      expect(find.text('Ontdek Premium'), findsOneWidget);
    });

    testWidgets('tik op een vergrendeld recept: het Premium-infoblad (met recepten) opent', (tester) async {
      await pumpCard(tester, [recipe('Couscoussalade', 'LUNCH', locked: true)]);

      await tester.tap(find.text('Couscoussalade'));
      await tester.pumpAndSettle();

      expect(find.text('Probeer 7 dagen gratis'), findsOneWidget);
      expect(find.text('Alle recepten'), findsOneWidget);
    });

    testWidgets('Premium: niets vergrendeld, geen label en geen "Ontdek Premium"', (tester) async {
      await pumpCard(tester, [
        recipe('Overnight oats', 'BREAKFAST'),
        recipe('Zalm met rijst', 'DINNER'),
      ], goals: ['BUILD_MUSCLE', 'GENERAL']);

      expect(find.text('Afgestemd op spieropbouw en algemeen gezond'), findsOneWidget);
      expect(find.byType(PremiumBadge), findsNothing);
      expect(find.text('Ontdek Premium'), findsNothing);
      // Lege maaltijden krijgen geen kopje.
      expect(find.text('Lunch'), findsNothing);
    });

    testWidgets('vergrendeld recept zonder ingrediënten/bereiding parseert zonder fout', (tester) async {
      final locked = recipe('Linzencurry', 'DINNER', locked: true);
      expect(locked.ingredients, isNull);
      expect(locked.steps, isNull);
      expect(locked.kcalRange, '330–400 kcal');
    });
  });

  group('NutritionScreen recepten', () {
    testWidgets('haalt GET /recipes op en toont de receptenkaart', (tester) async {
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/recipes')) {
          return http.Response(
            jsonEncode({
              'goals': ['LOSE_WEIGHT'],
              'access': 'PREMIUM_REQUIRED',
              'recipes': [
                {
                  'id': '1', 'name': 'Griekse yoghurt met bessen', 'goal': 'LOSE_WEIGHT', 'mealType': 'BREAKFAST',
                  'description': 'Fris ontbijt.', 'kcalMin': 280, 'kcalMax': 350, 'locked': false,
                  'ingredients': ['200 g yoghurt'], 'steps': ['Schep in een kom.'],
                },
                {
                  'id': '2', 'name': 'Kabeljauw met broccoli', 'goal': 'LOSE_WEIGHT', 'mealType': 'DINNER',
                  'description': 'Lichte vismaaltijd.', 'kcalMin': 330, 'kcalMax': 400, 'locked': true,
                  'ingredients': null, 'steps': null,
                },
              ],
            }),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }
        return http.Response('', 500);
      });
      await http.runWithClient(() async {
        await tester.pumpWidget(const MaterialApp(home: NutritionScreen(accessToken: 'test-token')));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text('Recepten voor jou'), 200, scrollable: find.byType(Scrollable).first);
      }, () => client);

      expect(find.text('Recepten voor jou'), findsOneWidget);
      expect(find.text('Afgestemd op afvallen'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Kabeljauw met broccoli'), 200, scrollable: find.byType(Scrollable).first);
      expect(find.text('280–350 kcal'), findsOneWidget);
      expect(find.text('Nog 1 recept met Premium.'), findsOneWidget);
    });
  });

  group('RecipeDetailScreen', () {
    final open = Recipe.fromJson({
      'id': '1',
      'name': 'Volkorenboterham met ei en tomaat',
      'goal': 'GENERAL',
      'mealType': 'BREAKFAST',
      'description': 'Eenvoudig ontbijt dat lang verzadigt.',
      'kcalMin': 330,
      'kcalMax': 400,
      'locked': false,
      'ingredients': ['2 sneetjes volkorenbrood', '2 eieren', '1 tomaat, in plakjes'],
      'steps': ['Kook de eieren.', 'Beleg het brood met tomaat.', 'Leg het ei erop.'],
    });
    final locked = Recipe.fromJson({
      'id': '2',
      'name': 'Linzencurry met rijst',
      'goal': 'GENERAL',
      'mealType': 'DINNER',
      'description': 'Vegetarische curry.',
      'kcalMin': 520,
      'kcalMax': 620,
      'locked': true,
      'ingredients': null,
      'steps': null,
    });

    testWidgets('toont naam, maaltijd, kcal-range, ingrediënten en genummerde bereiding', (tester) async {
      await tester.pumpWidget(MaterialApp(home: RecipeDetailScreen(recipe: open)));

      expect(find.text('Volkorenboterham met ei en tomaat'), findsOneWidget);
      expect(find.text('Ontbijt'), findsOneWidget);
      expect(find.text('330–400 kcal'), findsOneWidget);
      expect(find.text('Kcal is een schatting per portie.'), findsOneWidget);
      expect(find.text('Ingrediënten'), findsOneWidget);
      expect(find.text('2 eieren'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Leg het ei erop.'), 100);
      expect(find.text('Bereiding'), findsOneWidget);
      for (final number in ['1', '2', '3']) {
        expect(find.text(number), findsOneWidget);
      }
    });

    Future<void> pumpList(WidgetTester tester, List<Recipe> recipes) async {
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: SingleChildScrollView(
              child: RecipeListCard(
                goals: const ['GENERAL'],
                recipes: recipes,
                accessToken: 'test-token',
                onPremiumActivated: () {},
                onOpenRecipe: (recipe) => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => RecipeDetailScreen(recipe: recipe)),
                ),
              ),
            ),
          ),
        ),
      ));
    }

    testWidgets('tik op een open recept opent het detailscherm; terug brengt je naar de lijst', (tester) async {
      await pumpList(tester, [open, locked]);
      expect(find.byIcon(Icons.chevron_right), findsOneWidget);

      await tester.tap(find.text('Volkorenboterham met ei en tomaat'));
      await tester.pumpAndSettle();
      expect(find.byType(RecipeDetailScreen), findsOneWidget);
      expect(find.text('2 sneetjes volkorenbrood'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(RecipeDetailScreen), findsNothing);
      expect(find.text('Recepten voor jou'), findsOneWidget);
    });

    testWidgets('een vergrendeld recept opent nooit het detailscherm (wel het Premium-infoblad)', (tester) async {
      await pumpList(tester, [open, locked]);

      await tester.tap(find.text('Linzencurry met rijst'));
      await tester.pumpAndSettle();

      expect(find.byType(RecipeDetailScreen), findsNothing);
      expect(find.text('Probeer 7 dagen gratis'), findsOneWidget);
    });
  });
}
