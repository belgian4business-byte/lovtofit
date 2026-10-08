class WorkoutExercise {
  const WorkoutExercise({
    required this.id,
    required this.name,
    required this.equipment,
    required this.targetSets,
    required this.targetReps,
    this.imageKey,
  });

  final String id;
  final String name;
  final String equipment;
  final int targetSets;
  final int targetReps;

  /// Foto-sleutel uit de backend; null = nog geen foto (placeholder).
  final String? imageKey;

  /// Bodyweight-oefeningen loggen geen extern gewicht.
  bool get needsWeight => equipment != 'BODYWEIGHT';
}

/// Fase 12: een oefening uit de warming-up of cooldown. Op tijd, zonder
/// sets of feedback — wordt niet gelogd en telt niet mee voor progressie.
class WorkoutBlockItem {
  const WorkoutBlockItem({
    required this.id,
    required this.name,
    required this.durationSeconds,
    this.imageKey,
  });

  final String id;
  final String name;
  final int durationSeconds;
  final String? imageKey;
}

/// `warmup`/`cooldown` uit GET /workouts/today. Ontbreekt het veld (Quick
/// Session, oudere backend), dan gewoon een lege lijst.
List<WorkoutBlockItem> parseBlockItems(List<dynamic>? items) {
  return (items ?? const []).cast<Map<String, dynamic>>().map((item) {
    final exercise = item['exercise'] as Map<String, dynamic>;
    return WorkoutBlockItem(
      id: exercise['id'] as String,
      name: exercise['name'] as String,
      durationSeconds: item['durationSeconds'] as int,
      imageKey: exercise['imageKey'] as String?,
    );
  }).toList();
}

/// Totale duur van een blok, afgerond op hele minuten (minstens 1).
int blockMinutes(List<WorkoutBlockItem> items) {
  final seconds = items.fold<int>(0, (sum, item) => sum + item.durationSeconds);
  return seconds <= 60 ? 1 : (seconds / 60).round();
}
