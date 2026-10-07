import 'package:flutter/material.dart';

import '../profile_screen.dart';

/// Tandwiel rechtsboven voor profiel/instellingen — CLAUDE.md: "Profiel +
/// instellingen zitten achter een tandwiel/avatar rechtsboven (geen tab)".
/// Opent meteen het profiel-scherm; uitloggen staat daar (Fase 10, stap 4).
class SettingsMenuButton extends StatelessWidget {
  const SettingsMenuButton({super.key, required this.accessToken});

  final String accessToken;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.settings),
      tooltip: 'Profiel & instellingen',
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => ProfileScreen(accessToken: accessToken)),
      ),
    );
  }
}
