import 'package:flutter/material.dart';

import 'coach_screen.dart';
import 'home_screen.dart';
import 'nutrition_screen.dart';
import 'progress_screen.dart';
import 'train_screen.dart';

/// Onderste navigatiebalk met 5 tabs (CLAUDE.md, vast): Home · Train ·
/// Progress · Nutrition · Coach. Profiel/instellingen zitten achter het
/// tandwiel rechtsboven op elk tabscherm (geen eigen tab).
class MainShell extends StatefulWidget {
  const MainShell({super.key, required this.accessToken, required this.email});

  final String accessToken;
  final String email;

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      HomeScreen(accessToken: widget.accessToken, email: widget.email, isActive: _selectedIndex == 0),
      TrainScreen(accessToken: widget.accessToken, email: widget.email),
      ProgressScreen(accessToken: widget.accessToken, isActive: _selectedIndex == 2),
      NutritionScreen(accessToken: widget.accessToken, isActive: _selectedIndex == 3),
      CoachScreen(accessToken: widget.accessToken, isActive: _selectedIndex == 4),
    ];

    return Scaffold(
      body: IndexedStack(index: _selectedIndex, children: tabs),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) => setState(() => _selectedIndex = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.fitness_center_outlined), selectedIcon: Icon(Icons.fitness_center), label: 'Train'),
          NavigationDestination(icon: Icon(Icons.show_chart_outlined), selectedIcon: Icon(Icons.show_chart), label: 'Progress'),
          NavigationDestination(icon: Icon(Icons.restaurant_outlined), selectedIcon: Icon(Icons.restaurant), label: 'Nutrition'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Coach'),
        ],
      ),
    );
  }
}
