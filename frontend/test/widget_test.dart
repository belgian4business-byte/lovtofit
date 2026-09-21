import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:lovtofit_app/main.dart';

void main() {
  testWidgets('shows a loading state before the health check resolves', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const LovtofitApp());

    expect(find.text('Verbinden...'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
