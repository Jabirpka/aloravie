import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Order notifications.
///
/// This uses on-device local notifications, which work without any external
/// account — the app raises them when an order is placed or its status changes.
///
/// REMOTE PUSH (production): to notify customers when they're not in the app,
/// add Firebase Cloud Messaging:
///   1. Create a Firebase project; add Android + iOS apps.
///   2. Drop google-services.json (android/app) and GoogleService-Info.plist (ios).
///   3. Add firebase_core + firebase_messaging to pubspec and run `flutterfire configure`.
///   4. In init(), call Firebase.initializeApp(), request permission, get the FCM
///      token, send it to the backend (a /api/customers/me/push-token endpoint),
///      and forward FirebaseMessaging.onMessage to [show]. The backend sends a
///      push on order-status changes (hook into the fulfilment sync).
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  Future<void> init() async {
    try {
      const android = AndroidInitializationSettings('@mipmap/ic_launcher');
      const ios = DarwinInitializationSettings();
      await _plugin.initialize(const InitializationSettings(android: android, iOS: ios));

      // Ask for permission where the platform requires it.
      if (!kIsWeb && Platform.isIOS) {
        await _plugin
            .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>()
            ?.requestPermissions(alert: true, badge: true, sound: true);
      } else if (!kIsWeb && Platform.isAndroid) {
        await _plugin
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.requestNotificationsPermission();
      }
      _ready = true;
    } catch (e) {
      // Notifications are a nicety; never let setup break the app.
      debugPrint('Notification init skipped: $e');
    }
  }

  static const _details = NotificationDetails(
    android: AndroidNotificationDetails(
      'orders',
      'Order updates',
      channelDescription: 'Updates about your Aloravie orders',
      importance: Importance.high,
      priority: Priority.high,
    ),
    iOS: DarwinNotificationDetails(),
  );

  Future<void> show(String title, String body) async {
    if (!_ready) return;
    try {
      await _plugin.show(DateTime.now().millisecondsSinceEpoch ~/ 1000, title, body, _details);
    } catch (e) {
      debugPrint('Notification show failed: $e');
    }
  }

  Future<void> orderPlaced(String orderNumber) =>
      show('Order confirmed', 'Your order $orderNumber is confirmed. We\'ll let you know when it ships.');
}
