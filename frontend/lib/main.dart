import 'package:flutter/material.dart';

import 'login_screen.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const LovtofitApp());
}

class LovtofitApp extends StatelessWidget {
  const LovtofitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LOVTOFIT',
      theme: AppTheme.dark,
      home: const LoginScreen(),
    );
  }
}
