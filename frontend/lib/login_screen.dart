import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'home_screen.dart';
import 'onboarding_flow.dart';
import 'register_screen.dart';
import 'theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  static const _loginUrl = 'http://localhost:3000/auth/login';

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final response = await http
          .post(
            Uri.parse(_loginUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': _emailController.text.trim(),
              'password': _passwordController.text,
            }),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201 && mounted) {
        final body = jsonDecode(response.body) as Map<String, dynamic>;
        final user = body['user'] as Map<String, dynamic>;
        final email = user['email'] as String;
        final accessToken = body['accessToken'] as String;
        final hasCompletedOnboarding = body['hasCompletedOnboarding'] as bool;

        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => hasCompletedOnboarding
                ? HomeScreen(accessToken: accessToken, email: email)
                : OnboardingFlow(accessToken: accessToken, email: email),
          ),
        );
        return;
      }

      setState(() => _errorMessage = _parseErrorMessage(response.body));
    } catch (_) {
      setState(() => _errorMessage = 'Kan geen verbinding maken met de server.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _parseErrorMessage(String body) {
    try {
      final decoded = jsonDecode(body) as Map<String, dynamic>;
      final message = decoded['message'];
      if (message is List) return message.join('\n');
      if (message is String) return message;
    } catch (_) {
      // Onverwacht antwoord van de server; val terug op een generieke melding.
    }
    return 'Er ging iets mis. Probeer het opnieuw.';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LOVTOFIT')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 400),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Inloggen',
                    style: Theme.of(context).textTheme.headlineSmall,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'E-mailadres'),
                    validator: (value) {
                      if (value == null || !value.contains('@')) {
                        return 'Vul een geldig e-mailadres in';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Wachtwoord'),
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Vul je wachtwoord in';
                      }
                      return null;
                    },
                  ),
                  if (_errorMessage != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _errorMessage!,
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 24),
                  AppGradientButton(
                    onPressed: _isSubmitting ? null : _submit,
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Inloggen'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _isSubmitting
                        ? null
                        : () => Navigator.of(
                            context,
                          ).push(MaterialPageRoute(builder: (_) => const RegisterScreen())),
                    child: const Text('Nog geen account? Registreren'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
