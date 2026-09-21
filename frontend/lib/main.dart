import 'package:flutter/material.dart';

import 'login_screen.dart';

void main() {
  runApp(const LovtofitApp());
}

class LovtofitApp extends StatelessWidget {
  const LovtofitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LOVTOFIT',
      theme: ThemeData(colorSchemeSeed: Colors.deepOrange, useMaterial3: true),
      home: const LoginScreen(),
    );
  }
}
