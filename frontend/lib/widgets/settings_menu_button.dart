import 'package:flutter/material.dart';

import '../profile_screen.dart';

/// Tandwiel rechtsboven voor profiel/instellingen — CLAUDE.md: "Profiel +
/// instellingen zitten achter een tandwiel/avatar rechtsboven (geen tab)".
/// "Uitloggen" staat hier nog tot het naar het profiel-scherm verhuist
/// (Fase 10, stap 4).
class SettingsMenuButton extends StatelessWidget {
  const SettingsMenuButton({super.key, required this.accessToken});

  final String accessToken;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.settings),
      tooltip: 'Profiel & instellingen',
      onSelected: (value) {
        if (value == 'profile') {
          Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => ProfileScreen(accessToken: accessToken)),
          );
        } else if (value == 'logout') {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      },
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: 'profile',
          child: ListTile(leading: Icon(Icons.person_outline), title: Text('Profiel')),
        ),
        PopupMenuItem(
          value: 'logout',
          child: ListTile(leading: Icon(Icons.logout), title: Text('Uitloggen')),
        ),
      ],
    );
  }
}
