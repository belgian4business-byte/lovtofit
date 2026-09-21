import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:lovtofit_app/main.dart';
import 'package:lovtofit_app/onboarding_flow.dart';
import 'package:lovtofit_app/register_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('shows the login form with email, password and submit button', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(const LovtofitApp());

      expect(find.text('Inloggen'), findsWidgets);
      expect(find.widgetWithText(TextFormField, 'E-mailadres'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'Wachtwoord'), findsOneWidget);
      expect(find.widgetWithText(FilledButton, 'Inloggen'), findsOneWidget);
    });

    testWidgets('shows validation errors for empty submission', (WidgetTester tester) async {
      await tester.pumpWidget(const LovtofitApp());

      await tester.tap(find.widgetWithText(FilledButton, 'Inloggen'));
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

      await tester.tap(find.widgetWithText(FilledButton, 'Account aanmaken'));
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
      final nextButton = find.widgetWithText(FilledButton, 'Volgende');
      expect(tester.widget<FilledButton>(nextButton).onPressed, isNull);

      await tester.tap(find.text('Afvallen'));
      await tester.pump();
      expect(tester.widget<FilledButton>(nextButton).onPressed, isNotNull);

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
      await tester.tap(find.widgetWithText(FilledButton, 'Volgende'));
      await tester.pumpAndSettle();
      expect(find.text('Waar train je meestal?'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
      expect(find.text('Wat wil je bereiken?'), findsOneWidget);
    });
  });
}
