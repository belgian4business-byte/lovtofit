import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

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
      home: const HealthCheckScreen(),
    );
  }
}

enum _ConnectionStatus { loading, connected, failed }

class HealthCheckScreen extends StatefulWidget {
  const HealthCheckScreen({super.key});

  @override
  State<HealthCheckScreen> createState() => _HealthCheckScreenState();
}

class _HealthCheckScreenState extends State<HealthCheckScreen> {
  static const _healthUrl = 'http://localhost:3000/health';

  _ConnectionStatus _status = _ConnectionStatus.loading;

  @override
  void initState() {
    super.initState();
    _checkHealth();
  }

  Future<void> _checkHealth() async {
    setState(() => _status = _ConnectionStatus.loading);
    try {
      final response = await http
          .get(Uri.parse(_healthUrl))
          .timeout(const Duration(seconds: 5));
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      setState(() {
        _status = response.statusCode == 200 && body['status'] == 'ok'
            ? _ConnectionStatus.connected
            : _ConnectionStatus.failed;
      });
    } catch (_) {
      setState(() => _status = _ConnectionStatus.failed);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LOVTOFIT')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildStatusIcon(),
            const SizedBox(height: 16),
            Text(_buildStatusText(), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _status == _ConnectionStatus.loading ? null : _checkHealth,
              child: const Text('Opnieuw proberen'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusIcon() {
    switch (_status) {
      case _ConnectionStatus.loading:
        return const CircularProgressIndicator();
      case _ConnectionStatus.connected:
        return const Icon(Icons.check_circle, color: Colors.green, size: 64);
      case _ConnectionStatus.failed:
        return const Icon(Icons.error, color: Colors.red, size: 64);
    }
  }

  String _buildStatusText() {
    switch (_status) {
      case _ConnectionStatus.loading:
        return 'Verbinden...';
      case _ConnectionStatus.connected:
        return 'Verbonden';
      case _ConnectionStatus.failed:
        return 'Niet verbonden';
    }
  }
}
