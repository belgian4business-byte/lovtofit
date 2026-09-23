import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'theme/app_theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  static const _registerUrl = '$apiBaseUrl/auth/register';

  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _isSubmitting = false;
  String? _errorMessage;
  bool _registered = false;

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
            Uri.parse(_registerUrl),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'email': _emailController.text.trim(),
              'password': _passwordController.text,
            }),
          )
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 201) {
        setState(() => _registered = true);
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
            child: _registered ? _buildSuccess(context) : _buildForm(context),
          ),
        ),
      ),
    );
  }

  Widget _buildSuccess(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check_circle, color: Colors.green, size: 64),
        const SizedBox(height: 16),
        Text('Account aangemaakt', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(
          _emailController.text.trim(),
          style: Theme.of(context).textTheme.bodyMedium,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        AppGradientButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Ga naar inloggen'),
        ),
      ],
    );
  }

  Widget _buildForm(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Maak een account aan',
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
              if (value == null || value.length < 8) {
                return 'Minimaal 8 tekens';
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
                : const Text('Account aanmaken'),
          ),
        ],
      ),
    );
  }
}
