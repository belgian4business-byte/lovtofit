import 'package:flutter/material.dart';

import 'theme/app_theme.dart';
import 'widgets/recipe_list_card.dart';

/// Recept-detail (CLAUDE.md Fase 11, stap 4): ingrediënten en bereiding van
/// een open recept. Alles komt al mee in `GET /recipes`; vergrendelde
/// recepten openen dit scherm niet (de backend stuurt hun inhoud niet mee).
class RecipeDetailScreen extends StatelessWidget {
  const RecipeDetailScreen({super.key, required this.recipe});

  final Recipe recipe;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final ingredients = recipe.ingredients ?? const [];
    final steps = recipe.steps ?? const [];

    return Scaffold(
      appBar: AppBar(title: const Text('Recept')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(recipe.name, style: textTheme.headlineSmall),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _Tag(icon: Icons.schedule, label: mealTypeLabels[recipe.mealType] ?? recipe.mealType),
                  _Tag(icon: Icons.local_fire_department_outlined, label: recipe.kcalRange),
                ],
              ),
              const SizedBox(height: 12),
              Text(recipe.description, style: textTheme.bodyLarge),
              const SizedBox(height: 4),
              Text('Kcal is een schatting per portie.', style: textTheme.bodySmall),
              const SizedBox(height: 16),
              _Section(
                icon: Icons.shopping_basket_outlined,
                title: 'Ingrediënten',
                subtitle: 'Voor 1 portie',
                children: [
                  for (final ingredient in ingredients)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.only(top: 7, right: 10),
                            child: Icon(Icons.circle, size: 6, color: AppColors.highlight),
                          ),
                          Expanded(child: Text(ingredient, style: textTheme.bodyLarge)),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              _Section(
                icon: Icons.restaurant,
                title: 'Bereiding',
                children: [
                  for (final (index, step) in steps.indexed)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppColors.highlight.withValues(alpha: 0.16),
                              shape: BoxShape.circle,
                            ),
                            child: Text(
                              '${index + 1}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.highlight,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(child: Text(step, style: textTheme.bodyLarge)),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.icon, required this.title, this.subtitle, required this.children});

  final IconData icon;
  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text(title, style: textTheme.titleMedium)),
                if (subtitle != null) Text(subtitle!, style: textTheme.bodySmall),
              ],
            ),
            const SizedBox(height: 8),
            ...children,
          ],
        ),
      ),
    );
  }
}

/// Klein label in de blauwe huisstijl (maaltijd, kcal-range).
class _Tag extends StatelessWidget {
  const _Tag({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.highlight.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.highlight),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.highlight),
          ),
        ],
      ),
    );
  }
}
