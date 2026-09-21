import 'package:flutter/material.dart';

class LoggedInScreen extends StatelessWidget {
  const LoggedInScreen({super.key, required this.email});

  final String email;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LOVTOFIT')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.check_circle, color: Colors.green, size: 64),
            const SizedBox(height: 16),
            Text('Ingelogd als', style: Theme.of(context).textTheme.bodyMedium),
            Text(email, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 24),
            OutlinedButton(
              onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
              child: const Text('Uitloggen'),
            ),
          ],
        ),
      ),
    );
  }
}
