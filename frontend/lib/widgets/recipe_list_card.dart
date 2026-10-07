import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'premium_teaser_card.dart';

/// Eén recept zoals `GET /recipes` het teruggeeft (Fase 11). Bij een
/// vergrendeld recept stuurt de backend geen ingrediënten of bereiding mee.
class Recipe {
  const Recipe({
    required this.id,
    required this.name,
    required this.mealType,
    required this.description,
    required this.kcalMin,
    required this.kcalMax,
    required this.locked,
    this.ingredients,
    this.steps,
  });

  factory Recipe.fromJson(Map<String, dynamic> json) {
    return Recipe(
      id: json['id'] as String,
      name: json['name'] as String,
      mealType: json['mealType'] as String,
      description: json['description'] as String,
      kcalMin: json['kcalMin'] as int,
      kcalMax: json['kcalMax'] as int,
      locked: json['locked'] as bool,
      ingredients: (json['ingredients'] as List?)?.cast<String>(),
      steps: (json['steps'] as List?)?.cast<String>(),
    );
  }

  final String id;
  final String name;
  final String mealType;
  final String description;
  final int kcalMin;
  final int kcalMax;
  final bool locked;
  final List<String>? ingredients;
  final List<String>? steps;

  /// Kcal altijd als range (CLAUDE.md Fase 11), bv. "330–400 kcal".
  String get kcalRange => '$kcalMin–$kcalMax kcal';
}

const mealTypeLabels = {
  'BREAKFAST': 'Ontbijt',
  'LUNCH': 'Lunch',
  'DINNER': 'Diner',
  'SNACK': 'Tussendoor',
};

const _goalLabels = {
  'LOSE_WEIGHT': 'afvallen',
  'BUILD_MUSCLE': 'spieropbouw',
  'GENERAL': 'algemeen gezond',
};

/// Receptenlijst op de Nutrition-tab (Fase 11, stap 3). Toont wat de
/// backend besliste: open recepten volledig, vergrendelde als rustige
/// Premium-teaser (gedimd, met label). Tikken op een vergrendeld recept
/// opent het Premium-infoblad.
class RecipeListCard extends StatelessWidget {
  const RecipeListCard({
    super.key,
    required this.goals,
    required this.recipes,
    required this.accessToken,
    required this.onPremiumActivated,
    this.onOpenRecipe,
  });

  final List<String> goals;
  final List<Recipe> recipes;
  final String accessToken;
  final VoidCallback onPremiumActivated;

  /// Een open recept openen (detailscherm, stap 4). Alleen voor open
  /// recepten; een vergrendeld recept opent het Premium-infoblad.
  final ValueChanged<Recipe>? onOpenRecipe;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final lockedCount = recipes.where((recipe) => recipe.locked).length;
    final goalText = goals.map((goal) => _goalLabels[goal] ?? goal).join(' en ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.restaurant_menu, size: 20),
                const SizedBox(width: 12),
                Expanded(child: Text('Recepten voor jou', style: textTheme.titleMedium)),
              ],
            ),
            const SizedBox(height: 4),
            Text('Afgestemd op $goalText', style: textTheme.bodySmall),
            for (final mealType in mealTypeLabels.keys)
              if (recipes.any((recipe) => recipe.mealType == mealType)) ...[
                const SizedBox(height: 16),
                Text(
                  mealTypeLabels[mealType]!,
                  style: textTheme.labelLarge?.copyWith(color: AppColors.highlight),
                ),
                for (final recipe in recipes.where((recipe) => recipe.mealType == mealType))
                  _RecipeTile(
                    recipe: recipe,
                    onTap: recipe.locked
                        ? () => discoverPremium(
                              context,
                              accessToken: accessToken,
                              onPremiumActivated: onPremiumActivated,
                            )
                        : (onOpenRecipe == null ? null : () => onOpenRecipe!(recipe)),
                  ),
              ],
            if (lockedCount > 0) ...[
              const SizedBox(height: 12),
              Text(
                lockedCount == 1
                    ? 'Nog 1 recept met Premium.'
                    : 'Nog $lockedCount recepten met Premium.',
                style: textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 20),
                ),
                onPressed: () => discoverPremium(
                  context,
                  accessToken: accessToken,
                  onPremiumActivated: onPremiumActivated,
                ),
                child: const Text('Ontdek Premium'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecipeTile extends StatelessWidget {
  const _RecipeTile({required this.recipe, required this.onTap});

  final Recipe recipe;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final dim = recipe.locked ? 0.55 : 1.0;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Expanded(
              child: Opacity(
                opacity: dim,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(recipe.name, style: textTheme.bodyLarge),
                    const SizedBox(height: 2),
                    Text(recipe.description, style: textTheme.bodySmall),
                    const SizedBox(height: 2),
                    Text(recipe.kcalRange, style: textTheme.bodySmall?.copyWith(color: AppColors.highlight)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),
            if (recipe.locked)
              const PremiumBadge()
            else if (onTap != null)
              const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }
}
