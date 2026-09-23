/// Basis-URL van de backend — de enige plek waar die staat.
///
/// Standaard `localhost` (Flutter web op dezelfde pc). Een echte telefoon
/// kent de pc niet als `localhost`; geef dan het IP van de pc mee:
///
///     flutter run -d <toestel> --dart-define=API_BASE_URL=http://<pc-ip>:3000
///
/// Het IP staat bewust niet in de code: het verschilt per netwerk en per
/// ontwikkelaar.
const apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');
