class WorkoutExercise {
  const WorkoutExercise({
    required this.id,
    required this.name,
    required this.equipment,
    required this.targetSets,
    required this.targetReps,
  });

  final String id;
  final String name;
  final String equipment;
  final int targetSets;
  final int targetReps;

  /// Bodyweight-oefeningen loggen geen extern gewicht.
  bool get needsWeight => equipment != 'BODYWEIGHT';
}
