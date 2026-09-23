import 'package:flutter/material.dart';

/// Tandwiel rechtsboven voor profiel/instellingen — CLAUDE.md: "Profiel +
/// instellingen zitten achter een tandwiel/avatar rechtsboven (geen tab)".
/// Nu enkel "Uitloggen"; een echt profielscherm komt later.
class SettingsMenuButton extends StatelessWidget {
  const SettingsMenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.settings),
      tooltip: 'Profiel & instellingen',
      onSelected: (value) {
        if (value == 'logout') {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      },
      itemBuilder: (context) => const [
        PopupMenuItem(
          value: 'logout',
          child: ListTile(leading: Icon(Icons.logout), title: Text('Uitloggen')),
        ),
      ],
    );
  }
}
