/// App configuration.
///
/// The API base URL defaults to a local backend. On an Android emulator,
/// localhost is 10.0.2.2; on iOS simulator it's localhost. Override at build
/// time with: flutter run --dart-define=API_URL=https://api.aloravie.example
class Config {
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:4000',
  );
}
